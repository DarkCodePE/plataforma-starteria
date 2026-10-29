import type {
  GovernanceMode,
  InitiativeAlignmentInput,
  InitiativeAlignmentResult,
  InitiativeCompletionRoutingInput,
  InitiativeCompletionRoutingResult,
} from './adaptive-core.types';

export class InitiativeCompletionResolver {
  resolveAlignment(input: InitiativeAlignmentInput): InitiativeAlignmentResult {
    const governanceMode = this.resolveGovernanceMode(input);
    const hasChallenge = Boolean(input.challengeId);

    if (hasChallenge) {
      return {
        projectId: input.projectId,
        alignmentType: 'challenge_assigned',
        governanceMode: 'portfolio_governed',
        portfolioAligned: true,
        sourceChallengeId: input.challengeId ?? null,
        sourcePortfolioContextId: input.strategicFrontId ?? null,
        rationale: [
          'La iniciativa tiene una vinculacion canonica a un reto de portafolio.',
          'Las iniciativas asignadas a reto son portfolio-aligned.',
        ],
      };
    }

    if (governanceMode === 'portfolio_governed') {
      return {
        projectId: input.projectId,
        alignmentType: 'portfolio_initiative',
        governanceMode,
        portfolioAligned: true,
        sourceChallengeId: null,
        sourcePortfolioContextId: input.strategicFrontId ?? null,
        rationale: [
          'La gobernanza explicita de la iniciativa es portfolio_governed.',
          'La ausencia de reto no permite clasificarla como self_initiated.',
        ],
      };
    }

    return {
      projectId: input.projectId,
      alignmentType: 'self_initiated',
      governanceMode: 'owner_governed',
      portfolioAligned: false,
      sourceChallengeId: null,
      sourcePortfolioContextId: null,
      rationale: [
        'No existe origen de reto/portafolio ni gobernanza explicita de portafolio.',
        'La iniciativa se trata como self_initiated para C2B.',
      ],
    };
  }

  routeCompletion(input: InitiativeCompletionRoutingInput): InitiativeCompletionRoutingResult {
    if (!input.methodologicalCompletion) {
      return {
        projectId: input.projectId,
        cycleId: input.cycleId,
        alignmentType: input.alignment.alignmentType,
        governanceMode: input.alignment.governanceMode,
        route: input.alignment.portfolioAligned ? 'portfolio_presented' : 'owner_completed',
        methodologicalCompletion: false,
        initiativeCompleted: false,
        portfolioReviewRequired: false,
        lifecycleProjection: 'active',
        rationale: [
          'La ruta final solo se activa cuando el ciclo metodologico tiene Step 4 confirmado.',
        ],
      };
    }

    if (input.alignment.portfolioAligned) {
      return {
        projectId: input.projectId,
        cycleId: input.cycleId,
        alignmentType: input.alignment.alignmentType,
        governanceMode: input.alignment.governanceMode,
        route: 'portfolio_presented',
        methodologicalCompletion: true,
        initiativeCompleted: false,
        portfolioReviewRequired: true,
        lifecycleProjection: 'presented',
        rationale: [
          'El trabajo metodologico esta completo.',
          'La iniciativa esta alineada a portafolio y queda lista para revision posterior.',
          'C2B no crea DecisionRequest ni Decision.',
        ],
      };
    }

    return {
      projectId: input.projectId,
      cycleId: input.cycleId,
      alignmentType: input.alignment.alignmentType,
      governanceMode: input.alignment.governanceMode,
      route: 'owner_completed',
      methodologicalCompletion: true,
      initiativeCompleted: false,
      portfolioReviewRequired: false,
      lifecycleProjection: 'active',
      rationale: [
        'El trabajo metodologico esta completo.',
        'La iniciativa es self_initiated y no requiere revision de portafolio.',
        'Cerrar el ciclo no cierra la iniciativa: continuidad, iteracion o cierre requieren una decision humana posterior.',
      ],
    };
  }

  private resolveGovernanceMode(input: InitiativeAlignmentInput): GovernanceMode {
    if (input.governanceMode === 'portfolio_governed') return 'portfolio_governed';
    return 'owner_governed';
  }
}
