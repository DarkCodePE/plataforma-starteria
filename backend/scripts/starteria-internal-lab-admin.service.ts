import { createHash } from 'node:crypto';

export const INTERNAL_LAB_NAME = 'Startería Internal Lab';
export const INTERNAL_LAB_SLUG = 'starteria-internal-lab';
export const INTERNAL_LAB_PURPOSE = 'Pruebas internas, experimentación y validación de usabilidad.';
export const INTERNAL_LAB_RETENTION = 'Persistente hasta revisión o eliminación expresamente autorizada.';
export const INTERNAL_LAB_CONFIRMATION = 'CREATE_STARTERIA_INTERNAL_LAB';
export const INTERNAL_LAB_AUDIT_ACTION = 'STARTERIA_INTERNAL_LAB_PROVISIONED';
export const E2E_PRODUCTION_ORGANIZATION_ID = 'org-e2e-prod';
export const INTERNAL_LAB_CAPABILITIES = ['portfolio:read', 'portfolio:write'] as const;

type InternalLabCommand = {
  custodianUserId: string;
  approvedByUserId: string;
  approvalReference: string;
};

type InternalLabResult = {
  organizationId: string;
  created: boolean;
  replayed: boolean;
  custodianUserId: string;
  approvedByUserId: string;
  auditLogId: string;
  capabilities: readonly string[];
};

type InternalLabPlan = {
  organizationId: string | null;
  wouldCreate: boolean;
  exactProvisioningAlreadyExists: boolean;
  custodianUserId: string;
  approvedByUserId: string;
  capabilities: readonly string[];
};

type UserRow = {
  id: string;
  email: string;
  role: string;
  roles: string[] | null;
  organizationId: string | null;
  isActive: boolean;
  updatedAt: Date;
};

type OrganizationRow = { id: string; name: string; slug: string };

export class InternalLabAdminError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'InternalLabAdminError';
  }
}

export async function inspectStarteriaInternalLab(db: any, raw: InternalLabCommand): Promise<InternalLabPlan> {
  const command = validateCommand(raw);
  return db.$transaction(async (tx: any) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const organizations = await findOrganizationCandidates(tx);
    const exact = resolveExactOrganization(organizations);
    const { custodian } = await loadAndAuthorizeActors(tx, command, exact?.id ?? null);
    if (!exact) {
      ensureUnscopedCustodian(custodian);
      return {
        organizationId: null,
        wouldCreate: true,
        exactProvisioningAlreadyExists: false,
        custodianUserId: command.custodianUserId,
        approvedByUserId: command.approvedByUserId,
        capabilities: INTERNAL_LAB_CAPABILITIES,
      };
    }
    const replay = await validateExactReplay(tx, exact, command, custodian);
    return {
      organizationId: exact.id,
      wouldCreate: false,
      exactProvisioningAlreadyExists: true,
      custodianUserId: command.custodianUserId,
      approvedByUserId: command.approvedByUserId,
      capabilities: replay.capabilities,
    };
  });
}

export async function provisionStarteriaInternalLab(db: any, raw: InternalLabCommand): Promise<InternalLabResult> {
  const command = validateCommand(raw);
  return db.$transaction(async (tx: any) => {
    // The schema deliberately has no unique slug constraint. This fixed advisory
    // lock plus SERIALIZABLE isolation prevents two approved runs from creating
    // duplicate Internal Lab rows without changing the schema.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('starteria-internal-lab-provisioning', 0))`;

    const organizations = await findOrganizationCandidates(tx);
    const exact = resolveExactOrganization(organizations);
    const { custodian } = await loadAndAuthorizeActors(tx, command, exact?.id ?? null);
    if (exact) {
      const replay = await validateExactReplay(tx, exact, command, custodian);
      return {
        organizationId: exact.id,
        created: false,
        replayed: true,
        custodianUserId: command.custodianUserId,
        approvedByUserId: command.approvedByUserId,
        auditLogId: replay.auditLogId,
        capabilities: replay.capabilities,
      };
    }

    ensureUnscopedCustodian(custodian);
    const organization = await tx.organization.create({
      data: { name: INTERNAL_LAB_NAME, slug: INTERNAL_LAB_SLUG, seatLimit: 1 },
      select: { id: true, name: true, slug: true },
    });
    if (organization.id === E2E_PRODUCTION_ORGANIZATION_ID) {
      throw new InternalLabAdminError('INTERNAL_LAB_E2E_ORGANIZATION_FORBIDDEN', 'El espacio interno no puede reutilizar el tenant E2E.');
    }

    const nextRoles = [...new Set([...effectiveRoles(custodian), 'portfolio_lead'])];
    const assignment = await tx.user.updateMany({
      where: {
        id: custodian.id,
        organizationId: null,
        isActive: true,
        updatedAt: custodian.updatedAt,
      },
      data: { organizationId: organization.id, roles: nextRoles },
    });
    if (assignment.count !== 1) {
      throw new InternalLabAdminError('INTERNAL_LAB_CUSTODIAN_CAS_CONFLICT', 'El custodio cambió durante la operación.');
    }

    await tx.organizationMember.create({
      data: { organizationId: organization.id, userId: custodian.id, role: 'admin' },
    });
    for (const capability of INTERNAL_LAB_CAPABILITIES) {
      await tx.organizationPortfolioAccessGrant.create({
        data: {
          organizationId: organization.id,
          userId: custodian.id,
          capability,
          grantedByUserId: command.approvedByUserId,
        },
      });
    }

    const audit = await tx.auditLog.create({
      data: {
        userId: command.approvedByUserId,
        action: INTERNAL_LAB_AUDIT_ACTION,
        resource: 'Organization',
        resourceId: organization.id,
        details: auditDetails(command),
      },
      select: { id: true },
    });

    return {
      organizationId: organization.id,
      created: true,
      replayed: false,
      custodianUserId: command.custodianUserId,
      approvedByUserId: command.approvedByUserId,
      auditLogId: audit.id,
      capabilities: INTERNAL_LAB_CAPABILITIES,
    };
  }, { isolationLevel: 'Serializable' });
}

function validateCommand(raw: InternalLabCommand): InternalLabCommand {
  const command = {
    custodianUserId: raw.custodianUserId?.trim(),
    approvedByUserId: raw.approvedByUserId?.trim(),
    approvalReference: raw.approvalReference?.trim(),
  };
  if (!command.custodianUserId || !command.approvedByUserId) {
    throw new InternalLabAdminError('INTERNAL_LAB_ACTORS_REQUIRED', 'Custodio y aprobador son obligatorios.');
  }
  if (command.custodianUserId === command.approvedByUserId) {
    throw new InternalLabAdminError('INTERNAL_LAB_SEPARATION_OF_DUTIES_REQUIRED', 'Custodio y aprobador deben ser identidades distintas.');
  }
  if (!/^ADR009-[A-Z0-9._-]{8,120}$/.test(command.approvalReference)) {
    throw new InternalLabAdminError('INTERNAL_LAB_APPROVAL_REFERENCE_INVALID', 'La referencia de aprobación no cumple el formato ADR009-* requerido.');
  }
  return command;
}

async function findOrganizationCandidates(tx: any): Promise<OrganizationRow[]> {
  return tx.organization.findMany({
    where: { OR: [{ name: INTERNAL_LAB_NAME }, { slug: INTERNAL_LAB_SLUG }] },
    select: { id: true, name: true, slug: true },
  });
}

function resolveExactOrganization(rows: OrganizationRow[]): OrganizationRow | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1 || rows[0].name !== INTERNAL_LAB_NAME || rows[0].slug !== INTERNAL_LAB_SLUG) {
    throw new InternalLabAdminError('INTERNAL_LAB_NAME_OR_SLUG_CONFLICT', 'El nombre o slug ya corresponde a otra organización.');
  }
  if (rows[0].id === E2E_PRODUCTION_ORGANIZATION_ID) {
    throw new InternalLabAdminError('INTERNAL_LAB_E2E_ORGANIZATION_FORBIDDEN', 'El espacio interno no puede reutilizar el tenant E2E.');
  }
  return rows[0];
}

async function loadAndAuthorizeActors(tx: any, command: InternalLabCommand, exactOrganizationId: string | null) {
  const [custodian, approver] = await Promise.all([
    tx.user.findUnique({ where: { id: command.custodianUserId }, select: userSelection }),
    tx.user.findUnique({ where: { id: command.approvedByUserId }, select: userSelection }),
  ]) as [UserRow | null, UserRow | null];
  if (!custodian?.isActive) {
    throw new InternalLabAdminError('INTERNAL_LAB_CUSTODIAN_NOT_FOUND', 'El custodio debe existir y estar activo.');
  }
  if (!approver?.isActive || !effectiveRoles(approver).includes('admin')) {
    throw new InternalLabAdminError('INTERNAL_LAB_APPROVER_AUTHORITY_REQUIRED', 'La operación requiere un aprobador de plataforma activo.');
  }
  if (effectiveRoles(custodian).includes('admin')) {
    throw new InternalLabAdminError('INTERNAL_LAB_CUSTODIAN_GLOBAL_ADMIN_FORBIDDEN', 'El custodio no recibirá ni reutilizará autoridad global admin.');
  }
  const e2eMembership = await tx.organizationMember.findFirst({
    where: { userId: custodian.id, organizationId: E2E_PRODUCTION_ORGANIZATION_ID },
    select: { id: true },
  });
  if (isE2EIdentity(custodian) || custodian.organizationId === E2E_PRODUCTION_ORGANIZATION_ID || e2eMembership) {
    throw new InternalLabAdminError('INTERNAL_LAB_E2E_IDENTITY_FORBIDDEN', 'El custodio no puede ser una identidad E2E.');
  }
  if (custodian.organizationId && custodian.organizationId !== exactOrganizationId) {
    throw new InternalLabAdminError('INTERNAL_LAB_CUSTODIAN_ALREADY_SCOPED', 'El custodio ya pertenece a otro tenant y no se moverá automáticamente.');
  }
  return { custodian, approver };
}

function ensureUnscopedCustodian(custodian: UserRow) {
  if (custodian.organizationId !== null) {
    throw new InternalLabAdminError('INTERNAL_LAB_CUSTODIAN_ALREADY_SCOPED', 'El custodio debe estar sin tenant antes de la primera provisión.');
  }
}

async function validateExactReplay(tx: any, organization: OrganizationRow, command: InternalLabCommand, custodian: UserRow) {
  const audit = await tx.auditLog.findFirst({
    where: {
      action: INTERNAL_LAB_AUDIT_ACTION,
      resource: 'Organization',
      resourceId: organization.id,
    },
    select: { id: true, details: true },
  });
  if (!audit || (audit.details as any)?.intentFingerprint !== intentFingerprint(command)) {
    throw new InternalLabAdminError('INTERNAL_LAB_EXISTING_ORGANIZATION_UNVERIFIED', 'La organización existente no corresponde a esta operación aprobada.');
  }
  const [memberships, grants] = await Promise.all([
    tx.organizationMember.findMany({
      where: { organizationId: organization.id, userId: custodian.id },
      select: { id: true, role: true },
    }),
    tx.organizationPortfolioAccessGrant.findMany({
      where: {
        organizationId: organization.id,
        userId: custodian.id,
        capability: { in: [...INTERNAL_LAB_CAPABILITIES] },
      },
      select: { id: true, capability: true },
    }),
  ]);
  const capabilitySet = new Set(grants.map((grant: any) => grant.capability));
  const complete = custodian.organizationId === organization.id
    && effectiveRoles(custodian).includes('portfolio_lead')
    && !effectiveRoles(custodian).includes('admin')
    && memberships.length === 1
    && memberships[0].role === 'admin'
    && grants.length === INTERNAL_LAB_CAPABILITIES.length
    && INTERNAL_LAB_CAPABILITIES.every((capability) => capabilitySet.has(capability));
  if (!complete) {
    throw new InternalLabAdminError('INTERNAL_LAB_PARTIAL_PROVISIONING_DETECTED', 'El estado existente es parcial y requiere revisión humana; no se repara automáticamente.');
  }
  return { auditLogId: audit.id, capabilities: INTERNAL_LAB_CAPABILITIES };
}

function auditDetails(command: InternalLabCommand) {
  return {
    operation: 'STARTERIA_INTERNAL_LAB_PROVISIONING_V1',
    intentFingerprint: intentFingerprint(command),
    approvalReference: command.approvalReference,
    custodianUserId: command.custodianUserId,
    approvedByUserId: command.approvedByUserId,
    classification: 'SYNTHETIC_INTERNAL_MVP_TEST',
    purpose: INTERNAL_LAB_PURPOSE,
    retention: INTERNAL_LAB_RETENTION,
    e2eCleanupExcluded: true,
    portfolioCapabilities: INTERNAL_LAB_CAPABILITIES,
  };
}

function intentFingerprint(command: InternalLabCommand): string {
  return createHash('sha256').update(JSON.stringify({
    operation: 'STARTERIA_INTERNAL_LAB_PROVISIONING_V1',
    organizationName: INTERNAL_LAB_NAME,
    organizationSlug: INTERNAL_LAB_SLUG,
    custodianUserId: command.custodianUserId,
    approvedByUserId: command.approvedByUserId,
    approvalReference: command.approvalReference,
  })).digest('hex');
}

function effectiveRoles(user: Pick<UserRow, 'role' | 'roles'>): string[] {
  return user.roles && user.roles.length > 0 ? [...user.roles] : [user.role];
}

function isE2EIdentity(user: Pick<UserRow, 'id' | 'email'>): boolean {
  const email = user.email.trim().toLowerCase();
  return /^e2e-[^@]*@starteria\.test$/.test(email) || /^e2e[-_]/i.test(user.id);
}

const userSelection = {
  id: true,
  email: true,
  role: true,
  roles: true,
  organizationId: true,
  isActive: true,
  updatedAt: true,
};
