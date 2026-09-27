import type { PrismaClient } from '@prisma/client';
import { AuthSessionService } from '../../modules/auth/auth-session.service';
import { can, type Permission } from '../authz/permissions';
import { ScopedPortfolioAccessService } from '../authz/scoped-portfolio-access.service';
import { PortfolioContextSelectionStore } from './portfolio-context-selection.store';
import type {
  AuthorizedPortfolioContext,
  PortfolioContextActor,
  PortfolioContextOption,
  PortfolioContextResolution,
  PortfolioContextView,
} from './portfolio-context.types';

type MembershipDb = Pick<PrismaClient, 'organizationMember'>;

export class PortfolioContextAuthorityService {
  private readonly sessions: AuthSessionService;
  private readonly scopedAccess: ScopedPortfolioAccessService;

  constructor(
    private readonly prisma: MembershipDb,
    private readonly store: PortfolioContextSelectionStore,
    authSessionService: AuthSessionService,
    scopedAccessService: ScopedPortfolioAccessService,
  ) {
    this.sessions = authSessionService;
    this.scopedAccess = scopedAccessService;
  }

  async resolve(actor: PortfolioContextActor): Promise<PortfolioContextResolution> {
    if (!actor.authSessionId) return { status: 'no_context' };

    if (!(await this.sessions.isAuthSessionActive({
      actorUserId: actor.actorUserId,
      authSessionId: actor.authSessionId,
    }))) {
      await this.store.invalidateSelection({ authSessionId: actor.authSessionId, reason: 'auth_session_inactive' });
      return { status: 'not_authorized' };
    }

    const selection = await this.store.getActiveSelection(actor.authSessionId);
    if (selection) {
      if (selection.actorUserId !== actor.actorUserId) {
        await this.store.invalidateSelection({ authSessionId: actor.authSessionId, reason: 'actor_mismatch' });
        return { status: 'not_authorized' };
      }
      return this.resolveSelected(actor, selection.organizationId);
    }

    if (await this.store.hasInvalidatedSelection(actor.authSessionId)) {
      return { status: 'not_authorized' };
    }

    const organizations = await this.listAuthorizedOrganizations(actor);
    if (organizations.length === 0) return { status: 'no_context' };
    if (organizations.length > 1) return { status: 'context_selection_required' };

    await this.store.setSelection({
      authSessionId: actor.authSessionId,
      actorUserId: actor.actorUserId,
      organizationId: organizations[0].organizationId,
    });
    return this.resolveSelected(actor, organizations[0].organizationId);
  }

  async select(actor: PortfolioContextActor, organizationId: string): Promise<PortfolioContextResolution> {
    if (!actor.authSessionId) return { status: 'no_context' };
    if (!(await this.sessions.isAuthSessionActive({
      actorUserId: actor.actorUserId,
      authSessionId: actor.authSessionId,
    }))) {
      return { status: 'not_authorized' };
    }

    const authorization = await this.validateOrganization(actor, organizationId);
    if (!authorization) return { status: 'not_authorized' };

    await this.store.setSelection({
      authSessionId: actor.authSessionId,
      actorUserId: actor.actorUserId,
      organizationId,
    });
    return this.resolveSelected(actor, organizationId);
  }

  async view(actor: PortfolioContextActor, resolution?: PortfolioContextResolution): Promise<PortfolioContextView> {
    const resolved = resolution ?? await this.resolve(actor);
    if (!actor.authSessionId) return { status: resolved.status, options: [] };
    const options = await this.listAuthorizedOrganizations(actor);
    const currentOrganizationId = resolved.status === 'available' ? resolved.context.organizationId : undefined;
    const current = options.find((option) => option.organizationId === currentOrganizationId);
    return { status: resolved.status, ...(current ? { current } : {}), options };
  }

  async clear(actor: PortfolioContextActor): Promise<PortfolioContextResolution> {
    if (!actor.authSessionId) return { status: 'no_context' };
    await this.store.clearSelection(actor.authSessionId);
    return { status: 'no_context' };
  }

  private async resolveSelected(actor: PortfolioContextActor, organizationId: string): Promise<PortfolioContextResolution> {
    const authoritySource = await this.validateOrganization(actor, organizationId);
    if (!authoritySource) {
      await this.store.invalidateSelection({ authSessionId: actor.authSessionId!, reason: 'portfolio_authority_revoked' });
      return { status: 'not_authorized' };
    }

    const context: AuthorizedPortfolioContext = {
      actorUserId: actor.actorUserId,
      authSessionId: actor.authSessionId!,
      organizationId,
      authoritySource,
      validatedAt: new Date(),
    };
    return { status: 'available', context };
  }

  private async validateOrganization(actor: PortfolioContextActor, organizationId: string): Promise<'global' | 'scoped' | null> {
    if (!organizationId) return null;
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: actor.actorUserId, organizationId },
      select: { organizationId: true },
    });
    if (!membership) return null;

    if (can(actor.permissions, 'portfolio:read')) return 'global';
    return (await this.scopedAccess.canUserAccessPortfolio({
      userId: actor.actorUserId,
      organizationId,
      capability: 'portfolio:read',
    })) ? 'scoped' : null;
  }

  async listAuthorizedOrganizations(actor: PortfolioContextActor): Promise<PortfolioContextOption[]> {
    if (can(actor.permissions, 'portfolio:read')) {
      const memberships = await this.prisma.organizationMember.findMany({
        where: { userId: actor.actorUserId },
        select: { organizationId: true, organization: { select: { id: true, name: true } } },
      });
      return uniqueOrganizations(memberships
        .map((membership) => ({ organizationId: membership.organization.id, name: membership.organization.name })));
    }

    const organizations = await this.scopedAccess.listAccessibleOrganizations({
      userId: actor.actorUserId,
      capability: 'portfolio:read',
    });
    return uniqueOrganizations(organizations);
  }
}

function uniqueOrganizations(organizations: Array<{ organizationId: string; name: string }>): Array<{ organizationId: string; name: string }> {
  return [...new Map(organizations.map((organization) => [organization.organizationId, organization])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createPortfolioContextAuthorityService(prisma: PrismaClient): PortfolioContextAuthorityService {
  return new PortfolioContextAuthorityService(
    prisma,
    new PortfolioContextSelectionStore(prisma),
    new AuthSessionService(prisma),
    new ScopedPortfolioAccessService(prisma),
  );
}
