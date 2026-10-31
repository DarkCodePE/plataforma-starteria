#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
backup_script="$repo_root/scripts/ci/mvp-release01-backup-only.sh"
restore_script="$repo_root/scripts/ci/mvp-release01-restore-encrypted-backup.sh"
work_dir=$(mktemp -d)
suffix="${RANDOM}-$$"
source_container="starteria-mvp-release01-source-$suffix"
target_container="starteria-mvp-release01-target-$suffix"
network="starteria-mvp-release01-roundtrip-$suffix"
runner_container=$(hostname)

cleanup() {
  docker rm -f "$source_container" "$target_container" >/dev/null 2>&1 || true
  docker network disconnect -f "$network" "$runner_container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
  -subj '/CN=starteria-release01-roundtrip' \
  -keyout "$work_dir/key.pem" -out "$work_dir/cert.pem" >/dev/null 2>&1
chmod 600 "$work_dir/key.pem"

docker network create --internal "$network" >/dev/null
docker network connect "$network" "$runner_container"

docker run -d --name "$source_container" --network "$network" --memory 384m \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=roundtrip_source \
  postgres:16-alpine >/dev/null
docker run -d --name "$target_container" --network "$network" --memory 384m \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=roundtrip_target \
  postgres:16-alpine >/dev/null

for container in "$source_container" "$target_container"; do
  for _ in $(seq 1 60); do
    docker exec "$container" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "$container" pg_isready -U postgres >/dev/null
done

docker exec -i "$source_container" psql -v ON_ERROR_STOP=1 -U postgres -d roundtrip_source >/dev/null <<'SQL'
CREATE TABLE rehearsal_probe (
  id bigint PRIMARY KEY,
  label text NOT NULL,
  payload jsonb NOT NULL
);
INSERT INTO rehearsal_probe VALUES
  (1, 'synthetic-alpha', '{"kind":"synthetic","ordinal":1}'),
  (2, 'synthetic-beta',  '{"kind":"synthetic","ordinal":2}'),
  (3, 'synthetic-gamma', '{"kind":"synthetic","ordinal":3}');
SQL

source_system_identifier=$(docker exec "$source_container" psql -At -U postgres -d roundtrip_source \
  -c 'SELECT system_identifier FROM pg_control_system();')
target_system_identifier=$(docker exec "$target_container" psql -At -U postgres -d roundtrip_target \
  -c 'SELECT system_identifier FROM pg_control_system();')
[[ "$source_system_identifier" != "$target_system_identifier" ]]

cat > "$work_dir/pg_service.conf" <<SERVICE
[starteria_release01_clone]
host=$target_container
port=5432
dbname=roundtrip_target
user=postgres
SERVICE
chmod 600 "$work_dir/pg_service.conf"
target_address=$(PGSERVICEFILE="$work_dir/pg_service.conf" PGSERVICE=starteria_release01_clone \
  psql -X -At -c 'SELECT inet_server_addr()::text;')

cat > "$work_dir/mock-kubectl" <<MOCK
#!/usr/bin/env bash
set -euo pipefail
exec docker exec "$source_container" pg_dump -U postgres -d roundtrip_source \
  --format=custom --no-owner --no-privileges
MOCK
chmod +x "$work_dir/mock-kubectl"

AUTHORIZATION_REF=MVPREL01-ROUNDTRIP-0001 \
RECIPIENT_CERT_FILE="$work_dir/cert.pem" \
OUTPUT_FILE="$work_dir/roundtrip.p7m" \
KUBECTL_BIN="$work_dir/mock-kubectl" \
  "$backup_script" >/dev/null

expected_sha256=$(sha256sum "$work_dir/roundtrip.p7m" | awk '{print $1}')
destruction_at=$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ')
if ENCRYPTED_BACKUP="$work_dir/roundtrip.p7m" \
  EXPECTED_SHA256="$expected_sha256" \
  RECIPIENT_CERT_FILE="$work_dir/cert.pem" \
  RECIPIENT_PRIVATE_KEY_FILE="$work_dir/key.pem" \
  PGSERVICE_FILE="$work_dir/pg_service.conf" \
  PGSERVICE_NAME=starteria_release01_clone \
  EXPECTED_CLONE_DATABASE=roundtrip_target \
  EXPECTED_CLONE_SERVER_ADDRESS="$target_address" \
  EXPECTED_CLONE_SYSTEM_IDENTIFIER=9999999999999999999 \
  PRODUCTION_SYSTEM_IDENTIFIER="$source_system_identifier" \
  AUTHORIZATION_REF=MVPREL01-ROUNDTRIP-0001 \
  DESTRUCTION_AT_UTC="$destruction_at" \
    "$restore_script" >/dev/null 2>&1; then
  echo 'Restore unexpectedly accepted a mismatched clone system identifier.' >&2
  exit 1
fi
if ENCRYPTED_BACKUP="$work_dir/roundtrip.p7m" \
  EXPECTED_SHA256="$expected_sha256" \
  RECIPIENT_CERT_FILE="$work_dir/cert.pem" \
  RECIPIENT_PRIVATE_KEY_FILE="$work_dir/key.pem" \
  PGSERVICE_FILE="$work_dir/pg_service.conf" \
  PGSERVICE_NAME=starteria_release01_clone \
  EXPECTED_CLONE_DATABASE=roundtrip_target \
  EXPECTED_CLONE_SERVER_ADDRESS=192.0.2.1 \
  EXPECTED_CLONE_SYSTEM_IDENTIFIER="$target_system_identifier" \
  PRODUCTION_SYSTEM_IDENTIFIER="$source_system_identifier" \
  AUTHORIZATION_REF=MVPREL01-ROUNDTRIP-0001 \
  DESTRUCTION_AT_UTC="$destruction_at" \
    "$restore_script" >/dev/null 2>&1; then
  echo 'Restore unexpectedly accepted a mismatched clone server address.' >&2
  exit 1
fi
if ENCRYPTED_BACKUP="$work_dir/roundtrip.p7m" \
  EXPECTED_SHA256="$expected_sha256" \
  RECIPIENT_CERT_FILE="$work_dir/cert.pem" \
  RECIPIENT_PRIVATE_KEY_FILE="$work_dir/key.pem" \
  PGSERVICE_FILE="$work_dir/pg_service.conf" \
  PGSERVICE_NAME=starteria_release01_clone \
  EXPECTED_CLONE_DATABASE=roundtrip_target \
  EXPECTED_CLONE_SERVER_ADDRESS="$target_address" \
  EXPECTED_CLONE_SYSTEM_IDENTIFIER="$source_system_identifier" \
  PRODUCTION_SYSTEM_IDENTIFIER="$source_system_identifier" \
  AUTHORIZATION_REF=MVPREL01-ROUNDTRIP-0001 \
  DESTRUCTION_AT_UTC="$destruction_at" \
    "$restore_script" >/dev/null 2>&1; then
  echo 'Restore unexpectedly accepted the production system identifier.' >&2
  exit 1
fi
ENCRYPTED_BACKUP="$work_dir/roundtrip.p7m" \
EXPECTED_SHA256="$expected_sha256" \
RECIPIENT_CERT_FILE="$work_dir/cert.pem" \
RECIPIENT_PRIVATE_KEY_FILE="$work_dir/key.pem" \
PGSERVICE_FILE="$work_dir/pg_service.conf" \
PGSERVICE_NAME=starteria_release01_clone \
EXPECTED_CLONE_DATABASE=roundtrip_target \
EXPECTED_CLONE_SERVER_ADDRESS="$target_address" \
EXPECTED_CLONE_SYSTEM_IDENTIFIER="$target_system_identifier" \
PRODUCTION_SYSTEM_IDENTIFIER="$source_system_identifier" \
AUTHORIZATION_REF=MVPREL01-ROUNDTRIP-0001 \
DESTRUCTION_AT_UTC="$destruction_at" \
  "$restore_script" >/dev/null

source_digest=$(docker exec "$source_container" psql -At -U postgres -d roundtrip_source \
  -c "SELECT count(*) || ':' || md5(string_agg(id || ':' || label || ':' || payload::text, '|' ORDER BY id)) FROM rehearsal_probe;")
target_digest=$(docker exec "$target_container" psql -At -U postgres -d roundtrip_target \
  -c "SELECT count(*) || ':' || md5(string_agg(id || ':' || label || ':' || payload::text, '|' ORDER BY id)) FROM rehearsal_probe;")
[[ "$source_digest" == "$target_digest" ]]
if grep -aFq 'synthetic-alpha' "$work_dir/roundtrip.p7m"; then
  echo 'Plaintext found in encrypted roundtrip artifact.' >&2
  exit 1
fi

echo "MVP_RELEASE01_BACKUP_ROUNDTRIP_PASS digest=$target_digest"
