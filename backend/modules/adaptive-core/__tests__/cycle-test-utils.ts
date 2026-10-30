import { vi } from 'vitest';

export type Row = Record<string, any>;

export function createCycleStore() {
  return {
    user: [] as Row[],
    project: [] as Row[],
    teamMember: [] as Row[],
    mentorSession: [] as Row[],
    initiativePortfolioMeta: [] as Row[],
    adaptiveStepConfiguration: [] as Row[],
    adaptiveCheckpointInstance: [] as Row[],
    adaptiveCheckpointResponse: [] as Row[],
    adaptiveStepOutput: [] as Row[],
    adaptiveProgressSignal: [] as Row[],
    adaptiveAdaptationEvent: [] as Row[],
    criticalChange: [] as Row[],
    decisionRequest: [] as Row[],
    decision: [] as Row[],
    continuationRoute: [] as Row[],
    implementationHandoff: [] as Row[],
    scalingHandoff: [] as Row[],
    closureSummary: [] as Row[],
    initiativeGovernance: [] as Row[],
    initiativeCycle: [] as Row[],
    cycleStepState: [] as Row[],
    sourceRef: [] as Row[],
    truthClaim: [] as Row[],
    truthValidation: [] as Row[],
    evidence: [] as Row[],
    attentionItem: [] as Row[],
    impactAssertion: [] as Row[],
  };
}

let seq = 1;
export const testId = (prefix: string) => `${prefix}-${seq++}`;

function matches(row: Row, where: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected === null) return actual == null;
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected) return expected.in.includes(actual);
      if ('gte' in expected) return actual >= expected.gte;
      if ('gt' in expected) return actual > expected.gt;
      if ('not' in expected) return actual !== expected.not;
    }
    return actual === expected;
  });
}

function orderRows(rows: Row[], orderBy?: Row | Row[]) {
  const order = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...rows].sort((a, b) => {
    for (const item of order) {
      const [key, dir] = Object.entries(item)[0];
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (av === bv) continue;
      return dir === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    }
    return 0;
  });
}

function collection(store: ReturnType<typeof createCycleStore>, name: keyof ReturnType<typeof createCycleStore>) {
  return {
    findFirst: vi.fn(async (args: any = {}) => orderRows(store[name].filter((row) => matches(row, args.where)), args.orderBy)[0] ?? null),
    findMany: vi.fn(async (args: any = {}) => {
      const rows = orderRows(store[name].filter((row) => matches(row, args.where)), args.orderBy);
      return typeof args.take === 'number' ? rows.slice(0, args.take) : rows;
    }),
    findUnique: vi.fn(async (args: any) => {
      const where = args.where ?? {};
      if ('id' in where) return store[name].find((row) => row.id === where.id) ?? null;
      if ('projectId' in where) return store[name].find((row) => row.projectId === where.projectId) ?? null;
      if ('idempotencyKey' in where) return store[name].find((row) => row.idempotencyKey === where.idempotencyKey) ?? null;
      if ('cycleId_stepNumber' in where) {
        return store[name].find((row) => row.cycleId === where.cycleId_stepNumber.cycleId && row.stepNumber === where.cycleId_stepNumber.stepNumber) ?? null;
      }
      return store[name].find((row) => matches(row, where)) ?? null;
    }),
    create: vi.fn(async (args: any) => {
      const row = { id: testId(String(name)), createdAt: new Date(), updatedAt: new Date(), ...args.data };
      store[name].push(row);
      return row;
    }),
    update: vi.fn(async (args: any) => {
      const row = store[name].find((item) =>
        ('id' in (args.where ?? {}) && item.id === args.where.id)
        || ('projectId' in (args.where ?? {}) && item.projectId === args.where.projectId)
      );
      if (!row) throw new Error(`${String(name)} not found`);
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    }),
    updateMany: vi.fn(async (args: any) => {
      const rows = store[name].filter((row) => matches(row, args.where));
      rows.forEach((row) => Object.assign(row, args.data, { updatedAt: new Date() }));
      return { count: rows.length };
    }),
    upsert: vi.fn(async (args: any) => {
      const existing = await (collection(store, name) as any).findUnique({ where: args.where });
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: new Date() });
        return existing;
      }
      const row = { id: testId(String(name)), createdAt: new Date(), updatedAt: new Date(), ...args.create };
      store[name].push(row);
      return row;
    }),
  };
}

export function makeCyclePrisma(store = createCycleStore()) {
  const prisma: any = {
    user: collection(store, 'user'),
    project: collection(store, 'project'),
    teamMember: collection(store, 'teamMember'),
    mentorSession: collection(store, 'mentorSession'),
    initiativePortfolioMeta: collection(store, 'initiativePortfolioMeta'),
    adaptiveStepConfiguration: collection(store, 'adaptiveStepConfiguration'),
    adaptiveCheckpointInstance: collection(store, 'adaptiveCheckpointInstance'),
    adaptiveCheckpointResponse: collection(store, 'adaptiveCheckpointResponse'),
    adaptiveStepOutput: collection(store, 'adaptiveStepOutput'),
    adaptiveProgressSignal: collection(store, 'adaptiveProgressSignal'),
    adaptiveAdaptationEvent: collection(store, 'adaptiveAdaptationEvent'),
    criticalChange: collection(store, 'criticalChange'),
    decisionRequest: collection(store, 'decisionRequest'),
    decision: collection(store, 'decision'),
    continuationRoute: collection(store, 'continuationRoute'),
    implementationHandoff: collection(store, 'implementationHandoff'),
    scalingHandoff: collection(store, 'scalingHandoff'),
    closureSummary: collection(store, 'closureSummary'),
    initiativeGovernance: collection(store, 'initiativeGovernance'),
    initiativeCycle: collection(store, 'initiativeCycle'),
    cycleStepState: collection(store, 'cycleStepState'),
    sourceRef: collection(store, 'sourceRef'),
    truthClaim: collection(store, 'truthClaim'),
    truthValidation: collection(store, 'truthValidation'),
    evidence: collection(store, 'evidence'),
    attentionItem: collection(store, 'attentionItem'),
    impactAssertion: collection(store, 'impactAssertion'),
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  return prisma;
}

export function seedCycleProject(store: ReturnType<typeof createCycleStore>, overrides: Row = {}) {
  const project = {
    id: overrides.id ?? testId('project'),
    organizationId: overrides.organizationId ?? 'org-test',
    name: overrides.name ?? 'Iniciativa R3-A',
    ownerId: 'u1',
    status: overrides.status ?? 'IN_PROGRESS',
    currentStep: overrides.currentStep ?? 0,
    step0Status: overrides.step0Status ?? 'IN_PROGRESS',
    step0Data: overrides.step0Data ?? {
      challengeType: 'growth',
      contextInitial: 'Contexto inicial',
      initialFocus: 'Validar oportunidad',
      expectedImpact: 'Adopcion semanal',
      mainRisk: '',
      pendingQuestions: [],
      nextRecommendedStep: 'Completar Step 0',
    },
    teamMembers: [{ userId: 'u1', projectId: overrides.id, status: 'ACTIVE' }],
    mentorSessions: overrides.mentorSessions ?? [],
    portfolioMeta: overrides.portfolioMeta ?? [],
    contextSnapshots: [],
    steps: [],
    ...overrides,
  };
  store.project.push(project);
  for (const member of project.teamMembers) {
    if (!store.user.some((user) => user.id === member.userId)) {
      store.user.push({ id: member.userId, organizationId: project.organizationId });
    }
  }
  store.teamMember.push({ userId: 'u1', projectId: project.id, status: 'ACTIVE' });
  store.initiativePortfolioMeta.push(...(project.portfolioMeta ?? []));
  return project;
}
