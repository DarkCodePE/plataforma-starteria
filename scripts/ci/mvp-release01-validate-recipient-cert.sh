#!/usr/bin/env bash
set -Eeuo pipefail

: "${RECIPIENT_CERT_B64:?RECIPIENT_CERT_B64 is required}"
: "${CERTIFICATE_FILE:?CERTIFICATE_FILE is required}"

OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
umask 077
rm -f -- "$CERTIFICATE_FILE"

cleanup_on_error() {
  local status=$?
  if (( status != 0 )); then
    rm -f -- "$CERTIFICATE_FILE"
  fi
  exit "$status"
}
trap cleanup_on_error EXIT

if ! printf '%s' "$RECIPIENT_CERT_B64" | base64 --decode > "$CERTIFICATE_FILE"; then
  echo '::error::Recipient certificate is not valid base64.' >&2
  exit 1
fi
chmod 600 "$CERTIFICATE_FILE"

"$OPENSSL_BIN" x509 -in "$CERTIFICATE_FILE" -noout >/dev/null
if ! "$OPENSSL_BIN" x509 -in "$CERTIFICATE_FILE" -noout -checkend 86400 >/dev/null; then
  echo '::error::Recipient certificate is expired or expires within 24 hours.' >&2
  exit 1
fi
if ! "$OPENSSL_BIN" x509 -in "$CERTIFICATE_FILE" -noout -purpose \
  | grep -Fqx 'S/MIME encryption : Yes'; then
  echo '::error::Recipient certificate is not valid for CMS encryption.' >&2
  exit 1
fi

fingerprint=$("$OPENSSL_BIN" x509 -in "$CERTIFICATE_FILE" -outform DER \
  | sha256sum | awk '{print $1}')
[[ "$fingerprint" =~ ^[a-f0-9]{64}$ ]] || { echo '::error::Could not fingerprint recipient certificate.' >&2; exit 1; }

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'sha256=%s\n' "$fingerprint" >> "$GITHUB_OUTPUT"
  printf 'path=%s\n' "$CERTIFICATE_FILE" >> "$GITHUB_OUTPUT"
fi
echo "Recipient certificate validated; SHA-256: $fingerprint"
