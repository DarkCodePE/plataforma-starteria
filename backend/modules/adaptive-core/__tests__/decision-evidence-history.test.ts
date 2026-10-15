/**
 * Auditoría E2E F-18 (NEEDS_EVIDENCE): ¿qué le pasa a una decisión ya tomada si después cambia
 * la evidencia que la sostenía? Este test fija lo que HOY garantiza el código:
 *
 *  1. La decisión se lee de sus snapshots (readiness, package, presentation); no consulta la
 *     evidencia viva, así que cambiarla o borrarla no reescribe la historia.
 *  2. El traspaso a implementación copia la evidencia del snapshot de la decisión.
 *  3. Cambiar el estado de una evidencia no dispara ninguna señal sobre decisiones previas.
 *
 * El punto 3 es el hueco que señala la auditoría: no hay "needs_review". Cómo marcar una decisión
 * cuyo soporte cambió (señal, nueva decisión, nada) es una decisión de producto; este test lo deja
 * explícito para que, si se implementa, cambie a propósito.
 */
import { describe, expect, it, vi } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { EvidenceService } from '../../evidence/evidence.service';

const DECISION_ROW = {
  id: 'd1', projectId: 'p1', sourceCycleId: 'c1', decisionRequestId: 'r1', outcome: 'scale',
  decidedById: 'lead', decidedAt: new Date('2026-10-01'), rationale: 'Bajó 20% el retrabajo',
  authoritySnapshotJson: {}, readinessSnapshotJson: { assessments: [] },
  packageSnapshotJson: { evidenceReferences: [{ id: 'ev-1', summary: 'Reporte CRM: -20%' }] },
  presentationSnapshotJson: { evidence: [{ id: 'ev-1' }] },
  idempotencyKey: 'k1', createdAt: new Date('2026-10-01'),
};

describe('decisión ya tomada vs evidencia que cambia (F-18)', () => {
  it('la decisión se arma sólo desde sus snapshots, sin leer la evidencia viva', () => {
    const evidenceRead = vi.fn();
    const service = new AdaptiveCoreService({ evidence: { findMany: evidenceRead, findFirst: evidenceRead, findUnique: evidenceRead } } as any) as any;
    const decision = service.mapDecision(DECISION_ROW);
    expect(decision.packageSnapshotJson).toEqual(DECISION_ROW.packageSnapshotJson);
    expect(evidenceRead).not.toHaveBeenCalled();
  });

  it('el traspaso usa la evidencia congelada en la decisión', () => {
    const service = new AdaptiveCoreService({} as any) as any;
    expect(service.extractEvidenceSnapshot(DECISION_ROW)).toEqual([{ id: 'ev-1', summary: 'Reporte CRM: -20%' }]);
  });

  it('HOY: cambiar el estado de una evidencia no toca decisiones ni deja señal de revisión', async () => {
    const decisionWrites = vi.fn();
    const prisma: any = {
      evidence: {
        findFirst: vi.fn(async () => ({ id: 'ev-1', projectId: 'p1' })),
        update: vi.fn(async ({ data }: any) => ({ id: 'ev-1', ...data })),
      },
      decision: { update: decisionWrites, updateMany: decisionWrites },
      decisionLifecycleProjection: { update: decisionWrites, upsert: decisionWrites },
    };
    await new EvidenceService(prisma).updateEvidenceStatus('p1', 'ev-1', 'rejected' as any);
    expect(prisma.evidence.update).toHaveBeenCalledTimes(1);
    expect(decisionWrites).not.toHaveBeenCalled();
  });
});
