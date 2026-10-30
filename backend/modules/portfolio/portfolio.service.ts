import { ensureChallengeGovernanceTx } from '../adaptive-core/initiative-governance';
import { frontScopeWhere, type PortfolioScope } from './portfolio-scope';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import {
  CreateStrategicFrontInput,
  UpdateStrategicFrontInput,
  CreateChallengeInput,
  UpdateChallengeInput,
  AddInvitationInput,
  UpdateInvitationInput,
  AddSquadMemberInput,
  UpdateSquadMemberInput,
  AddChallengeTeamMemberInput,
  UpdateChallengeTeamMemberInput,
  UpsertInitiativeTeamMemberInput,
  UpsertInitiativeMetaInput,
  CreateOverlapInput,
  CreateExecutiveOutputInput,
  UpdateExecutiveOutputInput,
} from './portfolio.schemas';
import {
  checkChallengeTransition,
  challengeAdmitsInitiatives,
  type ChallengeStatusValue,
} from './challenge-state-machine';
import {
  checkInitiativeTransition,
  initiativeAcceptsStepWrites,
} from './initiative-state-machine';
import {
  assertSameTenant,
  assertUserInTenant,
  challengeTenant,
  frontTenant,
  projectTenant,
  rejectTenantMove,
  tenantWriteTransaction,
  type PortfolioWriteAuthority,
} from './portfolio-tenant-write';

export class PortfolioService {
  constructor(private prisma: PrismaClient) {}

  // ─── Strategic Fronts ────────────────────────────────────────────────────────

  async listStrategicFronts(scope?: PortfolioScope) {
    return this.prisma.strategicFront.findMany({
      where: scope ? (frontScopeWhere(scope) as any) : undefined,
      include: {
        _count: { select: { challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStrategicFront(input: CreateStrategicFrontInput, authority: PortfolioWriteAuthority) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const organizationId = authority.organizationId;
      if (!organizationId || (input.organizationId && input.organizationId !== organizationId)) {
        throw AppError.notFound('Portfolio resource', 'PORTFOLIO_RESOURCE_NOT_FOUND');
      }
      await assertUserInTenant(tx, authority.actorUserId, organizationId);
      await assertUserInTenant(tx, input.ownerId, organizationId);
      return tx.strategicFront.create({
        data: { ...input, organizationId } as any,
        include: {
          _count: { select: { challenges: true } },
        },
      });
    });
  }

  async updateStrategicFront(id: string, input: UpdateStrategicFrontInput) {
    const existing = await this.prisma.strategicFront.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    return tenantWriteTransaction(this.prisma, async (tx) => {
      const current = await tx.strategicFront.findUnique({ where: { id } });
      if (!current) throw AppError.notFound('Portfolio resource', 'PORTFOLIO_RESOURCE_NOT_FOUND');
      rejectTenantMove(current.organizationId, input.organizationId);
      await assertUserInTenant(tx, input.ownerId, current.organizationId);
      const { organizationId: _ignored, ...safeInput } = input;
      return tx.strategicFront.update({
        where: { id },
        data: safeInput as any,
        include: {
          _count: { select: { challenges: true } },
        },
      });
    });
  }

  async deleteStrategicFront(id: string) {
    const existing = await this.prisma.strategicFront.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    await this.prisma.strategicFront.delete({ where: { id } });
  }

  // ─── Challenges ──────────────────────────────────────────────────────────────

  async listChallenges(strategicFrontId: string, scope?: PortfolioScope) {
    const front = await this.prisma.strategicFront.findUnique({
      where: { id: strategicFrontId },
    });
    // Un frente de otra organización responde igual que uno inexistente (no confirma IDs ajenos).
    const inScope = !scope || Boolean(front?.organizationId && scope.organizationIds.includes(front.organizationId));
    if (!front || !inScope) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    return this.prisma.challenge.findMany({
      where: { strategicFrontId },
      include: {
        selectedPeople: true,
        assignedSquad: true,
        _count: { select: { initiativeMetas: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createChallenge(strategicFrontId: string, input: CreateChallengeInput) {
    const front = await this.prisma.strategicFront.findUnique({
      where: { id: strategicFrontId },
    });
    if (!front) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    return tenantWriteTransaction(this.prisma, async (tx) => {
      const organizationId = await frontTenant(tx, strategicFrontId);
      await assertUserInTenant(tx, input.ownerId, organizationId);
      await assertUserInTenant(tx, input.sponsorId, organizationId);
      return tx.challenge.create({
        data: {
          ...(input as any),
          strategicFrontId,
        },
        include: {
          selectedPeople: true,
          assignedSquad: true,
          _count: { select: { initiativeMetas: true } },
        },
      });
    });
  }

  /**
   * ADR-030: puerta unica de transicion. La usan `updateChallenge` (via el input del
   * cliente) y las rutas que fijan un estado desde el servidor (`activateOpenCall`,
   * `publishChallenge`), para que no haya dos criterios de legalidad segun el endpoint.
   */
  private assertChallengeTransitionOrThrow(
    existing: { status: string; pausedFromStatus?: string | null },
    to: ChallengeStatusValue,
  ): ChallengeStatusValue | null {
    const check = checkChallengeTransition(
      existing.status as ChallengeStatusValue,
      to,
      (existing.pausedFromStatus ?? null) as ChallengeStatusValue | null,
    );
    if (check.kind === 'illegal') {
      throw AppError.conflict(check.reason, 'CHALLENGE_ILLEGAL_TRANSITION', {
        hint: check.allowed.length
          ? `Desde «${existing.status}» solo se puede pasar a: ${check.allowed.join(', ')}.`
          : 'Este reto no admite mas cambios de estado.',
      });
    }
    return check.pausedFromStatus;
  }

  async updateChallenge(id: string, input: UpdateChallengeInput) {
    const existing = await this.prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    // ADR-030: la transicion la decide el servidor. Antes esto era `data: input as any`,
    // asi que el cliente escribia el `status` que quisiera. Solo se valida cuando el
    // input TRAE status: un PATCH que edita el titulo no es una transicion.
    const data: Record<string, unknown> = { ...(input as Record<string, unknown>) };
    if (input.status !== undefined) {
      data.pausedFromStatus = this.assertChallengeTransitionOrThrow(
        existing,
        input.status as ChallengeStatusValue,
      );
    }

    return tenantWriteTransaction(this.prisma, async (tx) => {
      const current = await challengeTenant(tx, id);
      await assertUserInTenant(tx, input.ownerId, current.organizationId);
      await assertUserInTenant(tx, input.sponsorId, current.organizationId);
      return tx.challenge.update({
        where: { id },
        data: data as any,
        include: {
          selectedPeople: true,
          assignedSquad: true,
          _count: { select: { initiativeMetas: true } },
        },
      });
    });
  }

  async activateOpenCall(id: string) {
    const existing = await this.prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    // ADR-030: tambien esta ruta pasa por la maquina. Antes escribia `activo_interno`
    // directo, asi que se podia "activar" un reto cerrado y resucitarlo por la puerta de
    // atras — justo la clase de agujero que la tabla de transiciones viene a cerrar.
    this.assertChallengeTransitionOrThrow(existing, 'activo_interno');

    return this.prisma.challenge.update({
      where: { id },
      data: {
        activationMode: 'convocatoria_abierta',
        status: 'activo_interno',
        pausedFromStatus: null,
      } as any,
    });
  }

  async publishChallenge(id: string) {
    const existing = await this.prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    this.assertChallengeTransitionOrThrow(existing, 'publicado');

    return this.prisma.challenge.update({
      where: { id },
      data: { status: 'publicado', pausedFromStatus: null } as any,
    });
  }

  // ─── Invitations ─────────────────────────────────────────────────────────────

  async addInvitation(challengeId: string, input: AddInvitationInput) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });


    return this.prisma.challengeInvitation.create({
      data: {
        challengeId,
        value: input.value,
      },
    });
  }

  async updateInvitation(invId: string, input: UpdateInvitationInput) {
    const existing = await this.prisma.challengeInvitation.findUnique({ where: { id: invId } });
    if (!existing) throw AppError.notFound('Invitación', 'INVITATION_NOT_FOUND', { hint: 'Es posible que haya sido cancelada.' });

    return this.prisma.challengeInvitation.update({
      where: { id: invId },
      data: { status: input.status as any },
    });
  }

  // ─── Squad Members ────────────────────────────────────────────────────────────

  async addSquadMember(challengeId: string, input: AddSquadMemberInput) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challengeSquadMember.create({
      data: {
        challengeId,
        value: input.value,
        role: input.role,
      },
    });
  }

  async updateSquadMember(memberId: string, input: UpdateSquadMemberInput) {
    const existing = await this.prisma.challengeSquadMember.findUnique({
      where: { id: memberId },
    });
    if (!existing) throw AppError.notFound('Miembro del squad', 'SQUAD_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario forme parte del squad.' });

    return this.prisma.challengeSquadMember.update({
      where: { id: memberId },
      data: { role: input.role },
    });
  }

  // ─── Challenge Team Members (ADR-023) ──────────────────────────────────────────
  // Unified reto-scoped team. Replaces the squad strings + meta.teamMembers Json.

  async listChallengeTeam(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challengeTeamMember.findMany({
      where: { challengeId },
      include: { user: { select: { id: true, name: true, email: true, initials: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addChallengeTeamMember(challengeId: string, input: AddChallengeTeamMemberInput) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const { organizationId } = await challengeTenant(tx, challengeId);
      await assertUserInTenant(tx, input.userId, organizationId);

      // Logical uniqueness (challengeId, userId) — enforced here, NOT via @unique
      // (prisma db push trips its data-loss guard on @unique over a populated table).
      if (input.userId) {
        const dup = await tx.challengeTeamMember.findFirst({
          where: { challengeId, userId: input.userId },
          select: { id: true },
        });
        if (dup) {
          throw AppError.conflict(
            'Este usuario ya forma parte del equipo del reto.',
            'CHALLENGE_TEAM_MEMBER_EXISTS',
            { hint: 'Actualiza el miembro existente en lugar de duplicarlo.' },
          );
        }
      }

      return tx.challengeTeamMember.create({
        data: {
          challengeId,
          userId: input.userId ?? null,
          label: input.label ?? null,
          role: (input.role ?? 'VIEWER') as any,
          status: (input.status ?? 'ACTIVE') as any,
        },
        include: { user: { select: { id: true, name: true, email: true, initials: true } } },
      });
    });
  }

  async updateChallengeTeamMember(memberId: string, input: UpdateChallengeTeamMemberInput) {
    const existing = await this.prisma.challengeTeamMember.findUnique({ where: { id: memberId } });
    if (!existing) throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario forme parte del equipo.' });

    return this.prisma.challengeTeamMember.update({
      where: { id: memberId },
      data: {
        ...(input.role !== undefined ? { role: input.role as any } : {}),
        ...(input.status !== undefined ? { status: input.status as any } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, initials: true } } },
    });
  }

  async removeChallengeTeamMember(memberId: string) {
    const existing = await this.prisma.challengeTeamMember.findUnique({
      where: { id: memberId },
      select: { id: true },
    });
    if (!existing) throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario forme parte del equipo.' });

    await this.prisma.challengeTeamMember.delete({ where: { id: memberId } });
  }

  // ─── Initiative Team (resolution + per-iniciativa override, #110/#114) ─────────

  /**
   * Effective team of an iniciativa under the MATERIALIZE-AT-CREATE + REFRESH model:
   * the TeamMember rows (inherited from the reto at create-time + manual overrides).
   */
  async resolveInitiativeTeam(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', { hint: 'Verifica el ID o vuelve al listado.' });

    const members = await this.prisma.teamMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, initials: true } } },
      orderBy: [{ role: 'asc' }, { invitedAt: 'asc' }],
    });

    const owner = members.find((m) => m.role === 'OWNER')?.userId ?? null;
    const inheritedCount = members.filter((m) => m.inheritedFromChallenge).length;
    const label = `Equipo de ${members.length}${inheritedCount > 0 ? ` (${inheritedCount} heredado${inheritedCount > 1 ? 's' : ''})` : ''}`;

    return { members, owner, inheritedCount, label };
  }

  /** Add/override a member on the iniciativa team (TeamMember, inheritedFromChallenge=false). */
  async upsertInitiativeTeamMember(projectId: string, userId: string, input: UpsertInitiativeTeamMemberInput) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const { organizationId } = await projectTenant(tx, projectId);
      await assertUserInTenant(tx, userId, organizationId);
      return tx.teamMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        create: {
          projectId,
          userId,
          role: (input.role ?? 'VIEWER') as any,
          status: (input.status ?? 'ACTIVE') as any,
          inheritedFromChallenge: false,
          ...(input.modulePermissions ? { modulePermissions: input.modulePermissions } : {}),
        },
        update: {
          ...(input.role !== undefined ? { role: input.role as any } : {}),
          ...(input.status !== undefined ? { status: input.status as any } : {}),
          ...(input.modulePermissions !== undefined ? { modulePermissions: input.modulePermissions } : {}),
        },
        include: { user: { select: { id: true, name: true, email: true, initials: true } } },
      });
    });
  }

  /** Remove a member from the iniciativa team (override = exclude an inherited member). */
  async removeInitiativeTeamMember(projectId: string, userId: string) {
    const existing = await this.prisma.teamMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true, role: true },
    });
    if (!existing) throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'El usuario no pertenece al equipo de esta iniciativa.' });
    if (existing.role === 'OWNER') {
      throw AppError.conflict('No puedes quitar al owner de la iniciativa.', 'CANNOT_REMOVE_OWNER', { hint: 'Transfiere la propiedad antes de quitarlo.' });
    }

    await this.prisma.teamMember.delete({ where: { projectId_userId: { projectId, userId } } });
  }

  // ─── Initiatives ──────────────────────────────────────────────────────────────

  async listInitiativesForChallenge(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.initiativePortfolioMeta.findMany({
      where: { challengeId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            currentStep: true,
            owner: { select: { id: true, name: true, email: true, initials: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInitiativeMeta(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { adaptiveProgressSignal: true },
    });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', { hint: 'Verifica el ID o vuelve al listado.' });

    const meta = await this.prisma.initiativePortfolioMeta.findFirst({
      where: { projectId },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            name: true,
            strategicFrontId: true,
            status: true,
            // #93: the Steps-portal breadcrumb needs the frente name, not just the reto.
            strategicFront: { select: { id: true, name: true } },
          },
        },
      },
    });
    const adaptiveCore = (project.step0Data as any)?.adaptiveCore;
    const progressSignal = project.adaptiveProgressSignal?.signalJson ?? adaptiveCore?.progressSignal;
    return meta
      ? {
          ...meta,
          progressSignal,
          challengeContribution: adaptiveCore?.challengeContribution,
        }
      : meta;
  }

  async upsertInitiativeMeta(
    projectId: string,
    input: UpsertInitiativeMetaInput,
  ) {
    // ADR-024 / #113: teamMembers, teamOwner and teamLabel are DERIVED caches,
    // recalculated from the resolved team in initiative-progress.ts. They are never
    // accepted from the client — strip them so a stale UI value can't overwrite the cache.
    const { challengeId, teamMembers, teamOwner, teamLabel, ...rest } = input;
    void teamMembers; void teamOwner; void teamLabel;

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', { hint: 'Verifica el ID o vuelve al listado.' });

    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    // ADR-030 decision 4: un reto en pausa o cerrado no admite iniciativas NUEVAS.
    // Solo se bloquea el ALTA: una iniciativa ya vinculada sigue siendo editable
    // (su propio ciclo de vida lo gobierna MVP-P1-02, no este guard).
    if (!challengeAdmitsInitiatives(challenge.status as ChallengeStatusValue)) {
      const alreadyLinked = await this.prisma.initiativePortfolioMeta.findUnique({
        where: { projectId_challengeId: { projectId, challengeId } },
        select: { projectId: true },
      });
      if (!alreadyLinked) {
        throw AppError.conflict(
          `El reto esta en «${challenge.status}» y no admite iniciativas nuevas.`,
          'CHALLENGE_NOT_ADMITTING_INITIATIVES',
          { hint: 'Reanuda el reto para volver a recibir iniciativas.' },
        );
      }
    }

    // TASK-006 / SPEC-002 US-017 guard:
    // Block the `en_step_4 → esperando_revision` transition while any PDF autofill
    // proposal is still PENDING for this project. The founder MUST confirm,
    // edit, or discard every proposal before the initiative can move forward.
    if (input.status === 'esperando_revision') {
      const existing = await this.prisma.initiativePortfolioMeta.findUnique({
        where: { projectId_challengeId: { projectId, challengeId } },
        select: { status: true },
      });
      if (existing?.status === 'en_step_4') {
        const pending = await this.prisma.pdfFieldProposal.findMany({
          where: { projectId, status: 'PENDING' },
          select: { fieldPath: true },
        });
        if (pending.length > 0) {
          throw AppError.conflict(
            'Hay propuestas de autofill sin confirmar.',
            'AUTOFILL_UNCONFIRMED',
            {
              hint: 'Confirma, edita o descarta cada propuesta antes de avanzar.',
              details: pending.slice(0, 50).map((p) => ({
                field: p.fieldPath,
                code: 'PDF_PROPOSAL_PENDING',
                message: 'Propuesta de autofill sin resolver.',
              })),
            },
          );
        }
      }
    }

    // ADR-030: la transicion de la INICIATIVA tambien la decide el servidor. `rest` venia
    // del cliente y se escribia tal cual, asi que un PATCH podia reabrir una iniciativa
    // cerrada. Solo se valida cuando el input TRAE status: editar el owner no es transicion.
    if ((rest as any)?.status !== undefined) {
      const current = await this.prisma.initiativePortfolioMeta.findUnique({
        where: { projectId_challengeId: { projectId, challengeId } },
        select: { status: true },
      });
      if (current) {
        const check = checkInitiativeTransition(current.status as string, (rest as any).status as string);
        if (check.kind === 'illegal') {
          throw AppError.conflict(check.reason, 'INITIATIVE_ILLEGAL_TRANSITION', {
            hint: check.allowed.length
              ? `Desde «${current.status}» solo se puede pasar a: ${check.allowed.join(', ')}.`
              : 'Esta iniciativa no admite mas cambios de estado.',
          });
        }
      }
    }

    return tenantWriteTransaction(this.prisma, async (tx) => {
      const projectScope = await projectTenant(tx, projectId);
      const challengeScope = await challengeTenant(tx, challengeId);
      assertSameTenant(projectScope.organizationId, challengeScope.organizationId);
      if (input.strategicFrontId !== undefined && input.strategicFrontId !== challengeScope.strategicFrontId) {
        throw AppError.notFound('Portfolio resource', 'PORTFOLIO_RESOURCE_NOT_FOUND');
      }
      // Ligar una iniciativa a un Reto le da un Portfolio Lead que pueda decidir.
      await ensureChallengeGovernanceTx(tx, projectId, challengeId);
      return tx.initiativePortfolioMeta.upsert({
        where: { projectId_challengeId: { projectId, challengeId } },
        create: {
          projectId,
          challengeId,
          ...(rest as any),
        },
        update: rest as any,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });
    });
  }

  // ─── Overlaps ─────────────────────────────────────────────────────────────────

  async assignInitiativeGovernance(projectId: string, portfolioLeadUserId: string | null) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const { organizationId } = await projectTenant(tx, projectId);
      await assertUserInTenant(tx, portfolioLeadUserId, organizationId);
      return tx.initiativeGovernance.upsert({
        where: { projectId },
        update: { mode: 'portfolio_governed', portfolioLeadUserId },
        create: { projectId, mode: 'portfolio_governed', portfolioLeadUserId },
      });
    });
  }

  async listOverlaps(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.initiativeOverlap.findMany({
      where: { challengeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOverlap(challengeId: string, input: CreateOverlapInput) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const challengeScope = await challengeTenant(tx, challengeId);
      const first = await projectTenant(tx, input.initiativeAId);
      const second = await projectTenant(tx, input.initiativeBId);
      assertSameTenant(challengeScope.organizationId, first.organizationId);
      assertSameTenant(challengeScope.organizationId, second.organizationId);
      return tx.initiativeOverlap.create({
        data: {
          challengeId,
          ...(input as any),
        },
      });
    });
  }

  // ─── Executive Outputs ────────────────────────────────────────────────────────

  async listExecutiveOutputs(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.executiveOutput.findMany({
      where: { challengeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createExecutiveOutput(challengeId: string, input: CreateExecutiveOutputInput) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const challengeScope = await challengeTenant(tx, challengeId);
      const projectScope = await projectTenant(tx, input.projectId);
      assertSameTenant(challengeScope.organizationId, projectScope.organizationId);
      if (input.initiativeId) {
        const initiativeScope = await projectTenant(tx, input.initiativeId);
        assertSameTenant(challengeScope.organizationId, initiativeScope.organizationId);
      }
      const { projectId, sharedAt, decisionAt, ...rest } = input;

      return tx.executiveOutput.upsert({
        where: { projectId_challengeId: { projectId, challengeId } },
        create: {
          projectId,
          challengeId,
          ...(rest as any),
          sharedAt: sharedAt ? new Date(sharedAt) : undefined,
          decisionAt: decisionAt ? new Date(decisionAt) : undefined,
        },
        update: {
          ...(rest as any),
          sharedAt: sharedAt ? new Date(sharedAt) : undefined,
          decisionAt: decisionAt ? new Date(decisionAt) : undefined,
        },
      });
    });
  }

  async updateExecutiveOutput(id: string, input: UpdateExecutiveOutputInput) {
    return tenantWriteTransaction(this.prisma, async (tx) => {
      const existing = await tx.executiveOutput.findUnique({ where: { id } });
      if (!existing) throw AppError.notFound('Output ejecutivo', 'OUTPUT_NOT_FOUND', { hint: 'Verifica el ID o crea uno nuevo.' });
      const challengeScope = await challengeTenant(tx, existing.challengeId);
      const projectScope = await projectTenant(tx, existing.projectId);
      assertSameTenant(challengeScope.organizationId, projectScope.organizationId);
      if (input.initiativeId) {
        const initiativeScope = await projectTenant(tx, input.initiativeId);
        assertSameTenant(challengeScope.organizationId, initiativeScope.organizationId);
      }
      const { sharedAt, decisionAt, ...rest } = input;

      return tx.executiveOutput.update({
        where: { id },
        data: {
          ...(rest as any),
          sharedAt: sharedAt ? new Date(sharedAt) : undefined,
          decisionAt: decisionAt ? new Date(decisionAt) : undefined,
        },
      });
    });
  }
}
