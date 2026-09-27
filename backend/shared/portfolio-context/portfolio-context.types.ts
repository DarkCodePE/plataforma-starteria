import type { Permission } from '../authz/permissions';

export type PortfolioContextActor = {
  actorUserId: string;
  authSessionId?: string;
  permissions: ReadonlySet<Permission>;
};

export type AuthorizedPortfolioContext = {
  actorUserId: string;
  authSessionId: string;
  organizationId: string;
  authoritySource: 'global' | 'scoped';
  validatedAt: Date;
};

export type PortfolioContextResolution =
  | { status: 'available'; context: AuthorizedPortfolioContext }
  | { status: 'no_context' }
  | { status: 'context_selection_required' }
  | { status: 'not_authorized' };

export type PortfolioContextSelectionRecord = {
  authSessionId: string;
  actorUserId: string;
  organizationId: string;
  selectedAt: Date;
  updatedAt: Date;
  invalidatedAt: Date | null;
  invalidationReason: string | null;
};
