import type { AdaptiveInitiativeCore } from './types';

type StepNumber = 0 | 1 | 2 | 3 | 4;

function asStep(value: unknown): StepNumber | null {
  return typeof value === 'number' && value >= 0 && value <= 4 ? value as StepNumber : null;
}

export function latestAdaptiveStepOutput(
  core: AdaptiveInitiativeCore | null | undefined,
  step: StepNumber,
  status?: 'draft' | 'confirmed',
): Record<string, any> | null {
  const outputs = (core?.stepOutputs ?? [])
    .filter((item: any) => (item.step === step || item.stepNumber === step) && (!status || item.status === status))
    .sort((a: any, b: any) => {
      const byVersion = (b.version ?? 0) - (a.version ?? 0);
      if (byVersion !== 0) return byVersion;
      return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    });
  return outputs[0] ?? null;
}

export function getAuthoritativeActiveStep(core: AdaptiveInitiativeCore | null | undefined): StepNumber | null {
  if (!core) return null;
  const cycleStep = asStep(core.cycle?.currentStep);
  if (cycleStep !== null) return cycleStep;
  const candidates: StepNumber[] = [];

  const activeCheckpointStep = asStep(core.activeCheckpoint?.step);
  if (activeCheckpointStep !== null) candidates.push(activeCheckpointStep);

  const progressStep = asStep(core.progressSignal?.step);
  if (progressStep !== null) candidates.push(progressStep);

  const activeConfig = core.stepConfigurations.find(config => config.id === core.activeStepConfigurationId);
  const activeConfigStep = asStep(activeConfig?.step);
  if (activeConfigStep !== null) candidates.push(activeConfigStep);

  for (const output of core.stepOutputs ?? []) {
    const outputStep = asStep((output as any).step ?? (output as any).stepNumber);
    if (outputStep === null) continue;
    if ((output as any).status === 'confirmed') candidates.push(Math.min(outputStep + 1, 4) as StepNumber);
    if ((output as any).status === 'draft') candidates.push(outputStep);
  }

  return candidates.length ? Math.max(...candidates) as StepNumber : 0;
}

export function canNavigateToAdaptiveStep(core: AdaptiveInitiativeCore | null | undefined, step: StepNumber): boolean {
  if (step === 0) return true;
  const activeStep = getAuthoritativeActiveStep(core);
  return activeStep !== null && activeStep >= step;
}

export function isAdaptiveStepActive(core: AdaptiveInitiativeCore | null | undefined, step: StepNumber): boolean {
  return getAuthoritativeActiveStep(core) === step;
}
