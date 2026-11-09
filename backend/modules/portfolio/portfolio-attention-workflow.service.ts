import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { AttentionWorkflowError, planAttentionTransition, type AttentionWorkflowAction, type AttentionWorkflowStatus } from './attention-workflow.policy';

type CreateAttentionInput = {
  category: string; reason: string; exitCondition: string; nextAction: string;
  severity?: 'low' | 'medium' | 'high' | 'critical'; ownerId?: string | null;
};
type ActionInput = {
  action: AttentionWorkflowAction;
  expectedVersion: number;
  assigneeId?: string;
  note?: string;
};

function textField(value: string, label: string, min = 3, max = 2000): string {
  const v = value?.trim() ?? '';
  if (v.length < min || v.length > max) throw AppError.badRequest(
    `${label} debe tener entre ${min} y ${max} caracteres.`, 'ATTENTION_INVALID_FIELD');
  return v;
}

export class PortfolioAttentionWorkflowService {
  constructor(private readonly db: PrismaClient) {}

  private async assigneeBelongsToProject(projectId: string, userId: string): Promise<void> {
    const project = await this.db.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (!project?.organizationId) throw AppError.notFound('Iniciativa', 'ATTENTION_PROJECT_NOT_FOUND');
    const [user, membership] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { organizationId: true, isActive: true } }),
      this.db.organizationMember.findFirst({ where: { organizationId: project.organizationId, userId }, select: { id: true } }),
    ]);
    if (!user?.isActive || !membership || user.organizationId !== project.organizationId) {
      throw AppError.badRequest('El responsable no pertenece a la organización activa.', 'ATTENTION_INVALID_ASSIGNEE');
    }
  }

  async list(projectId: string) {
    return this.db.attentionItem.findMany({
      where: { projectId }, orderBy: [{ createdAt: 'desc' }],
      include: { events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
  }

  async create(projectId: string, actorId: string, key: string, input: CreateAttentionInput) {
    const idempotencyKey = textField(key, 'Idempotency-Key', 8, 200);
    const reason = textField(input.reason, 'Motivo');
    const category = textField(input.category, 'Categoría', 3, 80);
    const exitCondition = textField(input.exitCondition, 'Condición de resolución');
    const nextAction = textField(input.nextAction, 'Siguiente acción');
    if (input.ownerId) await this.assigneeBelongsToProject(projectId, input.ownerId);
    const existing = await this.db.portfolioAttentionEvent.findUnique({
      where: { idempotencyKey }, include: { attentionItem: true },
    });
    if (existing) {
      if (existing.action !== 'create' || existing.attentionItem.projectId !== projectId || existing.actorId !== actorId) {
        throw AppError.conflict('La clave de idempotencia ya pertenece a otra operación.', 'ATTENTION_KEY_REUSED');
      }
      return existing.attentionItem;
    }
    try {
      return await this.db.attentionItem.create({
        data: {
          projectId, category, reason, exitCondition, nextAction,
          severity: input.severity ?? 'medium', ownerId: input.ownerId ?? null,
          events: { create: {
            action: 'create', actorId, beforeStatus: null, afterStatus: 'open',
            previousOwnerId: null, nextOwnerId: input.ownerId ?? null,
            note: reason, idempotencyKey,
          } },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const replay = await this.db.portfolioAttentionEvent.findUnique({ where: { idempotencyKey }, include: { attentionItem: true } });
        if (replay?.action === 'create' && replay.actorId === actorId && replay.attentionItem.projectId === projectId) return replay.attentionItem;
        throw AppError.conflict('La clave pertenece a otra operación.', 'ATTENTION_KEY_REUSED');
      }
      throw error;
    }
  }

  async act(projectId: string, attentionItemId: string, actorId: string, key: string, input: ActionInput) {
    const idempotencyKey = textField(key, 'Idempotency-Key', 8, 200);
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      throw AppError.badRequest('Se requiere expectedVersion para evitar sobrescribir cambios.', 'ATTENTION_VERSION_REQUIRED');
    }
    if (input.assigneeId && ['assign', 'escalate'].includes(input.action)) {
      await this.assigneeBelongsToProject(projectId, input.assigneeId);
    }
    const existing = await this.db.portfolioAttentionEvent.findUnique({ where: { idempotencyKey }, include: { attentionItem: true } });
    if (existing) {
      if (existing.attentionItemId !== attentionItemId || existing.actorId !== actorId || existing.action !== input.action
        || existing.attentionItem.projectId !== projectId) {
        throw AppError.conflict('La clave pertenece a otra operación.', 'ATTENTION_KEY_REUSED');
      }
      return existing.attentionItem;
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const current = await tx.attentionItem.findUnique({ where: { id: attentionItemId } });
        if (!current || current.projectId !== projectId) throw AppError.notFound('Alerta', 'ATTENTION_NOT_FOUND');
        if (current.version !== input.expectedVersion) {
          throw AppError.conflict('La alerta cambió. Actualiza antes de decidir.', 'ATTENTION_STALE_VERSION');
        }
        let change;
        try {
          change = planAttentionTransition({
            status: current.status as AttentionWorkflowStatus, action: input.action,
            currentOwnerId: current.ownerId, actorId,
            assigneeId: input.assigneeId, note: input.note,
          });
        } catch (e) {
          if (e instanceof AttentionWorkflowError) throw AppError.conflict(e.message, e.code);
          throw e;
        }
        const updated = await tx.attentionItem.updateMany({
          where: { id: attentionItemId, version: current.version },
          data: {
            status: change.status, ownerId: change.ownerId, version: { increment: 1 },
            resolutionNote: input.action === 'resolve' || input.action === 'cancel' ? change.event.note
              : input.action === 'reopen' ? null : current.resolutionNote,
            resolvedById: input.action === 'resolve' ? actorId : input.action === 'reopen' ? null : current.resolvedById,
            resolvedAt: input.action === 'resolve' ? new Date() : input.action === 'reopen' ? null : current.resolvedAt,
          },
        });
        if (updated.count !== 1) throw AppError.conflict('La alerta cambió. Actualiza antes de decidir.', 'ATTENTION_STALE_VERSION');
        await tx.portfolioAttentionEvent.create({ data: {
          attentionItemId, actorId, action: change.event.action,
          beforeStatus: current.status, afterStatus: change.status,
          previousOwnerId: current.ownerId, nextOwnerId: change.ownerId,
          note: change.event.note, idempotencyKey,
        } });
        return tx.attentionItem.findUniqueOrThrow({ where: { id: attentionItemId } });
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const replay = await this.db.portfolioAttentionEvent.findUnique({ where: { idempotencyKey }, include: { attentionItem: true } });
        if (replay?.attentionItemId === attentionItemId && replay.actorId === actorId && replay.action === input.action
          && replay.attentionItem.projectId === projectId) return replay.attentionItem;
        throw AppError.conflict('La clave pertenece a otra operación.', 'ATTENTION_KEY_REUSED');
      }
      throw error;
    }
  }
}
