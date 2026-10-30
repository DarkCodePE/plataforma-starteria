export interface StepReasoningMissionContext {
  initiativeName: string;
  contextLabel: string;
  mission?: string | null;
  missionSource?: string | null;
  businessOutcome?: string | null;
  cycleObjective?: string | null;
  step0Method?: string | null;
  nextFocus?: string | null;
}

interface MissionContextSnapshot {
  type?: string;
  label?: string | null;
  source?: string | null;
}

interface MissionMasterContext {
  challengeSnapshot?: {
    title?: string | null;
    objective?: string | null;
  } | null;
  contextSnapshots?: MissionContextSnapshot[] | null;
  missingCriticalInformation?: string[] | null;
}

interface BuildMissionContextInput {
  projectName: string;
  projectDescription?: string | null;
  fallbackMission?: string | null;
  linkedToChallenge: boolean;
  masterContext?: MissionMasterContext | null;
  confirmedResponses?: Record<string, unknown> | null;
  challengeContribution?: { kpi?: string | null } | null;
  stepMethodObjective?: string | null;
  activeCheckpointPurpose?: string | null;
}

const DEFAULT_STEP0_METHOD = 'Aclarar el alcance inicial, las condiciones y la decisión que este ciclo debe habilitar.';

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function countConfirmedCheckpoints(checkpoints: ReadonlyArray<{ status?: unknown }>): number {
  return checkpoints.filter(checkpoint => checkpoint.status === 'completed').length;
}

export function buildStep0MissionContext(input: BuildMissionContextInput): StepReasoningMissionContext {
  const snapshots = input.masterContext?.contextSnapshots ?? [];
  const challengeSnapshot = input.linkedToChallenge ? input.masterContext?.challengeSnapshot : null;
  const inheritedSnapshot = snapshots.find(snapshot => snapshot.type === 'challenge') ?? snapshots[0];
  const projectDescription = nonEmptyText(input.projectDescription);
  const fallbackMission = nonEmptyText(input.fallbackMission);
  const confirmedCycleObjective = nonEmptyText(input.confirmedResponses?.objective);

  const mission = nonEmptyText(challengeSnapshot?.title)
    ?? nonEmptyText(inheritedSnapshot?.label)
    ?? projectDescription
    ?? fallbackMission
    ?? input.projectName;

  const missionSource = challengeSnapshot
    ? 'Reto vinculado en Adaptive Core'
    : inheritedSnapshot
      ? [nonEmptyText(inheritedSnapshot.label), nonEmptyText(inheritedSnapshot.source)].filter(Boolean).join(' · ')
      : projectDescription
        ? 'Descripción de la iniciativa'
        : fallbackMission
          ? 'Contexto de Step 0 pendiente de confirmar'
          : 'Nombre de la iniciativa';

  const businessOutcome = input.linkedToChallenge
    ? nonEmptyText(challengeSnapshot?.objective) ?? nonEmptyText(input.challengeContribution?.kpi)
    : null;

  return {
    initiativeName: input.projectName,
    contextLabel: 'Contexto inicial disponible',
    mission,
    missionSource: missionSource || 'Origen pendiente de verificar',
    businessOutcome,
    cycleObjective: confirmedCycleObjective,
    step0Method: nonEmptyText(input.stepMethodObjective) ?? DEFAULT_STEP0_METHOD,
    nextFocus: nonEmptyText(input.masterContext?.missingCriticalInformation?.[0])
      ?? nonEmptyText(input.activeCheckpointPurpose),
  };
}
