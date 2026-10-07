import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../domain/critical-situation-synthesis.schema';
import { criticalSituationSynthesisProviderSchema } from '../model/critical-situation-synthesis-provider-schema';
import type {
  LiveCandidateMetadata,
  ModelExecutionResult,
} from '../model/model-execution-types';
import type { StructuredModelAdapter } from '../model/structured-model-adapter';
import type {
  CriticalSituationSynthesisAuthorizedSnapshot,
} from '../synthesis/critical-situation-synthesis-input';
import { validateCriticalSituationSynthesisConformance } from '../synthesis/critical-situation-synthesis-conformance';
import {
  loadResolvedCriticalSituationSynthesisPromptManifest,
  type CriticalSituationSynthesisPromptMetadata,
} from '../prompts/kan-114/prompt-manifest';

export type CriticalSituationSynthesisAdapterInput = {
  authorized_snapshot: CriticalSituationSynthesisAuthorizedSnapshot;
  call_id: string;
  model_metadata: LiveCandidateMetadata & {
    requested_model: string;
    temperature: number;
  };
};

export type CriticalSituationSynthesisAdapterResult = {
  synthesis: CriticalSituationSynthesis | null;
  model_execution: ModelExecutionResult<CriticalSituationSynthesis>;
  conformance_result: ReturnType<typeof validateCriticalSituationSynthesisConformance> | null;
  resolved_prompt_metadata: CriticalSituationSynthesisPromptMetadata;
};

export class CriticalSituationSynthesisAdapter {
  constructor(private readonly modelAdapter: StructuredModelAdapter) {}

  async generate(input: CriticalSituationSynthesisAdapterInput): Promise<CriticalSituationSynthesisAdapterResult> {
    const prompt = loadResolvedCriticalSituationSynthesisPromptManifest();
    const snapshot = projectAuthorizedSnapshot(input.authorized_snapshot);
    let modelExecution = await this.modelAdapter.generate({
      systemPrompt: prompt.prompt_text,
      userPayload: snapshot,
      outputSchema: criticalSituationSynthesisSchema,
      providerJsonSchema: criticalSituationSynthesisProviderSchema,
      preserveProviderNulls: true,
      metadata: input.model_metadata,
      call: {
        call_id: input.call_id,
        purpose: 'critical_situation_synthesis',
      },
    });

    let conformanceResult: CriticalSituationSynthesisAdapterResult['conformance_result'] = null;
    let synthesis: CriticalSituationSynthesis | null = null;

    if (modelExecution.validated_output !== null) {
      conformanceResult = validateCriticalSituationSynthesisConformance(modelExecution.validated_output, snapshot);
      if (!conformanceResult.valid) {
        modelExecution = {
          ...modelExecution,
          validated_output: null,
          error_type: 'CONTRACT_FAILURE',
        };
      } else if (!modelExecution.error_type) {
        synthesis = conformanceResult.value ?? modelExecution.validated_output;
      }
    }

    const { prompt_text: _promptText, ...resolvedPromptMetadata } = prompt;
    return {
      synthesis,
      model_execution: modelExecution,
      conformance_result: conformanceResult,
      resolved_prompt_metadata: resolvedPromptMetadata,
    };
  }
}

function projectAuthorizedSnapshot(
  snapshot: CriticalSituationSynthesisAuthorizedSnapshot,
): CriticalSituationSynthesisAuthorizedSnapshot {
  return {
    snapshot_id: snapshot.snapshot_id,
    captured_at: snapshot.captured_at,
    source_refs: [...snapshot.source_refs],
    items: snapshot.items.map((item) => ({
      ref: item.ref,
      kind: item.kind,
      content: item.content,
      ...(item.corrects_ref !== undefined ? { corrects_ref: item.corrects_ref } : {}),
      provenance: item.provenance,
    })),
    provisional_extracted_context: snapshot.provisional_extracted_context
      ? {
          values: snapshot.provisional_extracted_context.values,
          provenance: snapshot.provisional_extracted_context.provenance,
        }
      : null,
  };
}
