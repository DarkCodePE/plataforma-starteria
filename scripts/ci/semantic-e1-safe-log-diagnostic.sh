#!/usr/bin/env bash
# Emits only the allowlisted validation metadata recorded by the Semantic E1
# orchestrator. Provider payloads, user text and request logs are never copied.
set -euo pipefail

namespace="${NAMESPACE:-starteria}"
raw_logs=$(kubectl logs -n "$namespace" -l app=starteria-backend \
  --since=3m --tail=-1 --max-log-requests=10 2>/dev/null || true)

diagnostics=$(jq -Rrc '
  fromjson?
  | select(.event == "portfolio_bootstrap_semantic_schema_invalid")
  | {
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
