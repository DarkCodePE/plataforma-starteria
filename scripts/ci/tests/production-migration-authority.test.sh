#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
validator="$repo_root/scripts/ci/validate-production-migration-authority.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

sed -E '0,/Estado:/s/(Estado:[[:space:]]*).*/\1PROPUESTO/' \
  "$repo_root/doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md" > "$tmp/adr.md"
awk -F'|' 'BEGIN { OFS="|" } $2 ~ /^[[:space:]]*ADR-010[[:space:]]*$/ { $5=" PROPUESTO " } { print }' \
  "$repo_root/doc/product-adr/ADR-INDEX.md" > "$tmp/index.md"
mkdir -p "$tmp/front/prisma/migrations/20261109100000_kan253_e2_goal_turn_ledger"
touch "$tmp/front/prisma/migrations/20261109100000_kan253_e2_goal_turn_ledger/migration.sql"

run_validator() {
  RELEASE_TARGET_ROOT="$tmp" PRODUCT_ADR_010_PATH="$tmp/adr.md" PRODUCT_ADR_INDEX_PATH="$tmp/index.md" bash "$validator"
}

if run_validator >/dev/null 2>&1; then
  echo 'migration authority gate accepted the currently proposed Product ADR-010' >&2
  exit 1
fi

for rejected_status in 'NO APROBADO' 'NOT ACCEPTED' 'REJECTED'; do
  sed -E "0,/Estado:/s/(Estado:[[:space:]]*).*/\\1$rejected_status/" "$repo_root/doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md" > "$tmp/adr-negative.md"
  if RELEASE_TARGET_ROOT="$tmp" PRODUCT_ADR_010_PATH="$tmp/adr-negative.md" PRODUCT_ADR_INDEX_PATH="$tmp/index.md" bash "$validator" >/dev/null 2>&1; then
    echo "migration authority gate accepted closed negative status: $rejected_status" >&2
    exit 1
  fi
done

sed -E '/^- \*\*(Aprobado por|Aprobado en|Evidencia revisada):\*\*/d' \
  "$repo_root/doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md" > "$tmp/adr.md"
cp "$repo_root/doc/product-adr/ADR-INDEX.md" "$tmp/index.md"
if run_validator >/dev/null 2>&1; then
  echo 'migration authority gate accepted status text without a decision owner/evidence' >&2
  exit 1
fi

cp "$repo_root/doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md" "$tmp/adr.md"
run_validator >/dev/null

cp "$tmp/adr.md" "$tmp/adr-valid.md"
for field in 'Aprobado por' 'Aprobado en' 'Evidencia revisada'; do
  sed -E "s/^(- \\*\\*$field:\\*\\*).*/\\1/" "$tmp/adr-valid.md" > "$tmp/adr.md"
  if run_validator >/dev/null 2>&1; then
    echo "migration authority gate accepted an empty human decision field: $field" >&2
    exit 1
  fi
done
sed -E 's/^(- \*\*Aprobado en:\*\*).*/\1 2026-13-40/' "$tmp/adr-valid.md" > "$tmp/adr.md"
if run_validator >/dev/null 2>&1; then
  echo 'migration authority gate accepted an invalid ISO calendar date' >&2
  exit 1
fi
cp "$tmp/adr-valid.md" "$tmp/adr.md"

awk -F'|' 'BEGIN { OFS="|" } $2 ~ /^[[:space:]]*ADR-010[[:space:]]*$/ { $5=" REJECTED "; $6=" approved by someone in notes " } { print }' "$repo_root/doc/product-adr/ADR-INDEX.md" > "$tmp/index.md"
if run_validator >/dev/null 2>&1; then
  echo 'migration authority gate accepted a rejected index status because notes said approved' >&2
  exit 1
fi

# A rollback target from before KAN-253 does not carry the governed migration
# and must remain deployable through the current control-plane gates.
rm -rf "$tmp/front/prisma/migrations/20261109100000_kan253_e2_goal_turn_ledger"
run_validator >/dev/null

workflow="$repo_root/.github/workflows/cd.yml"
grep -q 'path: control-plane' "$workflow" || { echo 'CD lacks a current control-plane checkout' >&2; exit 1; }
grep -q 'path: release-target' "$workflow" || { echo 'CD lacks a separate release-target checkout' >&2; exit 1; }
grep -q 'RELEASE_TARGET_ROOT:' "$workflow" || { echo 'CD does not scope migration authority to the release target' >&2; exit 1; }
grep -q 'bash control-plane/scripts/ci/validate-production-migration-authority.sh' "$workflow" \
  || { echo 'CD migration gate does not execute from the current control plane' >&2; exit 1; }

echo 'production migration authority tests passed'
