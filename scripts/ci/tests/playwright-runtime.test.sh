#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
cd "$repo_root"

fail() {
  echo "playwright runtime contract: $*" >&2
  exit 1
}

require_text() {
  local file=$1
  local pattern=$2
  grep -Fq -- "$pattern" "$file" || fail "$file is missing: $pattern"
}

runtime_script=scripts/ci/playwright-runtime.sh
[[ -x "$runtime_script" ]] || fail "$runtime_script must exist and be executable"

require_text "$runtime_script" 'mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f'
require_text "$runtime_script" 'mcr.microsoft.com/playwright:v1.60.0-noble@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948'

require_text "$runtime_script" '--ipc host'
require_text "$runtime_script" '--publish "127.0.0.1:${port}:${port}"'
require_text "$runtime_script" 'node_modules/playwright/cli.js run-server --host 0.0.0.0'

for workflow in .github/workflows/ci.yml .github/workflows/cd.yml; do
  if grep -Fq -- 'playwright install --with-deps chromium' "$workflow"; then
    fail "$workflow still depends on Ubuntu apt repositories for Chromium"
  fi
  require_text "$workflow" 'PW_TEST_CONNECT_WS_ENDPOINT: ws://127.0.0.1:3000/'
  require_text "$workflow" "PW_TEST_CONNECT_EXPOSE_NETWORK: '<loopback>'"
done
require_text .github/workflows/ci.yml 'path: .ci-control-plane'
require_text .github/workflows/ci.yml '.ci-control-plane/scripts/ci/playwright-runtime.sh start'
require_text .github/workflows/ci.yml '.ci-control-plane/scripts/ci/playwright-runtime.sh stop'
require_text .github/workflows/cd.yml 'path: .cd-control-plane'
require_text .github/workflows/cd.yml '.cd-control-plane/scripts/ci/playwright-runtime.sh start'
require_text .github/workflows/cd.yml '.cd-control-plane/scripts/ci/playwright-runtime.sh stop'

# A historical release target does not contain the current control-plane helper.
# The current helper must still validate and serve the target's locked Playwright.
test_root=$(mktemp -d)
trap 'rm -rf -- "$test_root"' EXIT

make_target() {
  local root=$1
  local version=$2
  mkdir -p "$root/front/node_modules/playwright"
  printf '{"packages":{"node_modules/playwright":{"version":"%s"}}}\n' "$version" > "$root/front/package-lock.json"
  printf '{"version":"%s"}\n' "$version" > "$root/front/node_modules/playwright/package.json"
  touch "$root/front/node_modules/playwright/cli.js"
}

current_target="$test_root/current"
historical_target="$test_root/historical"
make_target "$current_target" 1.64.1
make_target "$historical_target" 1.60.0
[[ ! -e "$historical_target/scripts/ci/playwright-runtime.sh" ]]

current_image=$(PLAYWRIGHT_TARGET_ROOT="$current_target" "$runtime_script" validate)
historical_image=$(PLAYWRIGHT_TARGET_ROOT="$historical_target" "$runtime_script" validate)
[[ "$current_image" == *'v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f' ]]
[[ "$historical_image" == *'v1.60.0-noble@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948' ]]

printf '{"version":"1.64.1"}\n' > "$historical_target/front/node_modules/playwright/package.json"
if PLAYWRIGHT_TARGET_ROOT="$historical_target" "$runtime_script" validate >/dev/null 2>&1; then
  fail 'runtime accepted node_modules/playwright that disagrees with the historical lockfile'
fi

echo 'playwright runtime contract: PASS'
