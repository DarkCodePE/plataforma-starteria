import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PortfolioAttentionWorkflowService } from '../portfolio-attention-workflow.service';

const suite = process.env.PORTFOLIO_ATTENTION_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const stamp = `g04-attention-${Date.now()}`;
const orgId = `${stamp}-org`;
const projectId = `${stamp}-project`;
const leadId = `${stamp}-lead`;
const ownerId = `${stamp}-owner`;
const outsiderId = `${stamp}-outsider`;

suite('G04 AttentionItem: PostgreSQL governance and event history', () => {
  const service = new PortfolioAttentionWorkflowService(prisma);

  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: leadId, email: `${leadId}@starteria.test`, name: 'G04 Lead', role: 'portfolio_lead', initials: 'GL', skills: [] },
      { id: ownerId, email: `${ownerId}@starteria.test`, name: 'G04 Owner', role: 'participante', initials: 'GO', skills: [] },
      { id: outsiderId, email: `${outsiderId}@starteria.test`, name: 'G04 Outsider', role: 'participante', initials: 'GX', skills: [] },
    ] });
    await prisma.organization.create({ data: { id: orgId, name: 'G04 isolated organisation', slug: orgId } });
    await prisma.user.updateMany({ where: { id: { in: [leadId, ownerId] } }, data: { organizationId: orgId } });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: orgId, userId: leadId, role: 'admin' },
      { organizationId: orgId, userId: ownerId, role: 'member' },
    ] });
    await prisma.project.create({ data: {
      id: projectId, name: 'G04 request journey', ownerId, organizationId: orgId,
    } });
  });

  afterAll(async () => {
    await prisma.attentionItem.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [leadId, ownerId, outsiderId] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('persists open → assign → acknowledge → respond → escalate → resolve → reopen with immutable provenance', async () => {
    const original = await service.create(projectId, leadId, 'g04-create-01', {
      category: 'dependency', reason: 'Proveedor sin confirmar la integración.',
      exitCondition: 'Recibir y verificar una integración operativa.',
      nextAction: 'Asignar verificación al owner.',
      severity: 'high',
    });
    const replay = await service.create(projectId, leadId, 'g04-create-01', {
      category: 'dependency', reason: 'Proveedor sin confirmar la integración.',
      exitCondition: 'Recibir y verificar una integración operativa.',
      nextAction: 'Asignar verificación al owner.',
      severity: 'high',
    });
    expect(replay.id).toBe(original.id);
    await expect(service.create(projectId, leadId, 'g04-create-01', {
      category: 'dependency', reason: 'Intento de reutilizar una clave con otro contenido.',
      exitCondition: 'Recibir y verificar una integración operativa.',
      nextAction: 'Asignar verificación al owner.',
      severity: 'high',
    })).rejects.toMatchObject({ code: 'ATTENTION_KEY_REUSED' });
    expect(original.status).toBe('open');
    expect(original.version).toBe(0);

    const assign = await service.act(projectId, original.id, leadId, 'g04-assign-01', {
      action: 'assign', expectedVersion: 0, assigneeId: ownerId,
    });
    expect(assign).toMatchObject({ version: 1, status: 'open', ownerId });
    const ack = await service.act(projectId, original.id, leadId, 'g04-ack-01', {
      action: 'acknowledge', expectedVersion: 1,
    });
    expect(ack).toMatchObject({ version: 2, status: 'acknowledged' });
    const response = await service.act(projectId, original.id, leadId, 'g04-respond-01', {
      action: 'respond', expectedVersion: 2, note: 'El equipo confirmó que el proveedor aún no responde.',
    });
    expect(response).toMatchObject({ version: 3, status: 'acknowledged' });
    const escalation = await service.act(projectId, original.id, leadId, 'g04-escalate-01', {
      action: 'escalate', expectedVersion: 3, assigneeId: leadId,
      note: 'Requiere intervención del responsable de portafolio.',
    });
    expect(escalation).toMatchObject({ version: 4, status: 'acknowledged', ownerId: leadId });
    const resolution = await service.act(projectId, original.id, leadId, 'g04-resolve-01', {
      action: 'resolve', expectedVersion: 4,
      note: 'Se verificó la integración mediante evidencia del proveedor.',
    });
    expect(resolution).toMatchObject({ version: 5, status: 'resolved', resolvedById: leadId });
    expect(resolution.resolutionNote).toContain('Se verificó');
    await expect(service.act(projectId, original.id, leadId, 'g04-illegal-edit', {
      action: 'respond', expectedVersion: 5, note: 'No se puede responder a una alerta resuelta.',
    })).rejects.toMatchObject({ code: 'ATTENTION_ALREADY_CLOSED' });
    const opened = await service.act(projectId, original.id, leadId, 'g04-reopen-01', {
      action: 'reopen', expectedVersion: 5, note: 'El proveedor volvió a interrumpir la integración.',
    });
    expect(opened).toMatchObject({ version: 6, status: 'open', resolvedAt: null, resolutionNote: null });

    const fresh = new PrismaClient();
    try {
      const persisted = await fresh.attentionItem.findUniqueOrThrow({
        where: { id: original.id }, include: { events: { orderBy: { createdAt: 'asc' } } },
      });
      expect(persisted.events).toHaveLength(7);
      expect(persisted.events.map((event) => event.action)).toEqual([
        'create', 'assign', 'acknowledge', 'respond', 'escalate', 'resolve', 'reopen',
      ]);
      expect(persisted.events.every((event) => event.actorId === leadId)).toBe(true);
      const idempotentReplay = await service.act(projectId, original.id, leadId, 'g04-reopen-01', {
        action: 'reopen', expectedVersion: 5, note: 'El proveedor volvió a interrumpir la integración.',
      });
      expect(idempotentReplay.version).toBe(6);
      await expect(service.act(projectId, original.id, leadId, 'g04-reopen-01', {
        action: 'reopen', expectedVersion: 5, note: 'Cambio distinto con la misma clave de operación.',
      })).rejects.toMatchObject({ code: 'ATTENTION_KEY_REUSED' });
      expect(await prisma.portfolioAttentionEvent.count({ where: { attentionItemId: original.id } })).toBe(7);
    } finally { await fresh.$disconnect(); }
  });

  it('rejects stale updates and assignees outside the organisation', async () => {
    const issue = await service.create(projectId, leadId, 'g04-create-02', {
      category: 'blocker', reason: 'Falta aprobación legal sobre datos.',
      exitCondition: 'Aprobación documentada y verificable.',
      nextAction: 'Revisar con asesoría legal.',
    });
    await expect(service.act(projectId, issue.id, leadId, 'g04-stale-01', {
      action: 'acknowledge', expectedVersion: 42,
    })).rejects.toMatchObject({ code: 'ATTENTION_STALE_VERSION' });
    await expect(service.act(projectId, issue.id, leadId, 'g04-foreign-01', {
      action: 'assign', expectedVersion: 0, assigneeId: outsiderId,
    })).rejects.toMatchObject({ code: 'ATTENTION_INVALID_ASSIGNEE' });
    expect((await service.list(projectId)).find((item) => item.id === issue.id)?.events).toHaveLength(1);
    expect(await prisma.attentionItem.findUnique({ where: { id: issue.id } })).toMatchObject({ status: 'open', version: 0 });
  });
});
