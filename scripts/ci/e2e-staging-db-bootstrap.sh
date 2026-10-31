#!/usr/bin/env bash
# Bootstrap a brand-new PostgreSQL database for the isolated P12 environment.
# Unlike prod-db-migrate.sh, this path is valid only when public has no tables.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
namespace="${NAMESPACE:-starteria-e2e}"
expected_migrations=72
mode="${1:-bootstrap}"
port_forward_pid=""

cleanup() {
  [[ -z "$port_forward_pid" ]] || kill "$port_forward_pid" 2>/dev/null || true
}
trap cleanup EXIT

[[ "$namespace" == "starteria-e2e" && "$namespace" != "starteria" ]] || {
  echo "::error::refusing database bootstrap outside starteria-e2e" >&2
  exit 1
}
[[ "$mode" == "bootstrap" || "$mode" == "verify" ]] || {
  echo "usage: $0 [bootstrap|verify]" >&2
  exit 2
}

actual_migrations=$(find "$repo_root/front/prisma/migrations" -mindepth 2 -maxdepth 2 -name migration.sql | wc -l | tr -d ' ')
[[ "$actual_migrations" == "$expected_migrations" ]] || {
  echo "::error::expected $expected_migrations canonical migrations, found $actual_migrations" >&2
  exit 1
}

if [[ -n "${LOCAL_TEST_DATABASE_URL:-}" ]]; then
  DATABASE_URL="$LOCAL_TEST_DATABASE_URL"
  node -e '
    const u = new URL(process.argv[1]);
    const local = ["127.0.0.1", "localhost", "::1"].includes(u.hostname);
    if (!local || !/(e2e|staging|disposable)/i.test(u.pathname)) process.exit(1);
  ' "$DATABASE_URL" || { echo "::error::LOCAL_TEST_DATABASE_URL must be a local disposable database" >&2; exit 1; }
else
  command -v kubectl >/dev/null || { echo "::error::kubectl is required" >&2; exit 1; }
  kubectl -n "$namespace" get statefulset starteria-db >/dev/null
  db_password=$(kubectl -n "$namespace" get secret starteria-db-secrets -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 --decode)
  echo "::add-mask::$db_password"
  kubectl -n "$namespace" port-forward statefulset/starteria-db 15432:5432 > "${RUNNER_TEMP:-/tmp}/e2e-staging-db-port-forward.log" 2>&1 &
  port_forward_pid=$!
  for _ in $(seq 30); do (echo > /dev/tcp/127.0.0.1/15432) 2>/dev/null && break; sleep 1; done
  (echo > /dev/tcp/127.0.0.1/15432) 2>/dev/null || { echo "::error::staging database port-forward did not become ready" >&2; exit 1; }
  encoded_password=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$db_password")
  DATABASE_URL="postgresql://starteria:${encoded_password}@127.0.0.1:15432/starteria_db"
fi
export DATABASE_URL

cd "$repo_root/front"
prisma="./node_modules/.bin/prisma"
[[ -x "$prisma" ]] || { echo "::error::run npm ci in front before bootstrap" >&2; exit 1; }

if [[ "$mode" == "bootstrap" ]]; then
  cat <<'SQL' | "$prisma" db execute --stdin --schema prisma/schema.prisma
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
  ) THEN
    RAISE EXCEPTION 'database is not empty';
  END IF;
END $$;
SQL

  echo "--- applying $expected_migrations canonical migrations to empty E2E database"
  "$prisma" migrate deploy --schema prisma/schema.prisma
else
  echo "--- verifying the already bootstrapped E2E database"
fi

cat <<SQL | "$prisma" db execute --stdin --schema prisma/schema.prisma
DO \$\$
DECLARE
  successful integer;
  failed integer;
BEGIN
  SELECT count(*) INTO successful
  FROM "_prisma_migrations"
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
  SELECT count(*) INTO failed
  FROM "_prisma_migrations"
  WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF successful <> $expected_migrations OR failed <> 0 THEN
    RAISE EXCEPTION 'expected 72 successful migrations and zero failed, got successful=% failed=%', successful, failed;
  END IF;
END \$\$;
SQL

"$prisma" migrate status --schema prisma/schema.prisma
"$prisma" migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code

echo "E2E staging database ${mode} verified: 72/72, zero failed, zero drift"
