import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../adaptive-core.service';

const describeP9 = process.env.P9_SUPPORT_E2E === '1' ? describe : describe.skip;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55433/starteria_e2e' } } });
const service = new AdaptiveCoreService(prisma);
const projectId = 'p9-support-project';
const userId = 'p9-support-owner';

async function clean() {
  await prisma.adaptiveAdaptationEvent.deleteMany({ where: { projectId } });
  await prisma.attentionItem.deleteMany({ where: { projectId } });
  await prisma.teamMember.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

describeP9('P9 support signal persistence', () => {
  beforeAll(async () => {
    await clean();
    await prisma.user.create({ data: { id: userId, email: 'p9-owner@starteria.test', name: 'P9 Owner', role: 'participante', roles: ['participante'], initials: 'P9', skills: [] } });
    await prisma.project.create({ data: { id: projectId, name: 'P9 Support', ownerId: userId } });
    await prisma.teamMember.create({ data: { projectId, userId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } });
  });
  afterAll(async () => { await clean(); await prisma.$disconnect(); });

  it('reuses AttentionItem as a durable Owner support signal without mutating Step state', async () => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const input = { idempotencyKey: `${projectId}-support-1`, category: 'external_capacity', reason: 'Necesitamos acceso a datos para medir el piloto.', severity: 'high' as const, exitCondition: 'Acceso a datos confirmado.', nextAction: 'Portfolio identifica al responsable de Data.' };
    const created = await service.signalSupport(projectId, userId, 'participante', input);
    const replay = await service.signalSupport(projectId, userId, 'participante', { ...input, reason: 'No debe aplicar por retry.' });
    const after = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(replay.id).toBe(created.id);
    expect(await prisma.attentionItem.count({ where: { projectId } })).toBe(1);
    expect(created).toMatchObject({ objectType: 'initiative_support', objectId: projectId, status: 'open', severity: 'high' });
    expect(after.currentStep).toBe(before.currentStep);
    expect(await prisma.adaptiveAdaptationEvent.count({ where: { projectId, eventType: 'support_signaled' } })).toBe(1);
  });
});
