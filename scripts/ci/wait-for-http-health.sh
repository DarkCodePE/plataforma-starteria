#!/usr/bin/env bash
set -euo pipefail

url="${1:?usage: wait-for-http-health.sh URL [attempts] [delay_seconds]}"
attempts="${2:-12}"
delay_seconds="${3:-5}"
curl_bin="${CURL_BIN:-curl}"
sleep_bin="${SLEEP_BIN:-sleep}"

[[ "$attempts" =~ ^[1-9][0-9]*$ ]] || { echo '::error::attempts must be a positive integer'; exit 2; }
[[ "$delay_seconds" =~ ^[0-9]+$ ]] || { echo '::error::delay_seconds must be a non-negative integer'; exit 2; }

for ((attempt = 1; attempt <= attempts; attempt++)); do
  code=$(
    "$curl_bin" --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --connect-timeout 5 --max-time 20 "$url" || true
  )
  if [[ "$code" == '200' ]]; then
    echo "Health check passed on attempt $attempt/$attempts."
    exit 0
  fi
  echo "Health check attempt $attempt/$attempts returned ${code:-transport-error}."
  if (( attempt < attempts )); then
    "$sleep_bin" "$delay_seconds"
  fi
done

echo "::error::Health check did not return 200 after $attempts bounded attempts"
exit 1
