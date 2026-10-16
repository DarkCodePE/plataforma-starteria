/**
 * Feedback IA del deck (Step 4): se guarda el PDF, se lee contra los Steps confirmados y se cobra
 * un crédito sólo si la IA respondió.
 */
import { describe, expect, it, vi } from 'vitest';
import { DeckFeedbackService, type DeckFeedbackResult } from '../deck-feedback.service';

const PDF = Buffer.from('%PDF-1.4 deck de cierre');

const RESULT: DeckFeedbackResult = {
  summary: 'El deck cuenta la decisión.',
  goodPoints: ['Pedido claro'],
  missing: [],
  unsupportedClaims: [{ claim: 'Ventas +30%', why: 'El análisis registra 14%' }],
  inconsistencies: [],
  nextAction: 'Corregir la cifra.',
  pages: 6,
  extractedChars: 1200,
  deckTruncated: false,
  model: 'deepseek/deepseek-v4-flash',
};

function setup({ credits = 3, charged = 1, aiFails = false, outputs = [] as any[] } = {}) {
  const tx = {
    project: { updateMany: vi.fn().mockResolvedValue({ count: charged }) },
    deckFeedback: { create: vi.fn().mockResolvedValue({ id: 'fb-1', createdAt: new Date('2026-10-16T00:00:00Z') }) },
  };
  const prisma = {
    project: { findUnique: vi.fn().mockResolvedValue({ mentorCredits: credits }) },
    initiativePdf: { create: vi.fn().mockResolvedValue({}) },
    adaptiveStepOutput: { findMany: vi.fn().mockResolvedValue(outputs) },
    deckFeedback: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  } as any;
  const storage = {
    savePdf: vi.fn().mockResolvedValue({ fileKey: 'initiative-pdfs/p1/x/original.pdf', fileSize: PDF.byteLength, mimeType: 'application/pdf' }),
    deletePdf: vi.fn().mockResolvedValue(undefined),
  } as any;
  const ai = { analyze: aiFails ? vi.fn().mockRejectedValue(new Error('down')) : vi.fn().mockResolvedValue(RESULT) };
  return { service: new DeckFeedbackService(prisma, storage, ai), prisma, tx, storage, ai };
}

const input = { projectId: 'p1', userId: 'u1', role: 'owner', fileName: 'cierre.pdf', bytes: PDF };

describe('DeckFeedbackService.analyze', () => {
  it('guarda el PDF, lo lee contra los Steps confirmados y cobra un crédito', async () => {
    const outputs = [
      { stepNumber: 0, outputJson: { problema: 'abandono' } },
      { stepNumber: 3, outputJson: { decision: 'escalar' } },
      { stepNumber: 3, outputJson: { decision: 'versión vieja' } },
    ];
    const { service, prisma, tx, storage, ai } = setup({ outputs });

    const out = await service.analyze(input);

    expect(storage.savePdf).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', bytes: PDF }));
    expect(prisma.initiativePdf.create).toHaveBeenCalledOnce();
    expect(prisma.adaptiveStepOutput.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'p1', status: 'confirmed', stepNumber: { in: [0, 1, 2, 3] } } }),
    );
    // La versión más nueva de cada Step (vienen ordenadas por versión desc).
    expect(ai.analyze).toHaveBeenCalledWith(expect.objectContaining({ analysis: { step0: { problema: 'abandono' }, step3: { decision: 'escalar' } } }));
    expect(tx.project.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', mentorCredits: { gt: 0 } }, data: { mentorCredits: { decrement: 1 } } });
    expect(tx.deckFeedback.create).toHaveBeenCalledOnce();
    expect(out.result.unsupportedClaims[0].claim).toBe('Ventas +30%');
  });

  it('si la IA falla no cobra y el PDF queda guardado', async () => {
    const { service, prisma, storage } = setup({ aiFails: true });

    await expect(service.analyze(input)).rejects.toMatchObject({ statusCode: 503, code: 'DECK_FEEDBACK_UNAVAILABLE' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.deletePdf).not.toHaveBeenCalled();
  });

  it('sin créditos no llama a la IA ni guarda el archivo', async () => {
    const { service, storage, ai } = setup({ credits: 0 });

    await expect(service.analyze(input)).rejects.toMatchObject({ statusCode: 409, code: 'NO_MENTOR_CREDITS' });
    expect(ai.analyze).not.toHaveBeenCalled();
    expect(storage.savePdf).not.toHaveBeenCalled();
  });

  it('si otro análisis gastó el último crédito al mismo tiempo, no guarda el feedback', async () => {
    const { service, tx } = setup({ charged: 0 });

    await expect(service.analyze(input)).rejects.toMatchObject({ code: 'NO_MENTOR_CREDITS' });
    expect(tx.deckFeedback.create).not.toHaveBeenCalled();
  });

  it('rechaza lo que no es un PDF', async () => {
    const { service, storage } = setup();

    await expect(service.analyze({ ...input, bytes: Buffer.from('PK zip') })).rejects.toMatchObject({ code: 'PDF_MIME_INVALID' });
    expect(storage.savePdf).not.toHaveBeenCalled();
  });

  it('sin Steps confirmados manda el análisis vacío', async () => {
    const { service, ai } = setup();
    await service.analyze(input);
    expect(ai.analyze).toHaveBeenCalledWith(expect.objectContaining({ analysis: null }));
  });

  it('si el registro del PDF falla, borra el archivo', async () => {
    const { service, prisma, storage } = setup();
    prisma.initiativePdf.create.mockRejectedValue(new Error('db'));

    await expect(service.analyze(input)).rejects.toThrow('db');
    expect(storage.deletePdf).toHaveBeenCalledWith('initiative-pdfs/p1/x/original.pdf');
  });
});
