#!/usr/bin/env bash
# Emits only the allowlisted validation metadata recorded by the Semantic E1
# orchestrator. Provider payloads, user text and request logs are never copied.
set -euo pipefail

namespace="${NAMESPACE:-starteria}"
raw_logs=$(kubectl logs -n "$namespace" -l app=starteria-backend \
  --since=3m --tail=-1 --max-log-requests=10 2>/dev/null || true)

diagnostics=$(jq -Rrc '
  fromjson?
  | select(
      .event == "portfolio_bootstrap_semantic_schema_invalid"
      or .event == "portfolio_bootstrap_semantic_policy_incomplete"
    )
  | if .event == "portfolio_bootstrap_semantic_schema_invalid" then
      {
        event: "portfolio_bootstrap_semantic_schema_invalid",
        validationStage: (
          if (.validationStage == "adapter"
            or .validationStage == "orchestrator"
            or .validationStage == "semantic_turn")
          then .validationStage else "unknown" end
        ),
        issues: (
          if (.issues | type) == "array" then [
            .issues[] | {
              path: (if (.path | type) == "string" then .path else "$" end),
              category: (if (.category | type) == "string" then .category else "unknown" end)
            }
          ] else [] end
        ),
        completionStatus: (if (.completionStatus | type) == "string" then .completionStatus else null end),
        incompleteReason: (if (.incompleteReason | type) == "string" then .incompleteReason else null end),
        inputTokens: (if (.inputTokens | type) == "number" then .inputTokens else null end),
        outputTokens: (if (.outputTokens | type) == "number" then .outputTokens else null end),
        totalTokens: (if (.totalTokens | type) == "number" then .totalTokens else null end)
      }
    else
      {
        event: "portfolio_bootstrap_semantic_policy_incomplete",
        incompleteReason: (
          if (.incompleteReason == "premature_review_without_material_exit"
            or .incompleteReason == "missing_starting_point_without_question"
            or .incompleteReason == "missing_main_uncertainty_without_question"
            or .incompleteReason == "material_evidence_without_next_step")
          then .incompleteReason else "unknown" end
        ),
        attempt: (if (.attempt | type) == "number" then .attempt else null end),
        providerFactsCount: (if (.providerFactsCount | type) == "number" then .providerFactsCount else null end),
        providerHypothesesCount: (if (.providerHypothesesCount | type) == "number" then .providerHypothesesCount else null end),
        providerDispositionsCount: (if (.providerDispositionsCount | type) == "number" then .providerDispositionsCount else null end),
        providerHasQuestionPlan: (if (.providerHasQuestionPlan | type) == "boolean" then .providerHasQuestionPlan else null end),
        providerHasSynthesis: (if (.providerHasSynthesis | type) == "boolean" then .providerHasSynthesis else null end),
        providerReadyForHumanReview: (if (.providerReadyForHumanReview | type) == "boolean" then .providerReadyForHumanReview else null end),
        acceptedFactsCount: (if (.acceptedFactsCount | type) == "number" then .acceptedFactsCount else null end),
        acceptedHypothesesCount: (if (.acceptedHypothesesCount | type) == "number" then .acceptedHypothesesCount else null end),
        acceptedDispositionsCount: (if (.acceptedDispositionsCount | type) == "number" then .acceptedDispositionsCount else null end),
        hasAnchor: (if (.hasAnchor | type) == "boolean" then .hasAnchor else null end),
        hasDirection: (if (.hasDirection | type) == "boolean" then .hasDirection else null end),
        hasStartingPoint: (if (.hasStartingPoint | type) == "boolean" then .hasStartingPoint else null end),
        hasMainUncertainty: (if (.hasMainUncertainty | type) == "boolean" then .hasMainUncertainty else null end),
        questionBudgetLimit: (if (.questionBudgetLimit | type) == "number" then .questionBudgetLimit else null end),
        questionBudgetUsed: (if (.questionBudgetUsed | type) == "number" then .questionBudgetUsed else null end),
        inputTokens: (if (.inputTokens | type) == "number" then .inputTokens else null end),
        outputTokens: (if (.outputTokens | type) == "number" then .outputTokens else null end),
        totalTokens: (if (.totalTokens | type) == "number" then .totalTokens else null end)
      }
    end
' <<<"$raw_logs")

if [[ -z "$diagnostics" ]]; then
  jq -nc '{
    event: "portfolio_bootstrap_semantic_schema_diagnostic",
    matched: false
  }'
  exit 0
fi

while IFS= read -r diagnostic; do
  printf '%s\n' "$diagnostic"
done <<<"$diagnostics"
