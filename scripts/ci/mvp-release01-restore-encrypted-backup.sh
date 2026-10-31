#!/usr/bin/env bash
set -Eeuo pipefail

: "${ENCRYPTED_BACKUP:?ENCRYPTED_BACKUP is required}"
: "${EXPECTED_SHA256:?EXPECTED_SHA256 is required}"
: "${RECIPIENT_CERT_FILE:?RECIPIENT_CERT_FILE is required}"
: "${RECIPIENT_PRIVATE_KEY_FILE:?RECIPIENT_PRIVATE_KEY_FILE is required}"
: "${PGSERVICE_FILE:?PGSERVICE_FILE is required}"
: "${PGSERVICE_NAME:?PGSERVICE_NAME is required}"
: "${EXPECTED_CLONE_DATABASE:?EXPECTED_CLONE_DATABASE is required}"
: "${EXPECTED_CLONE_SERVER_ADDRESS:?EXPECTED_CLONE_SERVER_ADDRESS is required}"
: "${EXPECTED_CLONE_SYSTEM_IDENTIFIER:?EXPECTED_CLONE_SYSTEM_IDENTIFIER is required}"
: "${PRODUCTION_SYSTEM_IDENTIFIER:?PRODUCTION_SYSTEM_IDENTIFIER is required}"
: "${AUTHORIZATION_REF:?AUTHORIZATION_REF is required}"
: "${DESTRUCTION_AT_UTC:?DESTRUCTION_AT_UTC is required}"

OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
PSQL_BIN="${PSQL_BIN:-psql}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"

[[ -s "$ENCRYPTED_BACKUP" ]] || { echo 'Encrypted backup is missing or empty.' >&2; exit 1; }
[[ -s "$RECIPIENT_CERT_FILE" && -s "$RECIPIENT_PRIVATE_KEY_FILE" ]] \
  || { echo 'Recipient certificate and private key are required.' >&2; exit 1; }
[[ "$EXPECTED_SHA256" =~ ^[a-f0-9]{64}$ ]] || { echo 'Invalid expected SHA-256.' >&2; exit 1; }
[[ "$AUTHORIZATION_REF" =~ ^MVPREL01-[A-Z0-9][A-Z0-9-]{5,63}$ ]] || { echo 'Invalid authorization reference.' >&2; exit 1; }
[[ "$EXPECTED_CLONE_DATABASE" != 'starteria_db' ]] || { echo 'Production database name is forbidden as a restore target.' >&2; exit 1; }
[[ "$EXPECTED_CLONE_SYSTEM_IDENTIFIER" =~ ^[0-9]+$ ]] || { echo 'Invalid expected clone system identifier.' >&2; exit 1; }
[[ "$PRODUCTION_SYSTEM_IDENTIFIER" =~ ^[0-9]+$ ]] || { echo 'Invalid production system identifier.' >&2; exit 1; }
[[ "$EXPECTED_CLONE_SYSTEM_IDENTIFIER" != "$PRODUCTION_SYSTEM_IDENTIFIER" ]] \
  || { echo 'Clone and production system identifiers must differ.' >&2; exit 1; }
[[ -f "$PGSERVICE_FILE" ]] || { echo 'Protected libpq service file is missing.' >&2; exit 1; }
[[ "$(stat -c %a "$PGSERVICE_FILE")" == '600' ]] \
  || { echo 'Protected libpq service file must have mode 0600.' >&2; exit 1; }

actual_sha256=$(sha256sum "$ENCRYPTED_BACKUP" | awk '{print $1}')
[[ "$actual_sha256" == "$EXPECTED_SHA256" ]] || { echo 'Encrypted backup SHA-256 mismatch.' >&2; exit 1; }
"$OPENSSL_BIN" cms -cmsout -inform DER -in "$ENCRYPTED_BACKUP" -noout >/dev/null

now_epoch=$(date -u +%s)
destruction_epoch=$(date -u -d "$DESTRUCTION_AT_UTC" +%s 2>/dev/null) \
  || { echo 'Invalid DESTRUCTION_AT_UTC.' >&2; exit 1; }
(( destruction_epoch > now_epoch && destruction_epoch <= now_epoch + 259200 )) \
  || { echo 'Destruction deadline must be within the next 72 hours.' >&2; exit 1; }

runtime_dir=$(mktemp -d)
cleanup() {
  rm -rf -- "$runtime_dir"
}
trap cleanup EXIT
runtime_service_file="$runtime_dir/pg_service.conf"
cp -- "$PGSERVICE_FILE" "$runtime_service_file"
chmod 600 "$runtime_service_file"
export PGSERVICEFILE="$runtime_service_file"
export PGSERVICE="$PGSERVICE_NAME"

identity=$("$PSQL_BIN" -X -At -F '|' -v ON_ERROR_STOP=1 \
  -c "SELECT current_database(), COALESCE(inet_server_addr()::text, 'local'), inet_server_port(), current_setting('server_version_num'), system_identifier::text FROM pg_control_system();")
IFS='|' read -r actual_database server_address server_port server_version system_identifier <<<"$identity"
[[ "$actual_database" == "$EXPECTED_CLONE_DATABASE" ]] \
  || { echo 'Connected database does not match EXPECTED_CLONE_DATABASE.' >&2; exit 1; }
[[ "$server_address" == "$EXPECTED_CLONE_SERVER_ADDRESS" ]] \
  || { echo 'Connected server address does not match the authorized clone.' >&2; exit 1; }
[[ "$system_identifier" == "$EXPECTED_CLONE_SYSTEM_IDENTIFIER" ]] \
  || { echo 'Connected PostgreSQL system identifier does not match the authorized clone.' >&2; exit 1; }
[[ "$system_identifier" != "$PRODUCTION_SYSTEM_IDENTIFIER" ]] \
  || { echo 'Refusing to restore to the production PostgreSQL system identifier.' >&2; exit 1; }
(( server_version >= 160000 && server_version < 170000 )) \
  || { echo 'Restore target is not PostgreSQL 16.' >&2; exit 1; }
table_count=$("$PSQL_BIN" -X -At -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');")
[[ "$table_count" == '0' ]] || { echo 'Restore target is not empty.' >&2; exit 1; }

if ! "$OPENSSL_BIN" cms -decrypt -binary -inform DER \
    -in "$ENCRYPTED_BACKUP" -recip "$RECIPIENT_CERT_FILE" -inkey "$RECIPIENT_PRIVATE_KEY_FILE" \
  | "$PG_RESTORE_BIN" --exit-on-error --single-transaction --no-owner --no-privileges \
      --dbname "service=$PGSERVICE_NAME"; then
  echo 'Encrypted restore failed; destroy and recreate the isolated clone before retrying.' >&2
  exit 1
fi

echo "Encrypted restore completed on clone database=$actual_database address=$server_address port=$server_port"
echo "Authorization=$AUTHORIZATION_REF destruction_at_utc=$DESTRUCTION_AT_UTC"
