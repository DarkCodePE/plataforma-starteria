#!/usr/bin/env bash
# Authenticated, low-volume production smoke for the real Portfolio Bootstrap E1 runtime.
# It uses the dedicated E2E Portfolio Lead, records only safe provider/usage metadata,
# and abandons the temporary preparation instead of creating canonical work.
set -euo pipefail

base="${E2E_PROD_BASE_URL:-https://starter-ia.com}"
email="${E2E_PROD_LEAD_EMAIL:-e2e-lead@starteria.test}"
: "${E2E_PROD_LEAD_PASSWORD:?E2E_PROD_LEAD_PASSWORD required}"

session_id=''
token=''
failure_stage='bootstrap'
diagnostic_response=''

report_failure() {
  local exit_code=$?
  trap - ERR
  set +e

  printf '::error::Semantic E1 production smoke failed at stage %s (exit %s)\n' \
    "$failure_stage" "$exit_code"

  if [[ -n "$diagnostic_response" ]] && jq -e . >/dev/null 2>&1 <<<"$diagnostic_response"; then
    jq -c --arg stage "$failure_stage" '
      .data.turn as $turn
      | {
      event: "semantic_e1_prod_smoke_failed",
      stage: $stage,
      apiCode: (.error.code // .data.error.code // .data.turn.error.code // null),
      enabled: (.data.enabled // null),
      turnStatus: (.data.turn.status // null),
      provider: (.data.turn.execution.provider // null),
      model: (.data.turn.execution.model // null),
      totalTokens: (.data.turn.execution.totalTokens // null),
      factsCount: (if (.data.turn.facts | type) == "array" then (.data.turn.facts | length) else null end),
      hasStartingPoint: (if (.data.turn.hypotheses | type) == "array" then any(.data.turn.hypotheses[]; (.hypothesisId | type) == "string" and (.hypothesisId | startswith("starting_point."))) else null end),
      hasMainUncertainty: (if ($turn.hypotheses | type) == "array" and ($turn.facts | type) == "array" then (
        any($turn.hypotheses[]; .hypothesisId == "main_uncertainty")
        or any($turn.facts[]; (.conceptId == "main_uncertainty" or .conceptId == "uncertainty"))
        or any(($turn.dispositions // [])[];
          .disposition == "unknown"
          and (.conceptId == "main_uncertainty" or .conceptId == "uncertainty" or .conceptId == "root_cause" or .conceptId == "solution")
          and (.conceptId as $concept | all($turn.facts[]; .conceptId != $concept or .status == "retracted"))
        )
        or ($turn.convergence.status == "question_required" and $turn.emittedQuestion != null)
      ) else null end),
      convergenceStatus: ($turn.convergence.status // null),
      emittedQuestion: ($turn.emittedQuestion != null),
      hasNextStep: (if (.data.turn | type) == "object" then (.data.turn.emittedQuestion != null or .data.turn.convergence.synthesis != null) else null end),
      semanticVersion: (.data.state.version // null)
    }' <<<"$diagnostic_response" || true
  else
    jq -nc --arg stage "$failure_stage" '{
      event: "semantic_e1_prod_smoke_failed",
      stage: $stage,
      jsonResponse: false
    }' || true
  fi

  exit "$exit_code"
}
trap report_failure ERR

cleanup() {
  if [[ -n "$session_id" && -n "$token" ]]; then
    curl --silent --show-error --max-time 20 -o /dev/null \
      -X POST -H "Authorization: Bearer $token" \
      -H "Idempotency-Key: semantic-e1-smoke-abandon-$session_id" \
      "$base/api/v1/portfolio-bootstrap/sessions/$session_id/abandon" || true
  fi
}
trap cleanup EXIT

failure_stage='login'
login_body=$(jq -nc --arg e "$email" --arg p "$E2E_PROD_LEAD_PASSWORD" '{email:$e,password:$p}')
diagnostic_response=$(curl --silent --show-error --max-time 20 --fail-with-body \
  -H 'Content-Type: application/json' -d "$login_body" "$base/api/v1/auth/login")
login="$diagnostic_response"
token=$(jq -er '.data.accessToken' <<<"$login")
echo "::add-mask::$token"

create_session() {
  curl --silent --show-error --max-time 20 --fail-with-body \
    -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
    -d '{}' "$base/api/v1/portfolio-bootstrap/sessions/direct"
}

failure_stage='create_session'
diagnostic_response=$(create_session)
session="$diagnostic_response"
session_id=$(jq -er '.data.bootstrapSession.id' <<<"$session")
failure_stage='read_semantic_state'
diagnostic_response=$(curl --silent --show-error --max-time 20 --fail-with-body \
  -H "Authorization: Bearer $token" \
  "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic")
semantic="$diagnostic_response"
jq -e '.data.enabled == true' >/dev/null <<<"$semantic"

# A previous interrupted smoke may have left only a semantic turn. Retire that E2E
# preparation first; conflicts fail closed instead of modifying business work.
version=$(jq -r '.data.state.version // 0' <<<"$semantic")
if [[ "$version" != 0 ]]; then
  failure_stage='reset_stale_session'
  curl --silent --show-error --max-time 20 --fail-with-body -o /dev/null \
    -X POST -H "Authorization: Bearer $token" \
    -H "Idempotency-Key: semantic-e1-smoke-reset-$session_id" \
    "$base/api/v1/portfolio-bootstrap/sessions/$session_id/abandon"
  session_id=''
  diagnostic_response=$(create_session)
  session="$diagnostic_response"
  session_id=$(jq -er '.data.bootstrapSession.id' <<<"$session")
fi

first_input='Nuestro restaurante tiene alta demanda los fines de semana y capacidad disponible entre semana. Queremos aumentar las ventas entre semana sin asumir todavía una solución. La incertidumbre principal es qué propuesta valorarían los clientes esos días y qué evidencia necesitamos antes de decidir.'
first_body=$(jq -nc --arg text "$first_input" '{expectedVersion:0,inputText:$text,answeredQuestionId:null}')
failure_stage='first_turn_transport'
diagnostic_response=$(curl --silent --show-error --max-time 45 --fail-with-body \
  -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -H "Idempotency-Key: semantic-e1-prod-smoke-first-$session_id" -d "$first_body" \
  "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic/turns")
first="$diagnostic_response"

failure_stage='first_turn_contract'
jq -e '
  .data.turn as $turn
  | $turn.status == "completed"
  and ($turn.execution.provider | type == "string" and length > 0)
  and $turn.execution.provider != "deterministic_test_adapter"
  and ($turn.execution.model | type == "string" and length > 0)
  and $turn.execution.totalTokens > 0
  and ($turn.facts | length) > 0
  and any($turn.hypotheses[]; .hypothesisId | startswith("starting_point."))
  and (any($turn.hypotheses[]; .hypothesisId == "main_uncertainty")
    or any($turn.facts[]; (.conceptId == "main_uncertainty" or .conceptId == "uncertainty"))
    or any(($turn.dispositions // [])[];
      .disposition == "unknown"
      and (.conceptId == "main_uncertainty" or .conceptId == "uncertainty" or .conceptId == "root_cause" or .conceptId == "solution")
      and (.conceptId as $concept | all($turn.facts[]; .conceptId != $concept or .status == "retracted"))
    )
    or ($turn.convergence.status == "question_required" and $turn.emittedQuestion != null))
  and ($turn.emittedQuestion != null or $turn.convergence.synthesis != null)
' >/dev/null <<<"$first"

first_version=$(jq -er '.data.state.version' <<<"$first")
question_id=$(jq -r '.data.turn.emittedQuestion.id // empty' <<<"$first")
if [[ -n "$question_id" ]]; then
  second_input='La prioridad es decidir qué propuesta probar entre semana sin perjudicar la operación del fin de semana; todavía no sabemos qué alternativa tendrá demanda suficiente.'
  answered=$(jq -n --arg id "$question_id" '$id')
else
  second_input='Corrección: no buscamos ampliar aforo ni trasladar la demanda del fin de semana; queremos validar una propuesta específica para los días laborables.'
  answered='null'
fi
second_body=$(jq -nc --argjson version "$first_version" --arg text "$second_input" --argjson answered "$answered" \
  '{expectedVersion:$version,inputText:$text,answeredQuestionId:$answered}')
second_idempotency_key="semantic-e1-prod-smoke-second-$session_id"
failure_stage='second_turn_transport'
diagnostic_response=$(curl --silent --show-error --max-time 45 --fail-with-body \
  -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -H "Idempotency-Key: $second_idempotency_key" -d "$second_body" \
  "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic/turns")
second="$diagnostic_response"

# Exercise the same explicit, idempotent recovery exposed by the UI. One retry
# remains one provider call per attempt and cannot create a duplicate logical turn.
if jq -e '
  .data.turn.status == "failed_retryable"
  and .data.turn.error.retryable == true
' >/dev/null <<<"$second"; then
  failure_stage='second_turn_retry_transport'
  diagnostic_response=$(curl --silent --show-error --max-time 45 --fail-with-body \
    -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
    -H "Idempotency-Key: $second_idempotency_key" -d "$second_body" \
    "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic/turns")
  second="$diagnostic_response"
fi

failure_stage='second_turn_contract'
jq -e --argjson previous "$first_version" '
  .data.turn.status == "completed"
  and .data.state.version > $previous
  and .data.turn.execution.provider != "deterministic_test_adapter"
  and .data.turn.execution.totalTokens > 0
  and (.data.turn.convergence.synthesis != null or .data.turn.emittedQuestion != null)
' >/dev/null <<<"$second"

trap - ERR
jq -c '{
  provider:.data.turn.execution.provider,
  model:.data.turn.execution.model,
  inputTokens:.data.turn.execution.inputTokens,
  outputTokens:.data.turn.execution.outputTokens,
  totalTokens:.data.turn.execution.totalTokens,
  retryCount:.data.turn.execution.retryCount,
  fallbackUsed:.data.turn.execution.fallbackUsed,
  convergence:.data.turn.convergence.status,
  synthesis:(.data.turn.convergence.synthesis != null),
  correctedVersion:.data.state.version
}' <<<"$second"
