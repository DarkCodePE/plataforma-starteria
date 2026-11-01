#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly PREFLIGHT="${SCRIPT_DIR}/preflight.sh"
TEST_ROOT="$(mktemp -d)"
readonly TEST_ROOT
trap 'rm -rf -- "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin"
cat >"$TEST_ROOT/bin/docker" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == 'info' && "${2:-}" == '--format' ]]; then
  printf '8589934592\n'
fi
exit 0
EOF
cat >"$TEST_ROOT/bin/getent" <<'EOF'
#!/usr/bin/env bash
printf '%b\n' "${TEST_DNS_OUTPUT:?set TEST_DNS_OUTPUT}"
EOF
chmod 700 "$TEST_ROOT/bin/docker" "$TEST_ROOT/bin/getent"

write_valid_env() {
  local target="$1"
  cat >"$target" <<'EOF'
PREVIEW_HOST=preview.example.test
PREVIEW_EXPECTED_IPV4=8.8.8.8
PREVIEW_DB_PASSWORD=K187Db9a5c7e1f3b8d2a6c4e9f7b1d5a3c8e
PREVIEW_JWT_SECRET=K187Jwt4b8d2f6a1c5e9b3d7f2a6c8e4b1d5f9
PREVIEW_ALLOWED_CIDR=1.1.1.1/32
PREVIEW_BRIDGE_SHARED_SECRET=K187Bridge8c2e6a4d9f1b5c7e3a8d2f6b4c9e1a5
PREVIEW_AI_SERVICE_TOKEN=K187Ai6d2b8f4a1e7c3d9b5a2f8e4c6d1b7a3f9
PREVIEW_BILLING_WEBHOOK_SECRET=K187Billing5e9a3c7f1b6d2a8e4c9f5b1d7a3e6c2
PREVIEW_PILOT_CODE_SECRET=K187Pilot7a3e9c5b1f8d4a6e2c7b3f9d5a1e8c4b6
PREVIEW_LEAD_PASSWORD=K187SyntheticLead8a4c2e6b
PREVIEW_OWNER_PASSWORD=K187SyntheticOwner7d3f9a5c
PREVIEW_MEMBER_PASSWORD=K187SyntheticMember6e2b8d4f
HANDOFF_EMAIL_TRANSPORT_MODE=sandbox
HANDOFF_EMAIL_PILOT_ENABLED=false
SMTP_HOST=mailpit
EOF
  chmod 600 "$target"
}

run_preflight() {
  local env_file="$1"
  TEST_DNS_OUTPUT="${TEST_DNS_OUTPUT:-8.8.8.8 STREAM}" \
    PATH="$TEST_ROOT/bin:$PATH" \
    bash "$PREFLIGHT" "$env_file"
}

expect_failure() {
  local env_file="$1"
  local expected="$2"
  if run_preflight "$env_file" >"$TEST_ROOT/output" 2>&1; then
    printf 'expected preflight failure containing: %s\n' "$expected" >&2
    exit 1
  fi
  grep -Fq "$expected" "$TEST_ROOT/output" || {
    cat "$TEST_ROOT/output" >&2
    exit 1
  }
}

valid_env="$TEST_ROOT/valid.env"
write_valid_env "$valid_env"
run_preflight "$valid_env" | grep -Fq 'KAN187_PREFLIGHT_GO'

wide_cidr="$TEST_ROOT/wide-cidr.env"
cp "$valid_env" "$wide_cidr"
sed -i 's#PREVIEW_ALLOWED_CIDR=1.1.1.1/32#PREVIEW_ALLOWED_CIDR=0.0.0.0/0#' "$wide_cidr"
expect_failure "$wide_cidr" 'PREVIEW_ALLOWED_CIDR must authorize exactly one public IPv4 (/32)'

multiple_a="$TEST_ROOT/multiple-a.env"
cp "$valid_env" "$multiple_a"
TEST_DNS_OUTPUT=$'8.8.8.8 STREAM\n9.9.9.9 STREAM' expect_failure "$multiple_a" 'PREVIEW_HOST must resolve to exactly one IPv4 address'

open_permissions="$TEST_ROOT/open-permissions.env"
cp "$valid_env" "$open_permissions"
chmod 644 "$open_permissions"
expect_failure "$open_permissions" 'preview.env permissions must be 0600'

printf 'KAN187_PRIVATE_PREVIEW_PREFLIGHT_TESTS_PASS\n'
