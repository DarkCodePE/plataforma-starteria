/**
 * Lectura de capacidad del portafolio.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §4/§24 ("reasignar capacidad") y Core §17 (Job del
 * Portfolio Lead: "¿estamos dedicando capacidad organizacional al trabajo correcto?").
 *
 * El Core no define todavía una unidad de capacidad (horas, FTE, presupuesto) ni una operación de
 * reasignación: eso requiere ADR de producto. Esta lectura usa sólo lo que existe —iniciativas
 * activas por Frente y Reto, capacidad declarada al activar el Reto, bloqueos y cobertura— y devuelve
 * *señales* de reasignación para que una persona decida. No mueve nada.
 */
import type { PrismaClient } from '@prisma/client';

const ACTIVE = ['en_step_0', 'en_step_1', 'en_step_2', 'en_step_3', 'en_step_4', 'esperando_revision', 'lista_para_decision'];

export interface CapacityChallengeRow {
  challengeId: string;
  title: string;
  coverageStatus: string;
  activeInitiatives: number;
  blockedInitiatives: number;
  declaredInternalCapacity: string | null;
  requiresExternalCapability: boolean;
}

export interface CapacityFrontRow {
  frontId: string;
  name: string;
  priority: string;
  activeInitiatives: number;
  share: number;
  challenges: CapacityChallengeRow[];
}

export interface PortfolioCapacityReading {
  unit: 'active_initiatives';
  totalActiveInitiatives: number;
  fronts: CapacityFrontRow[];
  signals: Array<{ kind: 'uncovered_priority' | 'concentration' | 'blocked_capacity' | 'oversupplied'; frontId: string; challengeId?: string; message: string }>;
  note: string;
}

export class PortfolioCapacityReadService {
  constructor(private prisma: PrismaClient) {}

  async get(): Promise<PortfolioCapacityReading> {
    const fronts = await this.prisma.strategicFront.findMany({
      where: { status: { in: ['draft', 'active'] } },
      include: { challenges: { include: { initiativeMetas: { select: { status: true, requiresExternalCapability: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    const rows: CapacityFrontRow[] = fronts.map((front) => {
      const challenges = front.challenges
        .filter((challenge) => !['cerrado'].includes(String(challenge.status)))
        .map((challenge) => {
          const activation = (challenge.activationInputs ?? {}) as Record<string, unknown>;
          return {
            challengeId: challenge.id,
            title: challenge.title,
            coverageStatus: String(challenge.coverageStatus),
            activeInitiatives: challenge.initiativeMetas.filter((meta) => ACTIVE.includes(String(meta.status))).length,
            blockedInitiatives: challenge.initiativeMetas.filter((meta) => meta.status === 'bloqueada').length,
            declaredInternalCapacity: typeof activation.internalCapacity === 'string' ? activation.internalCapacity : null,
            requiresExternalCapability: challenge.initiativeMetas.some((meta) => meta.requiresExternalCapability),
          };
        });
      return {
        frontId: front.id,
        name: front.name,
        priority: String(front.priority),
        activeInitiatives: challenges.reduce((sum, challenge) => sum + challenge.activeInitiatives, 0),
        share: 0,
        challenges,
      };
    });

    const total = rows.reduce((sum, row) => sum + row.activeInitiatives, 0);
    rows.forEach((row) => {
      row.share = total > 0 ? Math.round((row.activeInitiatives / total) * 100) / 100 : 0;
    });

    const signals: PortfolioCapacityReading['signals'] = [];
    for (const row of rows) {
      if (row.priority === 'Alta' && row.activeInitiatives === 0 && row.challenges.length > 0) {
        signals.push({ kind: 'uncovered_priority', frontId: row.frontId, message: `"${row.name}" es prioridad alta y no tiene iniciativas activas.` });
      }
      if (row.priority === 'Baja' && total > 0 && row.share >= 0.5) {
        signals.push({ kind: 'concentration', frontId: row.frontId, message: `"${row.name}" es prioridad baja y concentra el ${Math.round(row.share * 100)}% de las iniciativas activas.` });
      }
      for (const challenge of row.challenges) {
        if (challenge.blockedInitiatives > 0 && challenge.blockedInitiatives >= challenge.activeInitiatives) {
          signals.push({ kind: 'blocked_capacity', frontId: row.frontId, challengeId: challenge.challengeId, message: `En "${challenge.title}" la capacidad está bloqueada: ${challenge.blockedInitiatives} iniciativa(s) bloqueada(s).` });
        }
        if (['cobertura_suficiente', 'resuelto'].includes(challenge.coverageStatus) && challenge.activeInitiatives > 1) {
          signals.push({ kind: 'oversupplied', frontId: row.frontId, challengeId: challenge.challengeId, message: `"${challenge.title}" ya tiene cobertura suficiente y ${challenge.activeInitiatives} iniciativas activas: podría liberar capacidad.` });
        }
      }
    }

    return {
      unit: 'active_initiatives',
      totalActiveInitiatives: total,
      fronts: rows,
      signals,
      note: 'Capacidad medida en iniciativas activas. Las señales son para decidir; Starteria no reasigna personas ni presupuesto.',
    };
  }
}
