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
cleanup() {
  if [[ -n "$session_id" && -n "$token" ]]; then
    curl --silent --show-error --max-time 20 -o /dev/null \
      -X POST -H "Authorization: Bearer $token" \
      -H "Idempotency-Key: semantic-e1-smoke-abandon-$session_id" \
      "$base/api/v1/portfolio-bootstrap/sessions/$session_id/abandon" || true
  fi
}
trap cleanup EXIT

login_body=$(jq -nc --arg e "$email" --arg p "$E2E_PROD_LEAD_PASSWORD" '{email:$e,password:$p}')
login=$(curl --silent --show-error --max-time 20 --fail-with-body \
  -H 'Content-Type: application/json' -d "$login_body" "$base/api/v1/auth/login")
token=$(jq -er '.data.accessToken' <<<"$login")
echo "::add-mask::$token"

create_session() {
  curl --silent --show-error --max-time 20 --fail-with-body \
    -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
    -d '{}' "$base/api/v1/portfolio-bootstrap/sessions/direct"
}

session=$(create_session)
session_id=$(jq -er '.data.bootstrapSession.id' <<<"$session")
semantic=$(curl --silent --show-error --max-time 20 --fail-with-body \
  -H "Authorization: Bearer $token" \
  "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic")
jq -e '.data.enabled == true' >/dev/null <<<"$semantic"

# A previous interrupted smoke may have left only a semantic turn. Retire that E2E
# preparation first; conflicts fail closed instead of modifying business work.
version=$(jq -r '.data.state.version // 0' <<<"$semantic")
if [[ "$version" != 0 ]]; then
  curl --silent --show-error --max-time 20 --fail-with-body -o /dev/null \
    -X POST -H "Authorization: Bearer $token" \
    -H "Idempotency-Key: semantic-e1-smoke-reset-$session_id" \
    "$base/api/v1/portfolio-bootstrap/sessions/$session_id/abandon"
  session_id=''
  session=$(create_session)
  session_id=$(jq -er '.data.bootstrapSession.id' <<<"$session")
fi

first_input='Nuestro restaurante tiene alta demanda los fines de semana y capacidad disponible entre semana. Queremos aumentar las ventas entre semana sin asumir todavía una solución. La incertidumbre principal es qué propuesta valorarían los clientes esos días y qué evidencia necesitamos antes de decidir.'
first_body=$(jq -nc --arg text "$first_input" '{expectedVersion:0,inputText:$text,answeredQuestionId:null}')
first=$(curl --silent --show-error --max-time 45 --fail-with-body \
  -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -H "Idempotency-Key: semantic-e1-prod-smoke-first-$session_id" -d "$first_body" \
  "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic/turns")

jq -e '
  .data.turn.status == "completed"
  and (.data.turn.execution.provider | type == "string" and length > 0)
  and .data.turn.execution.provider != "deterministic_test_adapter"
  and (.data.turn.execution.model | type == "string" and length > 0)
  and .data.turn.execution.totalTokens > 0
  and (.data.turn.facts | length) > 0
  and any(.data.turn.hypotheses[]; .hypothesisId | startswith("starting_point."))
  and (any(.data.turn.hypotheses[]; .hypothesisId == "main_uncertainty")
    or any(.data.turn.facts[]; .conceptId == "uncertainty"))
  and (.data.turn.emittedQuestion != null or .data.turn.convergence.synthesis != null)
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
second=$(curl --silent --show-error --max-time 45 --fail-with-body \
  -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -H "Idempotency-Key: semantic-e1-prod-smoke-second-$session_id" -d "$second_body" \
  "$base/api/v1/portfolio-bootstrap/sessions/$session_id/context/semantic/turns")

jq -e --argjson previous "$first_version" '
  .data.turn.status == "completed"
  and .data.state.version > $previous
  and .data.turn.execution.provider != "deterministic_test_adapter"
  and .data.turn.execution.totalTokens > 0
  and (.data.turn.convergence.synthesis != null or .data.turn.emittedQuestion != null)
' >/dev/null <<<"$second"

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
