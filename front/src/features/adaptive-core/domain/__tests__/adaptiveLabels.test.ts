import { describe, expect, it } from 'vitest';
import { outputLabel } from '../adaptiveLabels';

// Lo que el servidor manda como expectedOutput de Steps 1–4 (STEPn_OUTPUT_BY_ROUTE). Se vio en
// prod "Lo que estás construyendo: Experiment results learning decision".
const SERVER_OUTPUT_KEYS = [
  'ProblemFocusBrief', 'OpportunityThesis', 'ReadinessAdoptionAssessment', 'UncertaintyLearningMap', 'EvidenceReconstructionReport',
  'ExperimentCard', 'PilotCard', 'ImplementationValidationPlan', 'DeliveryPlan', 'RecoveryValidationPlan',
  'ExperimentResultsLearningDecision', 'PilotResultsProductDecision', 'ImplementationValidationReport',
  'ExecutionReviewUpdatedDecision', 'RecoveryResultsRegularizationDecision', 'LightweightResultsBrief',
  'DecisionMemoLearningReport', 'BusinessCaseRoadmap', 'OperationalHandoffPackage', 'ExecutiveDeliveryReport',
  'RegularizationGovernancePackage', 'LightweightDecisionBrief',
];

describe('outputLabel', () => {
  it('traduce todos los resultados esperados de Steps 1–4 en vez de partir el nombre en inglés', () => {
    const humanizedEnglish = (key: string) => {
      const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
      return words.charAt(0).toUpperCase() + words.slice(1);
    };
    const untranslated = SERVER_OUTPUT_KEYS.filter((key) => outputLabel(key) === humanizedEnglish(key));
    expect(untranslated).toEqual([]);
  });
});
