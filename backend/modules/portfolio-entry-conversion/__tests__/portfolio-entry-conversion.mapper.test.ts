import { describe, expect, it } from 'vitest';
import { mapPortfolioEntryToCanonicalProject } from '../portfolio-entry-conversion.mapper';

describe('Portfolio Entry conversion mapper', () => {
  it('uses corrected user values and preserves AI provenance/unresolved context', () => {
    const mapped = mapPortfolioEntryToCanonicalProject({
      session: {
        id: 'session-1',
        ownerUserId: 'user-1',
        ownershipState: 'CLAIMED',
        rawEntry: 'Input original',
        entryOrigin: 'public_start',
        lifecycleStatus: 'CONFIRMED',
        executionStatus: 'SUCCEEDED',
        interactionMode: 'quick_clarification',
        semanticState: { previousQuestions: [], answeredGaps: [] },
        questionBudget: { quickQuestionBudget: 3, quickQuestionsAsked: 3, explorationRound: 0, questionsAskedCurrentRound: 0 },
        latestAnalysis: null,
        latestHandoff: {
          id: 'handoff-1',
          sessionId: 'session-1',
          version: 1,
          status: 'ready_with_uncertainty',
          versioning: { contractVersion: 'c', runtimeVersion: 'r', schemaVersion: 's' },
          createdAt: new Date(),
          updatedAt: new Date(),
          handoff: {
            understanding: { value: 'Entendimiento inferido', provenance: { origin: 'AI_INFERRED', source_path: 'analysis' } },
            desired_outcome: { value: 'Reducir retrabajo', provenance: { origin: 'USER_DECLARED', source_text: 'retrabajo' } },
            decision_to_enable: 'unresolved',
            recommended_approach: {
              description: 'Ordenar el portafolio por urgencia y capacidad',
              origin: 'AI_SUGGESTED',
              review_disposition: 'UNREVIEWED',
            },
            alternative_approaches: [],
            known_context: [{ key: 'senal', value: 'tickets reabiertos', provenance: { origin: 'USER_DECLARED' } }],
            unresolved_context: [{ gap_id: 'decision', description: 'Decision pendiente', provenance: { origin: 'AI_INFERRED' } }],
            gap_resolution_map: [],
            evidence_or_clarity_needed: [{ value: 'Confirmar criterio de priorizacion', provenance: { origin: 'AI_SUGGESTED' } }],
            starteria_path: [{ action: 'prepare_decision', description: 'Preparar decision' }],
            recommended_cta: 'Revisar Step 0',
            provenance_summary: [{ origin: 'AI_INFERRED', source_path: 'analysis' }],
            handoff_status: 'ready_with_uncertainty',
          },
        },
        confirmation: null,
        versioning: { contractVersion: 'c', runtimeVersion: 'r', schemaVersion: 's' },
        revision: 6,
        contextRevision: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      },
      handoffId: 'handoff-1',
      confirmation: {
        id: 'confirmation-1',
        sessionId: 'session-1',
        handoffId: 'handoff-1',
        version: 1,
        status: 'CONFIRMED',
        acceptedFields: ['desired_outcome'],
        correctedFields: {
          understanding: { value: 'Correccion humana confirmada', origin: 'USER_CONFIRMED' },
        },
        rejectedFields: ['recommended_approach'],
        confirmedByUserId: 'user-1',
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(mapped.projectName).toContain('Correccion humana confirmada');
    expect(mapped.projectDescription).toBe('Correccion humana confirmada');
    expect(mapped.step0Data.recommendedApproach).toBe('');
    expect(JSON.stringify(mapped.step0Data)).toContain('Decision pendiente');
    expect(JSON.stringify(mapped.step0Data)).toContain('AI_INFERRED');
    expect(JSON.stringify(mapped.step0Data)).toContain('AI_SUGGESTED');
    expect(JSON.stringify(mapped.sourceSnapshot)).not.toContain('publicAccessToken');
    expect(JSON.stringify(mapped.sourceSnapshot)).not.toContain('publicAccessTokenHash');
  });
});
