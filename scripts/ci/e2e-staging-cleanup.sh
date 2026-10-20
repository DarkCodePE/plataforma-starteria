#!/usr/bin/env bash
# Manual-only cleanup for the isolated E2E staging namespace. It is never called by CI.
set -euo pipefail

namespace="${NAMESPACE:-starteria-e2e}"
if [[ "$namespace" != "starteria-e2e" || "$namespace" == "starteria" ]]; then
  echo "refusing cleanup outside starteria-e2e" >&2
  exit 2
fi
if [[ "${CONFIRM_E2E_STAGING_CLEANUP:-}" != "DELETE_STARTERIA_E2E" ]]; then
  echo "set CONFIRM_E2E_STAGING_CLEANUP=DELETE_STARTERIA_E2E to delete only $namespace" >&2
  exit 2
fi

kubectl get namespace "$namespace" >/dev/null
kubectl delete namespace "$namespace"
