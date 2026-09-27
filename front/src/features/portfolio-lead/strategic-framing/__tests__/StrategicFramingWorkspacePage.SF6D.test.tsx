import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategicFramingWorkspacePage } from '../StrategicFramingWorkspacePage';
import { getStrategicFramingLensSuggestions, getStrategicFramingPrioritizationRecommendations, getStrategicFramingPromotions, getStrategicFramingState, promoteStrategicFramingChallenge, reviewStrategicFramingChallengeStructure } from '../service';
import { listStrategicFronts } from '../../../../app/services/portfolioService';

vi.mock('../service', () => ({ getStrategicFramingState: vi.fn(), updateStrategicFramingState: vi.fn(), getStrategicFramingLensSuggestions: vi.fn(), getStrategicFramingPrioritizationRecommendations: vi.fn(), getStrategicFramingPromotions: vi.fn(), reviewStrategicFramingChallengeStructure: vi.fn(), reviewStrategicFramingPrioritization: vi.fn(), promoteStrategicFramingChallenge: vi.fn() }));
vi.mock('../../../../app/services/portfolioService', () => ({ listStrategicFronts: vi.fn() }));

const state = {
  id: 'state-1', sourceMode: 'enterprise_direct', intendedMovement: 'Mover conversión', whyItMatters: 'Importa', movementSignalStatus: 'proxy', movementSignalValue: '10%', horizonContext: null, decisionToEnable: null, subjectLevel: 'challenge_like' as const,
  scopeAssessment: { confidence: 'medium', rationale: [] }, parentStatus: 'unresolved' as const, parentContext: { label: null, sourceRefs: [] }, sufficiency: { status: 'sufficient', blockers: [], softGaps: [], optionalContext: [] }, version: 2, createdAt: '2026-09-24T10:00:00.000Z', updatedAt: '2026-09-24T10:00:00.000Z',
  prioritizationState: { schemaVersion: 1 as const, nonCanonical: true as const, focusSlots: null, focusRationale: null, candidates: [{ candidateId: 'gap-1', kind: 'gap' as const, statementSnapshot: 'Reducir fricción', sourceRefs: ['source-1'], humanDisposition: 'address_now' as const, humanDecision: { disposition: 'address_now' } }] },
  challengeStructuringState: { schemaVersion: 1 as const, nonCanonical: true as const, candidates: [{ challengeCandidateId: 'cc-1', sourceCandidateIds: ['gap-1'], relatedWorkRefs: [], statement: 'Reducir fricción', structureKind: 'one_challenge' as const, structuralRecommendationRef: null, structuralRecommendationVersion: null, confirmedByUserId: 'user-1', confirmedAt: '2026-09-24T10:00:00.000Z', createdFromStateVersion: 2 }] },
};

function renderPage() { return render(<MemoryRouter initialEntries={['/portfolio/framing/state-1']}><Routes><Route path="/portfolio/framing/:stateId" element={<StrategicFramingWorkspacePage />} /></Routes></MemoryRouter>); }

describe('SF-6D human review gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStrategicFramingState).mockResolvedValue(state as any);
    vi.mocked(getStrategicFramingLensSuggestions).mockResolvedValue({ stateId: 'state-1', stateVersion: 2, sourceMode: 'enterprise_direct', depthHint: 'standard', suggestions: [], generatedAt: state.updatedAt });
    vi.mocked(getStrategicFramingPrioritizationRecommendations).mockResolvedValue({ stateId: 'state-1', stateVersion: 2, focusSlots: null, capacityStatus: 'unknown', recommendations: [], warnings: [], limitations: [], recommendationVersion: 'v1' });
    vi.mocked(getStrategicFramingPromotions).mockResolvedValue([]);
    vi.mocked(listStrategicFronts).mockResolvedValue([{ id: 'front-1', name: 'Crecimiento sostenible' }] as any);
    vi.mocked(promoteStrategicFramingChallenge).mockResolvedValue({ promotionId: 'promotion-1', challengeCandidateId: 'cc-1', challengeId: 'challenge-1', challengeTitle: 'Challenge confirmado', strategicFrontId: 'front-1', challengeStatus: 'draft', retry: false });
  });

  it('loads canonical Fronts through the existing service and renders human names', async () => {
    renderPage();
    expect(await screen.findByRole('option', { name: 'Crecimiento sostenible' })).toBeInTheDocument();
    expect(listStrategicFronts).toHaveBeenCalledTimes(1);
  });

  it('localizes no-Front and keeps provisional without writing structure', async () => {
    vi.mocked(listStrategicFronts).mockResolvedValue([]);
    vi.mocked(getStrategicFramingState).mockResolvedValue({ ...state, challengeStructuringState: { schemaVersion: 1, nonCanonical: true, candidates: [] } } as any);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mantener provisional' }));
    expect(await screen.findByText(/no se crea ChallengeCandidate/)).toBeInTheDocument();
    expect(reviewStrategicFramingChallengeStructure).not.toHaveBeenCalled();
  });

  it('consumes promotionId from the explicit DTO and preserves the success UI', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Frente estratégico'), { target: { value: 'front-1' } });
    fireEvent.click(screen.getByLabelText('Confirmo Front, título, declaración y tipo.'));
    fireEvent.click(screen.getByRole('button', { name: 'Promover Challenge' }));
    expect(await screen.findByText('Challenge creado')).toBeInTheDocument();
    expect(screen.getByText('Título: Challenge confirmado')).toBeInTheDocument();
    expect(screen.getByText('Estado: Draft')).toBeInTheDocument();
    expect(screen.getByText('Frente: Crecimiento sostenible')).toBeInTheDocument();
    expect(screen.getByText('Iniciativas creadas: 0')).toBeInTheDocument();
    expect(screen.getByText(/promotionId: promotion-1/)).toBeInTheDocument();
    expect(promoteStrategicFramingChallenge).toHaveBeenCalledTimes(1);
  });
});
