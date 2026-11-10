#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
release_root="${RELEASE_TARGET_ROOT:-$repo_root}"
adr_path="${PRODUCT_ADR_010_PATH:-$release_root/doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md}"
index_path="${PRODUCT_ADR_INDEX_PATH:-$release_root/doc/product-adr/ADR-INDEX.md}"
governed_migration="$release_root/front/prisma/migrations/20261109100000_kan253_e2_goal_turn_ledger/migration.sql"

fail() {
  echo "::error::$1" >&2
  exit 1
}

if [[ ! -f "$governed_migration" ]]; then
  echo 'Production migration authority gate: governed KAN-253 migration is absent from the release target; gate not applicable.'
  exit 0
fi

[[ -f "$adr_path" ]] || fail 'Canonical Product ADR-010 is missing'
[[ -f "$index_path" ]] || fail 'Canonical product ADR index is missing'

status_line=$(grep -m1 -E '^[-*]?[[:space:]]*\*?\*?Estado:' "$adr_path" || true)
index_line=$(grep -m1 -E '^\|[[:space:]]*ADR-010[[:space:]]*\|' "$index_path" || true)
approved_by=$(grep -m1 -Ei '^[-*]?[[:space:]]*\*?\*?(Aprobado por|Approved by):' "$adr_path" || true)
approved_at=$(grep -m1 -Ei '^[-*]?[[:space:]]*\*?\*?(Aprobado en|Approved at|Decision date):' "$adr_path" || true)
approval_evidence=$(grep -m1 -Ei '^[-*]?[[:space:]]*\*?\*?(Evidencia revisada|Evidence reviewed):' "$adr_path" || true)
[[ -n "$status_line" ]] || fail 'Canonical Product ADR-010 has no explicit status'
[[ -n "$index_line" ]] || fail 'Product ADR index has no ADR-010 row'

normalize_status() {
  sed -E 's/\*//g; s/^[[:space:]]+//; s/[[:space:]]+$//' | tr '[:lower:]' '[:upper:]'
}

field_value() {
  sed -E 's/^[^:]*:[[:space:]]*//; s/\*//g; s/^[[:space:]]+//; s/[[:space:]]+$//'
}

adr_status=$(printf '%s\n' "$status_line" | sed -E 's/^[-*]?[[:space:]]*\*?\*?Estado:[[:space:]]*//' | normalize_status)
index_status=$(printf '%s\n' "$index_line" | awk -F'|' '{print $5}' | normalize_status)
[[ "$adr_status" == 'ACCEPTED' ]] || fail 'Product ADR-010 canonical status must be exactly ACCEPTED'
[[ "$index_status" == 'ACCEPTED' ]] || fail 'Product ADR-010 index status must be exactly ACCEPTED'
approved_by_value=$(printf '%s\n' "$approved_by" | field_value)
approved_at_value=$(printf '%s\n' "$approved_at" | field_value)
approval_evidence_value=$(printf '%s\n' "$approval_evidence" | field_value)
[[ -n "$approved_by_value" && "$approved_by_value" != *'<'* ]] || fail 'Product ADR-010 is missing a human decision owner value'
[[ -n "$approval_evidence_value" && "$approval_evidence_value" != *'<'* ]] || fail 'Product ADR-010 is missing a reviewed evidence value'
[[ "$approved_at_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail 'Product ADR-010 decision date must be ISO YYYY-MM-DD'
normalized_date=$(date -u -d "$approved_at_value" +%F 2>/dev/null || true)
[[ "$normalized_date" == "$approved_at_value" ]] || fail 'Product ADR-010 decision date is not a valid calendar date'

echo 'Production migration authority gate: Product ADR-010 is ratified in canonical record and index.'
