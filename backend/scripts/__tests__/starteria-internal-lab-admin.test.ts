import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTERNAL_LAB_NAME,
  INTERNAL_LAB_SLUG,
  provisionStarteriaInternalLab,
} from '../starteria-internal-lab-admin.service';

type UserRow = {
  id: string;
  email: string;
  role: string;
  roles: string[];
  organizationId: string | null;
  isActive: boolean;
  updatedAt: Date;
};

function fakeDb(seed?: { custodian?: Partial<UserRow>; approver?: Partial<UserRow> }) {
  const users = new Map<string, UserRow>([
    ['custodian', {
      id: 'custodian', email: 'custodian@starteria.test', role: 'participante', roles: ['participante'],
      organizationId: null, isActive: true, updatedAt: new Date('2026-10-30T12:00:00Z'),
      ...seed?.custodian,
    }],
    ['approver', {
      id: 'approver', email: 'approver@starteria.test', role: 'admin', roles: ['admin'],
      organizationId: null, isActive: true, updatedAt: new Date('2026-10-30T12:00:00Z'),
      ...seed?.approver,
    }],
  ]);
  const organizations: any[] = [];
  const memberships: any[] = [];
  const grants: any[] = [];
  const audits: any[] = [];
  let sequence = 0;

  const tx: any = {
    $executeRaw: async () => 1,
    organization: {
      findMany: async ({ where }: any) => organizations.filter((row) => (
        where.OR.some((condition: any) => (
          (condition.name && row.name === condition.name) || (condition.slug && row.slug === condition.slug)
        ))
      )),
      create: async ({ data }: any) => {
        const row = { id: `internal-lab-${++sequence}`, seatLimit: 1, ...data };
        organizations.push(row);
        return row;
      },
    },
    user: {
      findUnique: async ({ where }: any) => users.get(where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = users.get(where.id);
        if (!row || row.organizationId !== where.organizationId || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
        users.set(row.id, { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) });
        return { count: 1 };
      },
    },
    organizationMember: {
      findMany: async ({ where }: any) => memberships.filter((row) => row.userId === where.userId && row.organizationId === where.organizationId),
      findFirst: async ({ where }: any) => memberships.find((row) => row.userId === where.userId && row.organizationId === where.organizationId) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `member-${++sequence}`, ...data };
        memberships.push(row);
        return row;
      },
    },
    organizationPortfolioAccessGrant: {
      findMany: async ({ where }: any) => grants.filter((row) => (
        row.userId === where.userId && row.organizationId === where.organizationId
          && (where.capability?.in ?? []).includes(row.capability)
      )),
      create: async ({ data }: any) => {
        const row = { id: `grant-${++sequence}`, ...data };
        grants.push(row);
        return row;
      },
    },
    auditLog: {
      findFirst: async ({ where }: any) => audits.find((row) => (
        row.action === where.action && row.resource === where.resource && row.resourceId === where.resourceId
      )) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `audit-${++sequence}`, ...data };
        audits.push(row);
        return row;
      },
    },
  };
  const db: any = { $transaction: async (fn: any) => fn(tx) };
  return { db, users, organizations, memberships, grants, audits };
}

const command = {
  custodianUserId: 'custodian',
  approvedByUserId: 'approver',
  approvalReference: 'ADR009-INTERNAL-LAB-APPROVAL-01',
};

describe('Startería Internal Lab administrative provisioning', () => {
  it('is idempotent and grants only the minimum organization-scoped Portfolio authority', async () => {
    const state = fakeDb();
    const first = await provisionStarteriaInternalLab(state.db, command);
    const replay = await provisionStarteriaInternalLab(state.db, command);

    expect(first).toMatchObject({ created: true, replayed: false });
    expect(replay).toMatchObject({ created: false, replayed: true, organizationId: first.organizationId });
    expect(state.organizations).toHaveLength(1);
    expect(state.memberships).toHaveLength(1);
    expect(state.memberships[0]).toMatchObject({ userId: 'custodian', role: 'admin' });
    expect(state.grants.map((grant) => grant.capability).sort()).toEqual(['portfolio:read', 'portfolio:write']);
    expect(state.audits).toHaveLength(1);
    expect(state.users.get('custodian')).toMatchObject({
      organizationId: first.organizationId,
      roles: ['participante', 'portfolio_lead'],
    });
    expect(state.users.get('custodian')?.roles).not.toContain('admin');
  });

  it('binds an idempotent replay to the explicitly recorded approving administrator', async () => {
    const state = fakeDb();
    await provisionStarteriaInternalLab(state.db, command);
    state.users.set('approver-2', {
      id: 'approver-2',
      email: 'approver-2@starteria.test',
      role: 'admin',
      roles: ['admin'],
      organizationId: null,
      isActive: true,
      updatedAt: new Date('2026-10-30T12:00:00Z'),
    });

    await expect(provisionStarteriaInternalLab(state.db, {
      ...command,
      approvedByUserId: 'approver-2',
    })).rejects.toMatchObject({ code: 'INTERNAL_LAB_EXISTING_ORGANIZATION_UNVERIFIED' });
    expect(state.audits).toHaveLength(1);
  });

  it('fails closed unless an active existing platform admin explicitly approves the custodian', async () => {
    const state = fakeDb({ approver: { role: 'portfolio_lead', roles: ['portfolio_lead'] } });
    await expect(provisionStarteriaInternalLab(state.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_APPROVER_AUTHORITY_REQUIRED',
    });
    expect(state.organizations).toHaveLength(0);
  });

  it('does not move a customer-scoped or global-admin custodian into the internal tenant', async () => {
    const customer = fakeDb({ custodian: { organizationId: 'customer-org' } });
    await expect(provisionStarteriaInternalLab(customer.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_CUSTODIAN_ALREADY_SCOPED',
    });
    expect(customer.organizations).toHaveLength(0);

    const globalAdmin = fakeDb({ custodian: { role: 'admin', roles: ['admin'] } });
    await expect(provisionStarteriaInternalLab(globalAdmin.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_CUSTODIAN_GLOBAL_ADMIN_FORBIDDEN',
    });
    expect(globalAdmin.organizations).toHaveLength(0);
  });

  it('never adopts a conflicting or unaudited organization row', async () => {
    const conflict = fakeDb();
    conflict.organizations.push({ id: 'customer-org', name: INTERNAL_LAB_NAME, slug: 'customer-space' });
    await expect(provisionStarteriaInternalLab(conflict.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_NAME_OR_SLUG_CONFLICT',
    });

    const unaudited = fakeDb();
    unaudited.organizations.push({ id: 'unverified-org', name: INTERNAL_LAB_NAME, slug: INTERNAL_LAB_SLUG });
    unaudited.users.set('custodian', {
      ...unaudited.users.get('custodian')!,
      organizationId: 'unverified-org',
      roles: ['participante', 'portfolio_lead'],
    });
    await expect(provisionStarteriaInternalLab(unaudited.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_EXISTING_ORGANIZATION_UNVERIFIED',
    });
  });

  it('rejects E2E identities and keeps the fixed organization outside E2E cleanup scope', async () => {
    const state = fakeDb({ custodian: { email: 'e2e-lead@starteria.test' } });
    await expect(provisionStarteriaInternalLab(state.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_E2E_IDENTITY_FORBIDDEN',
    });

    const member = fakeDb();
    member.memberships.push({ id: 'e2e-membership', userId: 'custodian', organizationId: 'org-e2e-prod', role: 'member' });
    await expect(provisionStarteriaInternalLab(member.db, command)).rejects.toMatchObject({
      code: 'INTERNAL_LAB_E2E_IDENTITY_FORBIDDEN',
    });

    const cleanup = readFileSync(resolve(process.cwd(), '../backend/scripts/e2e-prod-tenant.ts'), 'utf8');
    expect(INTERNAL_LAB_NAME).toBe('Startería Internal Lab');
    expect(INTERNAL_LAB_SLUG).toBe('starteria-internal-lab');
    expect(INTERNAL_LAB_SLUG).not.toContain('e2e');
    expect(cleanup).toContain("E2E_PROD_ORG_ID = 'org-e2e-prod'");
    expect(cleanup).not.toContain(INTERNAL_LAB_SLUG);
  });
});

describe('Startería Internal Lab protected workflow', () => {
  it('is fixed, protected, safe by default and keeps the organization id in a one-day private artifact', () => {
    const workflow = readFileSync(resolve(process.cwd(), '../.github/workflows/create-starteria-internal-lab.yml'), 'utf8');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('group: starteria-production');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('default: false');
    expect(workflow).toContain('CREATE_STARTERIA_INTERNAL_LAB');
    expect(workflow).toContain('default_transaction_read_only=on');
    expect(workflow).toContain('starteria-internal-lab-admin.ts');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('retention-days: 1');
    expect(workflow).toContain('chmod 600 "$REPORT_PATH"');
    expect(workflow).toContain('INTERNAL_LAB_REPORT_RECIPIENT_CERT_B64');
    expect(workflow).toContain('openssl x509');
    expect(workflow).toContain('openssl cms -encrypt');
    expect(workflow).toContain('starteria-internal-lab-private.p7m');
    expect(workflow).toContain('path: ${{ env.ENCRYPTED_REPORT_PATH }}');
    expect(workflow.indexOf('rm -f "$REPORT_PATH" "$RECIPIENT_CERT"')).toBeLessThan(workflow.indexOf('- name: Upload private organization report'));
    expect(workflow).toContain('rm -f "$REPORT_PATH"');
    expect(workflow).not.toMatch(/(?:cat|tee)\s+[^\n]*REPORT_PATH/i);
    expect(workflow).not.toMatch(/\b(?:migrate|deploy|db push|migrate resolve)\b/i);
    const inputs = workflow.slice(workflow.indexOf('    inputs:'), workflow.indexOf('\nconcurrency:'));
    expect(inputs).not.toMatch(/(?:organization_name|organization_slug):/i);
  });
});
