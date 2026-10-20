#!/usr/bin/env bash
# Renders the existing Kubernetes workload manifests into an isolated E2E namespace.
# This script intentionally never applies resources itself.
set -euo pipefail

: "${NAMESPACE:?NAMESPACE is required}"
: "${E2E_STAGING_BASE_URL:?E2E_STAGING_BASE_URL is required}"
: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
: "${FRONTEND_IMAGE:?FRONTEND_IMAGE is required}"
: "${AI_SERVICE_IMAGE:?AI_SERVICE_IMAGE is required}"

output_dir="${1:?output directory is required}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "$NAMESPACE" != "starteria-e2e" ]]; then
  echo "refusing to render outside the isolated starteria-e2e namespace" >&2
  exit 2
fi
if [[ "$E2E_STAGING_BASE_URL" != https://* ]]; then
  echo "E2E_STAGING_BASE_URL must use https" >&2
  exit 2
fi

mkdir -p "$output_dir"
python3 - "$repo_root" "$output_dir" "$NAMESPACE" "$E2E_STAGING_BASE_URL" \
  "$BACKEND_IMAGE" "$FRONTEND_IMAGE" "$AI_SERVICE_IMAGE" <<'PY'
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
output_dir = pathlib.Path(sys.argv[2])
namespace, base_url, backend_image, frontend_image, ai_image = sys.argv[3:]
files = [
    "postgres-service.yaml",
    "postgres-statefulset.yaml",
    "backend-service.yaml",
    "frontend-service.yaml",
    "ai-service-service.yaml",
    "cloudflared-service.yaml",
    "backend-storage-pvc.yaml",
    "backend-deployment.yaml",
    "frontend-deployment.yaml",
    "ai-service-deployment.yaml",
    "cloudflared-deployment.yaml",
]
images = {
    "backend-deployment.yaml": backend_image,
    "frontend-deployment.yaml": frontend_image,
    "ai-service-deployment.yaml": ai_image,
}
for filename in files:
    path = root / "k8s" / filename
    text = path.read_text(encoding="utf-8")
    text = text.replace("  namespace: starteria\n", f"  namespace: {namespace}\n")
    if filename in images:
        text, count = re.subn(
            r"(\n\s*image:\s*)[^\s]+/starteria-(?:backend|frontend|ai-service):[^\s]+",
            lambda match: match.group(1) + images[filename],
            text,
            count=1,
        )
        if count != 1:
            raise SystemExit(f"could not replace image in {filename}")
    if filename == "backend-deployment.yaml":
        if 'value: "https://starter-ia.com"' not in text:
            raise SystemExit("could not find backend CORS origin")
        text = text.replace('value: "https://starter-ia.com"', f'value: "{base_url}"')
        # Staging must never target a real mailbox, even if a provider secret is supplied.
        text = text.replace('value: "okuanb@gmail.com"', 'value: "e2e-staging@invalid"')
    if filename == "ai-service-deployment.yaml":
        text = text.replace('value: "production"', 'value: "e2e-staging"')
        text = text.replace('value: "starteria"', 'value: "starteria-e2e"')
    if "namespace: starteria\n" in text:
        raise SystemExit(f"production namespace remained in {filename}")
    (output_dir / filename).write_text(text.rstrip() + "\n", encoding="utf-8")
PY

grep -R -q "namespace: starteria-e2e" "$output_dir" || {
  echo "rendered output has no staging namespace" >&2
  exit 1
}
if grep -R -q "namespace: starteria$" "$output_dir"; then
  echo "rendered output still references the production namespace" >&2
  exit 1
fi
