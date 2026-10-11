/**
 * adaptiveLabels.ts — nombres legibles para lo que el Core adaptativo expone con claves
 * internas (prioridad de pregunta, output del checkpoint, ruta y profundidad).
 *
 * La vista de usuario mostraba las claves tal cual ("must", "InitiativeFraming",
 * "explore validate", "essential"). Las claves siguen siendo el contrato con el backend;
 * esto sólo decide qué se lee en pantalla.
 */
import type { AdaptiveDepthLevel, AdaptiveQuestion, AdaptiveRouteType } from './types';

export const QUESTION_PRIORITY_LABELS: Record<AdaptiveQuestion['priority'], string> = {
  must: 'Imprescindible',
  should: 'Importante',
  could: 'Opcional',
};

export const ROUTE_TYPE_LABELS: Record<AdaptiveRouteType, string> = {
  explore_validate: 'Explorar y validar',
  design_solution: 'Diseñar la solución',
  implement_handoff: 'Implementar y transferir',
  plan_coordinate: 'Planificar y coordinar',
  reconstruct_existing: 'Reconstruir lo existente',
  lightweight_plan: 'Plan liviano',
};

export const DEPTH_LEVEL_LABELS: Record<AdaptiveDepthLevel, string> = {
  essential: 'Esencial',
  standard: 'Estándar',
  extended: 'Profunda',
};

const OUTPUT_LABELS: Record<string, string> = {
  InitiativeFraming: 'Encuadre de la iniciativa',
  ProblemFocusBrief: 'Foco del problema',
  SelectedBet: 'Apuesta seleccionada',
  DecisionMemoLearningReport: 'Memo de decisión y aprendizajes',
  DesignCriteria: 'Criterios de diseño',
  ExecutionConditionsMap: 'Mapa de condiciones de ejecución',
  AdoptionBaseline: 'Línea base de adopción',
  AlternativeComparison: 'Comparación de alternativas',
  AlternativeSet: 'Set de alternativas',
  DecisionAudienceBrief: 'Brief para quien decide',
  DecisionAudienceMap: 'Mapa de quienes deciden',
  DecisionPackage: 'Paquete de decisión',
  EvidenceBackedNarrative: 'Narrativa respaldada por evidencia',
  EvidenceBasedDecision: 'Decisión basada en evidencia',
  EvidenceMap: 'Mapa de evidencia',
  EvidencePlan: 'Plan de evidencia',
  ExecutionDesign: 'Diseño de la ejecución',
  ExecutionEvidenceLog: 'Registro de evidencia de la ejecución',
  ExecutionLog: 'Registro de la ejecución',
  ExecutionReadiness: 'Preparación para ejecutar',
  ExecutionRunbook: 'Guía de ejecución',
  ExecutiveNarrative: 'Narrativa ejecutiva',
  ExperimentOrDeliveryPlan: 'Plan de experimento o entrega',
  ExperimentResultAnalysis: 'Análisis de resultados del experimento',
  FinalDecisionPackage: 'Paquete de decisión final',
  HandoffPlan: 'Plan de traspaso',
  HistoricalOutput: 'Resultado histórico',
  NextHorizonPlan: 'Plan del siguiente horizonte',
  OperationalReadiness: 'Preparación operativa',
  ReadinessCheck: 'Chequeo de preparación',
  ResultsAssessment: 'Evaluación de resultados',
  SustainedFocus: 'Foco sostenido',
  TransferOrClosure: 'Transferencia o cierre',
  ValidationFocus: 'Foco de validación',
  ValidationPlan: 'Plan de validación',
  // Output esperado de Steps 1–4 por ruta (StepConfiguration.expectedOutput).
  OpportunityThesis: 'Tesis de oportunidad',
  ReadinessAdoptionAssessment: 'Evaluación de preparación y adopción',
  UncertaintyLearningMap: 'Mapa de incertidumbres y aprendizajes',
  EvidenceReconstructionReport: 'Reconstrucción de la evidencia',
  ExperimentCard: 'Ficha del experimento',
  PilotCard: 'Ficha del piloto',
  ImplementationValidationPlan: 'Plan de validación de la implementación',
  DeliveryPlan: 'Plan de entrega',
  RecoveryValidationPlan: 'Plan de recuperación y validación',
  ExperimentResultsLearningDecision: 'Resultados, aprendizajes y decisión',
  PilotResultsProductDecision: 'Resultados del piloto y decisión',
  ImplementationValidationReport: 'Informe de validación de la implementación',
  ExecutionReviewUpdatedDecision: 'Revisión de la ejecución y decisión',
  RecoveryResultsRegularizationDecision: 'Resultados de la recuperación y decisión',
  LightweightResultsBrief: 'Resumen de resultados',
  BusinessCaseRoadmap: 'Caso de negocio y roadmap',
  OperationalHandoffPackage: 'Paquete de traspaso a operación',
  ExecutiveDeliveryReport: 'Informe ejecutivo de entrega',
  RegularizationGovernancePackage: 'Paquete de regularización y gobierno',
  LightweightDecisionBrief: 'Resumen de la decisión',
  Step1FocusDecision: 'Foco y decisión del Step 1',
  Step3Decision: 'Decisión del Step 3',
  // Output esperado de Step 0 por ruta (StepConfiguration.expectedOutput).
  'Context Brief + Validation Contract': 'Brief de contexto y contrato de validación',
  'Opportunity Brief': 'Brief de oportunidad',
  'Implementation Brief': 'Brief de implementación',
  'Project Brief + Validation Contract': 'Brief del proyecto y contrato de validación',
  'Reconstructed Context': 'Contexto reconstruido',
  'Quick Brief': 'Brief rápido',
};

export function questionPriorityLabel(priority: string): string {
  return QUESTION_PRIORITY_LABELS[priority as AdaptiveQuestion['priority']] ?? priority;
}

export function routeTypeLabel(routeType: string | null | undefined): string {
  if (!routeType) return 'Ruta adaptativa';
  return ROUTE_TYPE_LABELS[routeType as AdaptiveRouteType] ?? routeType.replaceAll('_', ' ');
}

export function depthLevelLabel(depthLevel: string | null | undefined): string {
  if (!depthLevel) return DEPTH_LEVEL_LABELS.standard;
  return DEPTH_LEVEL_LABELS[depthLevel as AdaptiveDepthLevel] ?? depthLevel;
}

/** Nombre legible de un output; una clave desconocida en CamelCase se separa en palabras. */
export function outputLabel(outputKey: string | null | undefined): string {
  if (!outputKey) return 'Resultado del checkpoint';
  if (OUTPUT_LABELS[outputKey]) return OUTPUT_LABELS[outputKey];
  if (!/^[A-Z][A-Za-z]+$/.test(outputKey)) return outputKey;
  const words = outputKey.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
