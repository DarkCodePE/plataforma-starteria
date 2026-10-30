import type { AdaptiveInitiativeCore, AdaptiveRouteType } from '../../adaptive-core/domain/types';
import { latestAdaptiveStepOutput } from '../../adaptive-core/domain/adaptiveAuthority';

export type StepNumber = 0 | 1 | 2 | 3 | 4;

export const STEP_NAMES: Record<StepNumber, string> = {
  0: 'Enmarcar el ciclo',
  1: 'Establecer verdad y foco',
  2: 'Preparar el entregable',
  3: 'Ejecutar y aprender',
  4: 'Preparar la decisión',
};

const BASE_GOALS: Record<StepNumber, string> = {
  0: 'Enmarcar qué es razonable lograr en este ciclo, con sus restricciones y la decisión que debe habilitar.',
  1: 'Separar hechos, supuestos e hipótesis para justificar un foco con la evidencia disponible.',
  2: 'Preparar un entregable ejecutable y un plan de medición antes de confrontarlo con la realidad.',
  3: 'Ejecutar el trabajo preparado, observar qué ocurre y convertirlo en aprendizaje trazable.',
  4: 'Consolidar la evidencia y preparar una decisión humana con continuidad, riesgos y responsables claros.',
};

const ROUTE_GOALS: Partial<Record<AdaptiveRouteType, Partial<Record<StepNumber, string>>>> = {
  reconstruct_existing: {
    0: 'Reconstruir el contexto vigente sin obligarte a rehacer trabajo válido ni inventar la historia que falta.',
    1: 'Distinguir qué conocimiento histórico sigue sustentado y qué vacíos deben resolverse ahora.',
    2: 'Preparar el siguiente entregable ejecutable desde el estado real reconstruido y definir cómo se observará.',
  },
  implement_handoff: {
    0: 'Alinear alcance, restricciones, dependencias y decisión esperada para ejecutar el encargo recibido.',
    1: 'Confirmar qué condiciones y evidencias sostienen el foco antes de comprometer la ejecución.',
    2: 'Preparar la implementación o slice ejecutable, sus dependencias y el plan de medición.',
  },
  plan_coordinate: {
    2: 'Dejar listo un plan coordinado, con responsables, dependencias, señales y condiciones de ejecución.',
  },
  explore_validate: {
    2: 'Preparar una prueba o proxy ejecutable y acordar de antemano la señal que permitirá aprender.',
  },
};

function activeConfiguration(core: AdaptiveInitiativeCore | null | undefined, step: StepNumber) {
  const operationalConfiguration = core?.stepConfigurations.find(item => item.id === core.activeStepConfigurationId);
  return operationalConfiguration?.step === step ? operationalConfiguration
    : core?.stepConfigurations
      .filter(item => item.step === step)
      .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0];
}

export function getStepMission(core: AdaptiveInitiativeCore | null | undefined, step: StepNumber) {
  const configuration = activeConfiguration(core, step);
  const routeType = configuration?.routeType ?? core?.masterContext?.routeType;
  const routeGoal = routeType ? ROUTE_GOALS[routeType]?.[step] : undefined;
  const configuredGoal = configuration?.objective?.trim();
  const goal = routeGoal ?? configuredGoal ?? BASE_GOALS[step];
  const nextAction = core?.progressSignal?.step === step && core.progressSignal.nextAction?.trim()
    ? core.progressSignal.nextAction.trim()
    : core?.activeCheckpoint?.step === step
      ? `Revisar ${core.activeCheckpoint.checkpointKey} en el workspace canónico.`
      : `Consultar el estado canónico de Step ${step}; no hay una acción confirmable preparada en este momento.`;

  return {
    goal,
    nextAction,
    routeType: routeType ?? null,
    depthLevel: configuration?.depthLevel ?? core?.masterContext?.depthLevel ?? null,
    visibleName: configuration?.visibleName?.trim() || STEP_NAMES[step],
    expectedOutput: configuration?.expectedOutput?.trim() || 'Resultado canónico del Step',
  };
}

export function getConfirmedStepOutput(core: AdaptiveInitiativeCore | null | undefined, step: StepNumber) {
  return latestAdaptiveStepOutput(core, step, 'confirmed');
}

export interface CheckpointProgressRow {
  id: string;
  code: string;
  title: string;
  status: string;
  confirmed: boolean;
  active: boolean;
}

export interface StepCheckpointProgress {
  total: number;
  completed: number;
  percent: number | null;
  rows: CheckpointProgressRow[];
}

function checkpointInstanceIdentity(item: Record<string, unknown>) {
  return String(item.checkpointKey ?? item.code ?? item.id ?? '');
}

export function getStepCheckpointProgress(
  core: AdaptiveInitiativeCore | null | undefined,
  step: StepNumber,
): StepCheckpointProgress {
  if (!core) return { total: 0, completed: 0, percent: null, rows: [] };

  const configuration = activeConfiguration(core, step);
  const instances = (core.checkpointInstances ?? [])
    .filter(item => Number(item.step ?? item.stepNumber) === step);
  const instanceByCode = new Map(instances.map(item => [checkpointInstanceIdentity(item), item]));
  const configured = configuration?.checkpoints ?? [];
  const rows: CheckpointProgressRow[] = configured.map(checkpoint => {
    const instance = instanceByCode.get(checkpoint.code);
    const status = String(instance?.status ?? checkpoint.status ?? 'locked');
    return {
      id: String(instance?.id ?? checkpoint.id),
      code: checkpoint.code,
      title: checkpoint.title,
      status,
      confirmed: status === 'completed',
      active: core.activeCheckpoint?.step === step && core.activeCheckpoint.checkpointKey === checkpoint.code,
    };
  });

  for (const instance of instances) {
    const code = checkpointInstanceIdentity(instance);
    if (!code || rows.some(row => row.code === code)) continue;
    const status = String(instance.status ?? 'locked');
    rows.push({
      id: String(instance.id ?? code),
      code,
      title: String(instance.title ?? code),
      status,
      confirmed: status === 'completed',
      active: core.activeCheckpoint?.step === step && core.activeCheckpoint.checkpointKey === code,
    });
  }

  if (core.activeCheckpoint?.step === step && !rows.some(row => row.code === core.activeCheckpoint?.checkpointKey)) {
    rows.push({
      id: core.activeCheckpoint.id,
      code: core.activeCheckpoint.checkpointKey,
      title: core.activeCheckpoint.checkpointKey,
      status: core.activeCheckpoint.status,
      confirmed: core.activeCheckpoint.status === 'completed',
      active: true,
    });
  }

  const total = rows.length;
  const completed = rows.filter(row => row.confirmed).length;
  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : null,
    rows: rows.slice(0, 5),
  };
}
