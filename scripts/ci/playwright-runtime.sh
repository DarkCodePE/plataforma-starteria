#!/usr/bin/env bash
set -euo pipefail

control_plane_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
target_root=$(cd "${PLAYWRIGHT_TARGET_ROOT:-$control_plane_root}" && pwd)
action=${1:-}
port=${PLAYWRIGHT_SERVER_PORT:-3000}
raw_name="starteria-playwright-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-${GITHUB_JOB:-job}"
container_name=$(printf '%s' "$raw_name" | tr -cs 'a-zA-Z0-9_.-' '-')
runtime_image=''

container_exists() {
  docker container inspect "$container_name" >/dev/null 2>&1
}

stop_runtime() {
  if container_exists; then
    docker rm --force "$container_name" >/dev/null
  fi
}

image_for_version() {
  # Versions present in main history and therefore eligible for rollback/redeploy.
  # Add a digest here before accepting a target that upgrades Playwright.
  case "$1" in
    1.64.1)
      printf '%s' 'mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f'
      ;;
    1.60.0)
      printf '%s' 'mcr.microsoft.com/playwright:v1.60.0-noble@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948'
      ;;
    *)
      echo "No immutable Playwright runtime is approved for release target version $1." >&2
      return 1
      ;;
  esac
}

validate_runtime() {
  local lockfile="$target_root/front/package-lock.json"
  local cli="$target_root/front/node_modules/playwright/cli.js"
  local installed_package="$target_root/front/node_modules/playwright/package.json"
  [[ -f "$lockfile" ]] || {
    echo "Playwright lockfile is missing from release target: $lockfile" >&2
    return 1
  }
  [[ -f "$cli" ]] || {
    echo 'Playwright dependencies are missing from release target; run npm ci before starting the runtime.' >&2
    return 1
  }
  [[ -f "$installed_package" ]] || {
    echo "Installed Playwright package metadata is missing: $installed_package" >&2
    return 1
  }

  local locked_version installed_version
  locked_version=$(cd "$target_root/front" && node -e "const fs=require('node:fs');const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));process.stdout.write(lock.packages['node_modules/playwright'].version);")
  installed_version=$(cd "$target_root/front" && node -e "const fs=require('node:fs');const pkg=JSON.parse(fs.readFileSync('node_modules/playwright/package.json','utf8'));process.stdout.write(pkg.version);")
  [[ "$installed_version" == "$locked_version" ]] || {
    echo "Installed Playwright $installed_version does not match lockfile version $locked_version." >&2
    return 1
  }
  runtime_image=$(image_for_version "$locked_version")
}

case "$action" in
  start)
    validate_runtime
    if container_exists; then
      echo "Playwright runtime $container_name already exists; refusing to reuse it." >&2
      exit 1
    fi

    docker run --detach --rm \
      --name "$container_name" \
      --init \
      --ipc host \
      --publish "127.0.0.1:${port}:${port}" \
      --volume "$target_root/front:/work/front:ro" \
      --workdir /work/front \
      "$runtime_image" \
      node node_modules/playwright/cli.js run-server --host 0.0.0.0 --port "$port" \
      >/dev/null

    for _ in $(seq 1 30); do
      if ! docker container inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null | grep -Fxq true; then
        docker logs "$container_name" >&2 || true
        echo 'Pinned Playwright runtime stopped before becoming ready.' >&2
        exit 1
      fi
      if node -e "const net=require('node:net');const s=net.connect(${port},'127.0.0.1',()=>{s.end();process.exit(0)});s.setTimeout(1000,()=>{s.destroy();process.exit(1)});s.on('error',()=>process.exit(1));"; then
        echo "Pinned Playwright runtime is ready at ws://127.0.0.1:${port}/"
        exit 0
      fi
      sleep 1
    done

    docker logs "$container_name" >&2 || true
    stop_runtime
    echo 'Pinned Playwright runtime did not become ready within 30 seconds.' >&2
    exit 1
    ;;
  validate)
    validate_runtime
    echo "$runtime_image"
    ;;
  stop)
    stop_runtime
    ;;
  *)
    echo "Usage: $0 <start|stop|validate>" >&2
    exit 2
    ;;
esac
