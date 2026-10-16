/**
 * Feedback IA del deck del Step 4.
 *
 * Antes "Analizar con IA" sólo cambiaba un estado en el navegador y mostraba un texto fijo: no se
 * subía el archivo ni se leía. Ahora:
 *
 * 1. El PDF se guarda en el almacenamiento de PDFs de iniciativa (`LOCAL_STORAGE_DIR`, que en el
 *    cluster es un volumen persistente) y queda registrado como `InitiativePdf`.
 * 2. La IA lo lee contra el análisis real: los outputs confirmados de Steps 0–3.
 * 3. Si la IA respondió, en una transacción se descuenta 1 crédito de mentor y se guarda el
 *    `DeckFeedback`. Si no respondió, no se cobra y el PDF queda guardado para reintentar.
 *
 * Sin créditos no se llama a la IA. Lo ve el equipo de la iniciativa y el Portfolio Lead asignado
 * (el router aplica `requireProjectTeamAccess`).
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ALLOWED_PDF_MIME, MAX_PDF_BYTES, type IPdfStorage } from '../initiative-pdfs';

export interface DeckFeedbackResult {
  summary: string;
  goodPoints: string[];
  missing: string[];
  unsupportedClaims: Array<{ claim: string; why: string }>;
  inconsistencies: string[];
  nextAction: string;
  pages: number;
  extractedChars: number;
  deckTruncated: boolean;
  model?: string;
}

export interface DeckFeedbackAi {
  analyze(input: { fileName: string; bytes: Buffer; analysis: Record<string, unknown> | null; userId: string; role: string }): Promise<DeckFeedbackResult>;
}

export interface DeckFeedbackDTO {
  id: string;
  pdfId: string;
  fileName: string;
  result: DeckFeedbackResult;
  createdAt: string;
}

const ANALYSIS_STEPS = [0, 1, 2, 3];

export class DeckFeedbackService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: IPdfStorage,
    private readonly ai: DeckFeedbackAi,
  ) {}

  async analyze(input: { projectId: string; userId: string; role: string; fileName: string; bytes: Buffer }): Promise<DeckFeedbackDTO> {
    if (!input.bytes?.byteLength) throw AppError.badRequest('Archivo vacío.', 'PDF_EMPTY', { hint: 'Vuelve a subir el PDF.' });
    if (input.bytes.byteLength > MAX_PDF_BYTES) {
      throw AppError.badRequest('El PDF pesa más de 50 MB.', 'PDF_TOO_LARGE', { hint: 'Reduce el tamaño del archivo.' });
    }
    if (input.bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw AppError.badRequest('El archivo no es un PDF.', 'PDF_MIME_INVALID', { hint: 'Exporta la presentación como PDF.' });
    }

    const project = await this.prisma.project.findUnique({ where: { id: input.projectId }, select: { mentorCredits: true } });
    if (!project) throw AppError.notFound('Iniciativa');
    if ((project.mentorCredits ?? 0) <= 0) {
      throw new AppError(409, 'No quedan créditos de mentor para analizar el deck.', 'NO_MENTOR_CREDITS', true, {
        hint: 'Pide más créditos al Portfolio Lead.',
      });
    }

    const pdfId = randomUUID();
    const saved = await this.storage.savePdf({ projectId: input.projectId, pdfId, fileName: input.fileName, mimeType: ALLOWED_PDF_MIME, bytes: input.bytes });
    try {
      await this.prisma.initiativePdf.create({
        data: {
          id: pdfId,
          projectId: input.projectId,
          fileKey: saved.fileKey,
          fileName: input.fileName,
          mimeType: ALLOWED_PDF_MIME,
          fileSize: saved.fileSize,
          uploadedBy: input.userId,
        },
      });
    } catch (err) {
      await this.storage.deletePdf(saved.fileKey).catch(() => undefined);
      throw err;
    }

    const analysis = await this.loadAnalysis(input.projectId);
    let result: DeckFeedbackResult;
    try {
      result = await this.ai.analyze({ fileName: input.fileName, bytes: input.bytes, analysis, userId: input.userId, role: input.role });
    } catch {
      throw new AppError(503, 'No pudimos analizar el deck. No se descontó ningún crédito.', 'DECK_FEEDBACK_UNAVAILABLE', true, {
        hint: 'Vuelve a intentarlo en unos minutos.',
      });
    }

    const feedback = await this.prisma.$transaction(async (tx) => {
      // El descuento sólo pasa si queda un crédito: dos análisis a la vez no dejan el saldo negativo.
      const charged = await tx.project.updateMany({
        where: { id: input.projectId, mentorCredits: { gt: 0 } },
        data: { mentorCredits: { decrement: 1 } },
      });
      if (charged.count === 0) {
        throw new AppError(409, 'No quedan créditos de mentor para analizar el deck.', 'NO_MENTOR_CREDITS', true);
      }
      return tx.deckFeedback.create({
        data: { projectId: input.projectId, pdfId, result: result as any, model: result.model ?? null, createdById: input.userId },
      });
    });

    return { id: feedback.id, pdfId, fileName: input.fileName, result, createdAt: feedback.createdAt.toISOString() };
  }

  async list(projectId: string): Promise<DeckFeedbackDTO[]> {
    const rows = await this.prisma.deckFeedback.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { pdf: { select: { fileName: true } } },
    });
    return rows.map((row: any) => ({
      id: row.id,
      pdfId: row.pdfId,
      fileName: row.pdf?.fileName ?? '',
      result: row.result as DeckFeedbackResult,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Última versión confirmada de cada Step 0–3, por número de step. null si no hay ninguna. */
  async loadAnalysis(projectId: string): Promise<Record<string, unknown> | null> {
    const outputs = await this.prisma.adaptiveStepOutput.findMany({
      where: { projectId, status: 'confirmed', stepNumber: { in: ANALYSIS_STEPS } },
      orderBy: [{ stepNumber: 'asc' }, { version: 'desc' }],
      select: { stepNumber: true, outputJson: true },
    });
    const byStep: Record<string, unknown> = {};
    for (const output of outputs) {
      const key = `step${output.stepNumber}`;
      if (!(key in byStep)) byStep[key] = output.outputJson;
    }
    return Object.keys(byStep).length ? byStep : null;
  }
}
