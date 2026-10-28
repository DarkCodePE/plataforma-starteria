import { describe, expect, it, vi } from 'vitest';
import { TruthService } from '../truth.service';

const projectId = 'cproject0000000000000000';
const otherProjectId = 'cproject1111111111111111';
const actor = { id: 'cuser0000000000000000000', role: 'participante' };
const validatorActor = { id: 'cmentor00000000000000000', role: 'mentor' };

function makePrisma() {
  const store: any = {
    projects: [{ id: projectId }, { id: otherProjectId }],
    sourceRefs: [],
    claims: [],
    evidence: [],
    validations: [],
    attentionItems: [],
    impacts: [],
  };
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${++seq}`;
  const hydrateEvidence = (row: any) => row
    ? {
        ...row,
        sourceRef: row.sourceRefId ? store.sourceRefs.find((source: any) => source.id === row.sourceRefId) ?? null : null,
        targetClaim: row.targetClaimId ? store.claims.find((claim: any) => claim.id === row.targetClaimId) ?? null : null,
      }
    : null;
  const hydrateValidation = (row: any) => row
    ? {
        ...row,
        claim: row.claimId ? store.claims.find((claim: any) => claim.id === row.claimId) ?? null : null,
        evidence: row.evidenceId ? hydrateEvidence(store.evidence.find((ev: any) => ev.id === row.evidenceId)) : null,
      }
    : null;
  const whereMatch = (row: any, where: any): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR') return value.some((item: any) => whereMatch(row, item));
      if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
      return row[key] === value;
    });
  };
  const order = (rows: any[], orderBy: any) => {
    if (!orderBy) return rows;
    const [field, dir] = Object.entries(orderBy)[0] as [string, string];
    return [...rows].sort((a, b) => dir === 'desc' ? Number(b[field] ?? 0) - Number(a[field] ?? 0) : Number(a[field] ?? 0) - Number(b[field] ?? 0));
  };

  return {
    store,
    prisma: {
      project: {
        findUnique: vi.fn(async ({ where }: any) => store.projects.find((p: any) => p.id === where.id) ?? null),
      },
      sourceRef: {
        create: vi.fn(async ({ data }: any) => {
          const { project, ...rest } = data;
          const row = { id: id('src'), ...rest, projectId: project?.connect?.id, createdAt: new Date(), updatedAt: new Date() };
          store.sourceRefs.push(row);
          return row;
        }),
        findMany: vi.fn(async ({ where }: any) => store.sourceRefs.filter((row: any) => whereMatch(row, where))),
      },
      truthClaim: {
        create: vi.fn(async ({ data }: any) => {
          const row = { id: id('claim'), verificationState: 'unvalidated', ...data, createdAt: new Date(), updatedAt: new Date() };
          store.claims.push(row);
          return row;
        }),
        findFirst: vi.fn(async ({ where }: any) => store.claims.find((row: any) => whereMatch(row, where)) ?? null),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.claims.find((claim: any) => claim.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      evidence: {
        create: vi.fn(async ({ data }: any) => {
          const row = { id: id('ev'), ...data, createdAt: new Date(), updatedAt: new Date() };
          store.evidence.push(row);
          return hydrateEvidence(row);
        }),
        findMany: vi.fn(async ({ where }: any) => store.evidence.filter((row: any) => whereMatch(row, where)).map(hydrateEvidence)),
        findFirst: vi.fn(async ({ where }: any) => hydrateEvidence(store.evidence.find((row: any) => whereMatch(row, where)) ?? null)),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.evidence.find((ev: any) => ev.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      truthValidation: {
        create: vi.fn(async ({ data }: any) => {
          const row = { id: id('val'), ...data, createdAt: new Date(), validatedAt: new Date() };
          store.validations.push(row);
          return row;
        }),
        findFirst: vi.fn(async ({ where, orderBy }: any) => hydrateValidation(order(store.validations.filter((row: any) => whereMatch(row, where)), orderBy)[0] ?? null)),
      },
      attentionItem: {
        create: vi.fn(async ({ data }: any) => {
          const { project, sourceRef, ...rest } = data;
          const row = { id: id('att'), status: 'open', ...rest, projectId: project?.connect?.id, sourceRefId: sourceRef?.connect?.id, createdAt: new Date(), updatedAt: new Date() };
          store.attentionItems.push(row);
          return row;
        }),
        findMany: vi.fn(async ({ where }: any) => store.attentionItems.filter((row: any) => whereMatch(row, where))),
        findFirst: vi.fn(async ({ where }: any) => store.attentionItems.find((row: any) => whereMatch(row, where)) ?? null),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.attentionItems.find((item: any) => item.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      impactAssertion: {
        create: vi.fn(async ({ data }: any) => {
          const row = { id: id('impact'), ...data, createdAt: new Date(), updatedAt: new Date() };
          store.impacts.push(row);
          return row;
        }),
        findFirst: vi.fn(async ({ where }: any) => store.impacts.find((row: any) => whereMatch(row, where)) ?? null),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.impacts.find((impact: any) => impact.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
    },
  };
}

describe('TruthService R1 truth foundation', () => {
  it('stores a user claim as unvalidated until evidence and validation exist', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const claim = await service.createClaim({
      projectId,
      subjectType: 'initiative',
      claimType: 'impact',
      statement: 'Reduciremos 20% el retrabajo.',
      createdByType: 'human',
      sourceRefIds: [],
    }, actor);

    expect(claim.verificationState).toBe('unvalidated');
    await expect(service.getClaimReadiness(projectId, claim.id)).resolves.toMatchObject({
      satisfiesValidatedSupport: false,
    });
  });

  it('preserves source and provenance when attaching evidence', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'PDF_PROPOSAL', reference: 'pdf-1', location: 'page 2' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'problem', statement: 'Hay demora', createdByType: 'human', sourceRefIds: [source.id] }, actor);

    const evidence = await service.attachEvidence({
      projectId,
      targetClaimId: claim.id,
      sourceRefId: source.id,
      name: 'Entrevista operaciones',
      evidenceType: 'PDF',
      truthStatus: 'supports',
      stepRef: 1,
      provenance: { pageNumbers: [2], quotedExcerpt: 'demora semanal' },
    }, actor);

    expect(evidence.sourceRefId).toBe(source.id);
    expect(evidence.provenance).toMatchObject({ pageNumbers: [2] });
  });

  it('persists attributable validation and updates claim readiness', async () => {
    const { prisma, store } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'interview-1' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Usuarios pierden tiempo', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Nota de entrevista', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    const validation = await service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'supported',
      validatorType: 'human',
      validatorRole: 'mentor',
      rationale: 'La entrevista identifica el patron.',
    }, { id: 'mentor-1', role: 'mentor' });

    expect(validation).toMatchObject({ validatedById: 'mentor-1', validatorRole: 'mentor', result: 'supported' });
    expect(store.claims[0].verificationState).toBe('supported');
    await expect(service.getClaimReadiness(projectId, claim.id)).resolves.toMatchObject({ satisfiesValidatedSupport: true });
  });

  it('derives validator identity, type and role from the trusted actor instead of spoofable payload fields', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'interview-spoof' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim', createdByType: 'ai', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Evidence', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    const validation = await service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'supported',
      validatorType: 'ai',
      validatorRole: 'admin',
      rationale: 'Intento de suplantacion.',
    }, { id: 'real-mentor', role: 'mentor', type: 'human' });

    expect(validation).toMatchObject({
      validatedById: 'real-mentor',
      validatorType: 'human',
      validatorRole: 'mentor',
    });
    expect(claim.createdByType).toBe('human');
  });

  it('increments validation versions for evidence-only validation streams', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'evidence-version' }, actor);
    const evidence = await service.attachEvidence({ projectId, sourceRefId: source.id, name: 'Evidence only', evidenceType: 'OTHER', truthStatus: 'insufficient', stepRef: 1 }, actor);

    const first = await service.recordValidation({ projectId, evidenceId: evidence.id, result: 'insufficient', validatorType: 'human' }, validatorActor);
    const second = await service.recordValidation({ projectId, evidenceId: evidence.id, result: 'contradicted', validatorType: 'human' }, validatorActor);

    expect([first.version, second.version]).toEqual([1, 2]);
  });

  it('rejects a stale expectedVersion under the validation stream lock', async () => {
    const { prisma, store } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'cas-source' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'CAS claim', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'CAS evidence', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);
    await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'supported', validatorType: 'human', rationale: 'First.', expectedVersion: 0 }, validatorActor);

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'contradicted',
      validatorType: 'human',
      rationale: 'Stale.',
      expectedVersion: 0,
    }, validatorActor)).rejects.toMatchObject({ code: 'STALE_VERSION' });
    expect(store.validations).toHaveLength(1);
  });

  it('keeps contradicted and insufficient evidence from satisfying validation-required gates', async () => {
    const { prisma, store } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'metric-1' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'metric', statement: 'La metrica mejoro', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Metrica', evidenceType: 'OTHER', truthStatus: 'contradicts', stepRef: 3 }, actor);

    await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'contradicted', validatorType: 'system_rule', rationale: 'La metrica no alcanza el umbral.' }, { id: 'rule-r1', role: 'system_rule', type: 'system' });

    expect(store.evidence[0].truthStatus).toBe('contradicts');
    await expect(service.getClaimReadiness(projectId, claim.id)).resolves.toMatchObject({
      verificationState: 'contradicted',
      satisfiesValidatedSupport: false,
    });
  });

  it('rejects AI promotion of a claim to supported', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Impacto validado por texto', createdByType: 'ai', sourceRefIds: [] }, { id: 'ai-agent', type: 'ai' });

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      result: 'supported',
      validatorType: 'ai',
      rationale: 'Suena convincente.',
    }, { id: 'ai-agent', type: 'ai' })).rejects.toMatchObject({ code: 'AI_CANNOT_VALIDATE_CLAIM' });
  });

  it('rejects supported without evidence', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Impacto declarado', createdByType: 'human', sourceRefIds: [] }, actor);

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      result: 'supported',
      validatorType: 'human',
      rationale: 'No adjunta evidencia.',
    }, actor)).rejects.toMatchObject({ code: 'SUPPORTED_EVIDENCE_REQUIRED' });
  });

  it('rejects supported with evidence linked to another claim', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'interview-2' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'problem', statement: 'Claim A', createdByType: 'human', sourceRefIds: [] }, actor);
    const otherClaim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'problem', statement: 'Claim B', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: otherClaim.id, sourceRefId: source.id, name: 'Nota', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'supported',
      validatorType: 'human',
      rationale: 'Evidencia cruzada.',
    }, actor)).rejects.toMatchObject({ code: 'EVIDENCE_CLAIM_MISMATCH' });
  });

  it('rejects supported with evidence from another project', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId: otherProjectId, sourceType: 'USER_INPUT', reference: 'interview-other' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Claim local', createdByType: 'human', sourceRefIds: [] }, actor);
    const otherClaim = await service.createClaim({ projectId: otherProjectId, subjectType: 'initiative', claimType: 'impact', statement: 'Claim externo', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId: otherProjectId, targetClaimId: otherClaim.id, sourceRefId: source.id, name: 'Nota externa', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'supported',
      validatorType: 'human',
      rationale: 'Evidencia externa.',
    }, actor)).rejects.toMatchObject({ code: 'EVIDENCE_NOT_FOUND' });
  });

  it('rejects supported with contradictory evidence', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'metric-contradicts' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'metric', statement: 'La metrica mejoro', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Metrica', evidenceType: 'OTHER', truthStatus: 'contradicts', stepRef: 3 }, actor);

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'supported',
      validatorType: 'human',
      rationale: 'Intenta soportar con contradiccion.',
    }, actor)).rejects.toMatchObject({ code: 'SUPPORTED_EVIDENCE_STATUS_INVALID' });
  });

  it('rejects supported with missing source provenance', async () => {
    const { prisma, store } = makePrisma();
    const service = new TruthService(prisma as any);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Claim con evidencia corrupta', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = { id: 'ev-dangling-source', projectId, targetClaimId: claim.id, sourceRefId: 'src-missing', truthStatus: 'supports' };
    store.evidence.push(evidence);

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: 'supported',
      validatorType: 'human',
      rationale: 'SourceRef no existe.',
    }, actor)).rejects.toMatchObject({ code: 'EVIDENCE_SOURCE_REF_NOT_FOUND' });
  });

  it('rejects AI final validation states beyond supported', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Texto IA', createdByType: 'ai', sourceRefIds: [] }, { id: 'ai-agent', type: 'ai' });

    await expect(service.recordValidation({
      projectId,
      claimId: claim.id,
      result: 'contradicted',
      validatorType: 'ai',
      rationale: 'La IA detecta contradiccion.',
    }, { id: 'ai-agent', type: 'ai' })).rejects.toMatchObject({ code: 'AI_CANNOT_VALIDATE_CLAIM' });
  });

  it('persists blocker after a new read and requires explicit resolution', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const blocker = await service.createAttentionItem({
      projectId,
      category: 'dependency',
      reason: 'Falta acceso a datos.',
      severity: 'high',
      exitCondition: 'Acceso aprobado por owner de datos.',
      nextAction: 'Solicitar permiso.',
    });

    await expect(service.listAttentionItems(projectId)).resolves.toHaveLength(1);
    const resolved = await service.resolveAttentionItem(projectId, blocker.id, { status: 'resolved', resolutionNote: 'Permiso concedido.' }, actor);
    expect(resolved).toMatchObject({ status: 'resolved', resolvedById: actor.id });
    await expect(service.resolveAttentionItem(projectId, blocker.id, { status: 'resolved', resolutionNote: 'Cerrar de nuevo.' }, actor)).rejects.toMatchObject({ code: 'ATTENTION_ITEM_ALREADY_CLOSED' });
  });

  it('prevents impact from jumping from declared or estimated to realized', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const impact = await service.createImpactAssertion({
      projectId,
      subjectType: 'initiative',
      metric: 'Horas ahorradas',
      status: 'declared',
      valueJson: { expected: 40 },
    }, actor);

    await expect(service.transitionImpact(projectId, impact.id, { status: 'realized' }, actor)).rejects.toMatchObject({
      code: 'IMPACT_REALIZED_REQUIRES_VALIDATED',
    });
    const estimated = await service.transitionImpact(projectId, impact.id, { status: 'estimated' }, actor);
    expect(estimated.status).toBe('estimated');
    await expect(service.transitionImpact(projectId, impact.id, { status: 'realized' }, actor)).rejects.toMatchObject({
      code: 'IMPACT_REALIZED_REQUIRES_VALIDATED',
    });
  });

  it('rejects impact validated transition with random validationId', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const impact = await service.createImpactAssertion({ projectId, subjectType: 'initiative', metric: 'Horas', status: 'declared' }, actor);

    await expect(service.transitionImpact(projectId, impact.id, { status: 'validated', validationId: 'val-random' }, actor))
      .rejects.toMatchObject({ code: 'IMPACT_VALIDATION_NOT_FOUND' });
  });

  it('rejects impact validated transition with validation from another project', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId: otherProjectId, sourceType: 'API', reference: 'other-metric' }, actor);
    const claim = await service.createClaim({ projectId: otherProjectId, subjectType: 'initiative', claimType: 'impact', statement: 'Impacto externo', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId: otherProjectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Metrica externa', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 3 }, actor);
    const validation = await service.recordValidation({ projectId: otherProjectId, claimId: claim.id, evidenceId: evidence.id, result: 'supported', validatorType: 'human', rationale: 'Soportado externo.' }, validatorActor);
    const impact = await service.createImpactAssertion({ projectId, subjectType: 'initiative', metric: 'Horas', status: 'declared' }, actor);

    await expect(service.transitionImpact(projectId, impact.id, { status: 'validated', validationId: validation.id }, actor))
      .rejects.toMatchObject({ code: 'IMPACT_VALIDATION_NOT_FOUND' });
  });

  it('rejects impact validated transition with contradicted validation', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'metric-negative' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Impacto no demostrado', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Metrica negativa', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 3 }, actor);
    const validation = await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'contradicted', validatorType: 'human', rationale: 'La metrica contradice.' }, validatorActor);
    const impact = await service.createImpactAssertion({ projectId, subjectType: 'initiative', claimId: claim.id, metric: 'Horas', status: 'declared' }, actor);

    await expect(service.transitionImpact(projectId, impact.id, { status: 'validated', validationId: validation.id }, actor))
      .rejects.toMatchObject({ code: 'IMPACT_VALIDATION_RESULT_INVALID' });
  });

  it('allows impact validated transition with coherent supported validation', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'metric-positive' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'impact', statement: 'Impacto demostrado', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Metrica positiva', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 3 }, actor);
    const validation = await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'supported', validatorType: 'human', rationale: 'La metrica soporta.' }, validatorActor);
    const impact = await service.createImpactAssertion({ projectId, subjectType: 'initiative', claimId: claim.id, metric: 'Horas', status: 'declared' }, actor);

    await expect(service.transitionImpact(projectId, impact.id, { status: 'validated', validationId: validation.id }, actor))
      .resolves.toMatchObject({ status: 'validated', validationId: validation.id });
  });

  it('evaluates evidence reference integrity without requiring validated support', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'result-log' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'metric', statement: 'El resultado se midio', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Resultado piloto', evidenceType: 'OTHER', truthStatus: 'contradicts', stepRef: 3 }, actor);

    await expect(service.evaluateEvidenceReferenceBinding(projectId, {
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    })).resolves.toEqual({
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    });
  });

  it('rejects missing or cross-project evidence references', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const otherSource = await service.createSourceRef({ projectId: otherProjectId, sourceType: 'API', reference: 'other-source' }, actor);
    const otherClaim = await service.createClaim({ projectId: otherProjectId, subjectType: 'initiative', claimType: 'metric', statement: 'Externo', createdByType: 'human', sourceRefIds: [] }, actor);
    const otherEvidence = await service.attachEvidence({ projectId: otherProjectId, targetClaimId: otherClaim.id, sourceRefId: otherSource.id, name: 'Externa', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 3 }, actor);

    await expect(service.evaluateEvidenceReferenceBinding(projectId, {
      evidenceIds: ['missing-evidence'],
      sourceRefIds: [otherSource.id],
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });
    await expect(service.evaluateEvidenceReferenceBinding(projectId, {
      evidenceIds: [otherEvidence.id],
      sourceRefIds: [otherSource.id],
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });
  });

  it('rejects missing source refs and Evidence to SourceRef mismatches', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'result-source' }, actor);
    const otherSource = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'other-result-source' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'metric', statement: 'El resultado se midio', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Resultado piloto', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 3 }, actor);

    await expect(service.evaluateEvidenceReferenceBinding(projectId, {
      evidenceIds: [evidence.id],
      sourceRefIds: ['missing-source'],
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_SOURCE_REF_NOT_FOUND' });
    await expect(service.evaluateEvidenceReferenceBinding(projectId, {
      evidenceIds: [evidence.id],
      sourceRefIds: [otherSource.id],
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_SOURCE_MISMATCH' });
  });

  it('evaluates a coherent supported binding without replacing getClaimReadiness as authority', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'interview-supported' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'El foco esta soportado', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Entrevista', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);
    await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'supported', validatorType: 'human', rationale: 'Coherente.' }, validatorActor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    })).resolves.toMatchObject({
      claimId: claim.id,
      verificationState: 'supported',
      satisfiesValidatedSupport: true,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    });
  });

  it('preserves contradicted readiness for coherent contradicted bindings', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'API', reference: 'metric-contradicted-binding' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'metric', statement: 'La metrica mejoro', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Metrica', evidenceType: 'OTHER', truthStatus: 'contradicts', stepRef: 1 }, actor);
    await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'contradicted', validatorType: 'human', rationale: 'Contradice.' }, validatorActor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    })).resolves.toMatchObject({
      verificationState: 'contradicted',
      satisfiesValidatedSupport: false,
    });
  });

  it('preserves insufficient readiness for coherent insufficient bindings', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'note-insufficient-binding' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'La evidencia basta', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Nota parcial', evidenceType: 'OTHER', truthStatus: 'insufficient', stepRef: 1 }, actor);
    await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'insufficient', validatorType: 'human', rationale: 'No alcanza.' }, validatorActor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    })).resolves.toMatchObject({
      verificationState: 'insufficient',
      satisfiesValidatedSupport: false,
    });
  });

  it('rejects missing or cross-project claim bindings', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const otherClaim = await service.createClaim({ projectId: otherProjectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Externo', createdByType: 'human', sourceRefIds: [] }, actor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: 'claim-missing',
      evidenceIds: ['ev-any'],
      sourceRefIds: ['src-any'],
    })).rejects.toMatchObject({ code: 'TRUTH_CLAIM_NOT_FOUND' });
    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: otherClaim.id,
      evidenceIds: ['ev-any'],
      sourceRefIds: ['src-any'],
    })).rejects.toMatchObject({ code: 'TRUTH_CLAIM_NOT_FOUND' });
  });

  it('rejects missing or cross-project Evidence bindings', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'source-local' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Local', createdByType: 'human', sourceRefIds: [] }, actor);
    const otherSource = await service.createSourceRef({ projectId: otherProjectId, sourceType: 'USER_INPUT', reference: 'source-other' }, actor);
    const otherClaim = await service.createClaim({ projectId: otherProjectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Other', createdByType: 'human', sourceRefIds: [] }, actor);
    const otherEvidence = await service.attachEvidence({ projectId: otherProjectId, targetClaimId: otherClaim.id, sourceRefId: otherSource.id, name: 'Otra evidencia', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: ['ev-missing'],
      sourceRefIds: [source.id],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_EVIDENCE_NOT_FOUND' });
    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [otherEvidence.id],
      sourceRefIds: [source.id],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_EVIDENCE_NOT_FOUND' });
  });

  it('rejects missing or cross-project SourceRef bindings', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'source-local-binding' }, actor);
    const otherSource = await service.createSourceRef({ projectId: otherProjectId, sourceType: 'USER_INPUT', reference: 'source-other-binding' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Local', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Local evidence', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: ['src-missing'],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_SOURCE_REF_NOT_FOUND' });
    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [otherSource.id],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_SOURCE_REF_NOT_FOUND' });
  });

  it('rejects Evidence bound to a different Claim than the binding claimId', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'source-mismatch-claim' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim A', createdByType: 'human', sourceRefIds: [] }, actor);
    const otherClaim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim B', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: otherClaim.id, sourceRefId: source.id, name: 'Evidence B', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_EVIDENCE_CLAIM_MISMATCH' });
  });

  it('rejects Evidence whose SourceRef is not included in sourceRefIds', async () => {
    const { prisma } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'source-real' }, actor);
    const otherSource = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'source-listed' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Evidence', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [otherSource.id],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_EVIDENCE_SOURCE_MISMATCH' });
  });

  it('rejects supported Claim binding when Evidence.truthStatus is not supports', async () => {
    const { prisma, store } = makePrisma();
    const service = new TruthService(prisma as any);
    const source = await service.createSourceRef({ projectId, sourceType: 'USER_INPUT', reference: 'source-bad-status' }, actor);
    const claim = await service.createClaim({ projectId, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim supported', createdByType: 'human', sourceRefIds: [] }, actor);
    const evidence = await service.attachEvidence({ projectId, targetClaimId: claim.id, sourceRefId: source.id, name: 'Evidence', evidenceType: 'OTHER', truthStatus: 'supports', stepRef: 1 }, actor);
    await service.recordValidation({ projectId, claimId: claim.id, evidenceId: evidence.id, result: 'supported', validatorType: 'human', rationale: 'Supported.' }, validatorActor);
    store.evidence.find((item: any) => item.id === evidence.id).truthStatus = 'insufficient';

    await expect(service.evaluateValidatedSupportBinding(projectId, {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    })).rejects.toMatchObject({ code: 'TRUTH_BINDING_EVIDENCE_NOT_SUPPORTING' });
  });

  it('rejects impact realized when persisted validation is missing', async () => {
    const { prisma, store } = makePrisma();
    const service = new TruthService(prisma as any);
    const impact = await service.createImpactAssertion({ projectId, subjectType: 'initiative', metric: 'Horas', status: 'declared' }, actor);
    const stored = store.impacts.find((item: any) => item.id === impact.id);
    Object.assign(stored, { status: 'validated', validationId: 'val-deleted' });

    await expect(service.transitionImpact(projectId, impact.id, { status: 'realized' }, actor))
      .rejects.toMatchObject({ code: 'IMPACT_VALIDATION_NOT_FOUND' });
  });
});
