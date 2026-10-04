/**
 * Recomendación de desagregación de un Frente en Retos.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §8–§11 y §26; Core v0.2: "una observación de
 * IA no crea un Challenge sola" (AGENTS.md).
 *
 * `suggest` no escribe nada: devuelve una propuesta AI_SUGGESTED / UNREVIEWED que explica qué
 * observó, por qué separar, qué beneficio da, qué estructura propone y su impacto — o dice que
 * no hace falta otro Reto (§10). `confirm` crea sólo los Retos que la persona eligió.
 *
 * El detector es determinístico (señales de §9 sobre el texto del Frente, sus Retos y sus
 * iniciativas). Es transparente a propósito: cada recomendación nombra la señal que la disparó.
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

export type SplitSignalId =
  | 'distinct_problems' // §9.2
  | 'different_owners' // §9.4
  | 'different_kpis' // §9.6
  | 'different_constraints' // §9.7
  | 'overlapping_initiatives' // §9.9
  | 'broad_result'; // §9.1 / §9.10

export interface SplitSignal {
  id: SplitSignalId;
  description: string;
}

export interface ProposedChallenge {
  title: string;
  whatWeWantToMove: string;
  rationale: string;
}

export interface ChallengeSplitSuggestion {
  frontId: string;
  recommendation: 'split' | 'no_split';
  provenance: 'AI_SUGGESTED';
  reviewStatus: 'UNREVIEWED';
  observed: string;
  signals: SplitSignal[];
  whySplit: string | null;
  benefits: string[];
  proposedChallenges: ProposedChallenge[];
  impact: { challengesToCreate: number; existingChallenges: number; initiativesMoved: 0; note: string } | null;
  stillInference: string;
}

// Frases que anuncian partes distintas del resultado: "dos momentos distintos: onboarding y uso recurrente".
const ENUMERATION = /(?:momentos|partes|problemas|segmentos|etapas|causas|frentes|grupos|canales|oportunidades)[^:.]*:\s*([^.;\n]+)/i;
const DIFFERENT_OWNERS = /(owners?|responsables|equipos)\s+(?:\S+\s+){0,3}(distint|diferent)/i;
const DIFFERENT_KPIS = /(kpis?|se[nñ]ales|m[eé]tricas|indicadores)\s+(?:\S+\s+){0,3}(distint|diferent)/i;
const DIFFERENT_CONSTRAINTS = /(restricciones|dependencias)\s+(?:\S+\s+){0,3}(distint|diferent)/i;

const BENEFITS = [
  'Claridad de ownership: cada espacio de intervención tiene su responsable.',
  'Mejor activación de equipos: cada reto convoca a quien corresponde.',
  'Comparar iniciativas dentro del mismo espacio.',
  'Lectura de cobertura por espacio y detección de gaps y solapamientos.',
  'Restricciones y decisiones más acotadas.',
];

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function parseParts(text: string): string[] {
  const match = text.match(ENUMERATION);
  if (!match) return [];
  // La enumeración termina donde empieza otra cláusula: "…onboarding y uso recurrente, con owners distintos".
  const list = match[1].split(/,\s*(?:con|que|donde|porque|pero|aunque|sin|para|cada|seg[uú]n)\b/i)[0];
  return list
    .split(/,|\s+y\s+|\s+e\s+|\s+o\s+/i)
    .map((part) => part.trim().replace(/^(el|la|los|las)\s+/i, ''))
    .filter((part) => part.length > 2);
}

export class ChallengeSplitService {
  constructor(private prisma: PrismaClient) {}

  async suggest(frontId: string): Promise<ChallengeSplitSuggestion> {
    const front = await this.prisma.strategicFront.findUnique({
      where: { id: frontId },
      include: {
        challenges: {
          include: {
            initiativeMetas: { select: { projectId: true } },
            overlaps: { select: { id: true, level: true } },
          },
        },
      },
    });
    if (!front) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    const text = [front.strategicObjective, front.description, front.whyNow, front.constraints].filter(Boolean).join('. ');
    const existingTitles = front.challenges.map((challenge) => normalize(challenge.title));
    const parts = parseParts(text).filter(
      (part) => !existingTitles.some((title) => title.includes(normalize(part))),
    );

    const signals: SplitSignal[] = [];
    if (parts.length >= 2) signals.push({ id: 'distinct_problems', description: `El frente nombra partes distintas del resultado: ${parts.join(', ')}.` });
    if (DIFFERENT_OWNERS.test(text)) signals.push({ id: 'different_owners', description: 'Las partes requieren owners o capacidades diferentes.' });
    if (DIFFERENT_KPIS.test(text)) signals.push({ id: 'different_kpis', description: 'Las partes se observan con señales o KPIs diferentes.' });
    if (DIFFERENT_CONSTRAINTS.test(text)) signals.push({ id: 'different_constraints', description: 'Las partes tienen restricciones o dependencias distintas.' });
    const highOverlaps = front.challenges.flatMap((challenge) => challenge.overlaps).filter((overlap) => overlap.level !== 'bajo');
    if (highOverlaps.length > 0) signals.push({ id: 'overlapping_initiatives', description: `Hay ${highOverlaps.length} solapamiento(s) relevante(s) entre iniciativas del frente.` });
    if (front.challenges.length === 0 && parts.length >= 2) {
      signals.push({ id: 'broad_result', description: 'El resultado todavía no tiene espacios de intervención: activarlo entero sería un mandato ambiguo.' });
    }

    const objective = front.strategicObjective?.trim() || front.name;
    const base = {
      frontId: front.id,
      provenance: 'AI_SUGGESTED' as const,
      reviewStatus: 'UNREVIEWED' as const,
      signals,
      stillInference: 'Es una inferencia sobre el texto del frente y sus retos: no se crea nada hasta que la confirmes.',
    };

    // §10: sin partes distintas, separar sólo agrega taxonomía.
    if (parts.length < 2) {
      return {
        ...base,
        recommendation: 'no_split',
        observed:
          front.challenges.length > 0
            ? `El frente ya tiene ${front.challenges.length} reto(s) y no aparecen partes del resultado que queden fuera de ellos.`
            : 'El frente describe un único resultado sin partes, owners ni señales que se separen.',
        whySplit: null,
        benefits: [],
        proposedChallenges: [],
        impact: null,
      };
    }

    const proposedChallenges = parts.map((part) => ({
      title: `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
      whatWeWantToMove: `${objective} — en ${part}`,
      rationale: `Separa ${part} para evaluar su cobertura y su evidencia por su cuenta.`,
    }));

    return {
      ...base,
      recommendation: 'split',
      observed: `Tu frente busca "${objective}", pero el trabajo atiende ${parts.length} partes distintas: ${parts.join(', ')}.`,
      whySplit:
        'Separarlas permite evaluar cobertura y evidencia de forma distinta, porque cada parte tiene su propio problema' +
        (signals.some((signal) => signal.id === 'different_owners' || signal.id === 'different_kpis') ? ', sus owners y sus señales.' : '.'),
      benefits: BENEFITS,
      proposedChallenges,
      impact: {
        challengesToCreate: proposedChallenges.length,
        existingChallenges: front.challenges.length,
        initiativesMoved: 0,
        note: 'Se crearían como borrador bajo este frente. Ninguna iniciativa se mueve ni se reasigna sin tu confirmación.',
      },
    };
  }

  /** Crea sólo los Retos que la persona confirmó (§26). Quedan en borrador. */
  async confirm(frontId: string, challenges: Array<{ title: string; whatWeWantToMove?: string }>) {
    const front = await this.prisma.strategicFront.findUnique({ where: { id: frontId }, select: { id: true } });
    if (!front) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });
    return this.prisma.$transaction(
      challenges.map((challenge) =>
        this.prisma.challenge.create({
          data: {
            strategicFrontId: frontId,
            title: challenge.title,
            name: challenge.title,
            whatWeWantToMove: challenge.whatWeWantToMove,
            publicationNotes: 'Creado al confirmar una sugerencia de desagregación del Copilot.',
          },
        }),
      ),
    );
  }
}
