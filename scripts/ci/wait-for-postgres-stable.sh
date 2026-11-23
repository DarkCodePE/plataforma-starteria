#!/usr/bin/env bash
set -euo pipefail

container=${1:?PostgreSQL container name is required}
attempts=${2:-60}
interval_seconds=${3:-1}
required_streak=${4:-2}

[[ "$attempts" =~ ^[1-9][0-9]*$ ]] || { echo '::error::PostgreSQL readiness attempts must be a positive integer'; exit 1; }
[[ "$interval_seconds" =~ ^[0-9]+$ ]] || { echo '::error::PostgreSQL readiness interval must be a non-negative integer'; exit 1; }
[[ "$required_streak" =~ ^[1-9][0-9]*$ ]] || { echo '::error::PostgreSQL readiness streak must be a positive integer'; exit 1; }

ready_streak=0
for _ in $(seq 1 "$attempts"); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready_streak=$((ready_streak + 1))
    if [[ "$ready_streak" -ge "$required_streak" ]]; then
      exit 0
    fi
  else
    ready_streak=0
  fi
  sleep "$interval_seconds"
done

echo "::error::PostgreSQL did not remain ready for $required_streak consecutive checks" >&2
exit 1
