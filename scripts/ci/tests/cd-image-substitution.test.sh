#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail() {
  echo "CD control-plane source test: $*" >&2
  exit 1
}

step_working_directory() {
  local step_name=$1
  awk -v step_name="$step_name" '
    $0 == "      - name: " step_name { in_step=1; next }
    in_step && /^      - name:/ { exit }
    in_step && /^        working-directory:/ {
      sub(/^        working-directory:[[:space:]]*/, "")
      print
      exit
    }
  ' "$repo_root/.github/workflows/ci.yml"
}

# Model a reusable CI run whose release checkout predates this test while the
# nested checkout contains the current control plane. Release tests stay bound
# to the historical source; CD guard tests must resolve from the control plane.
release_source_sha=82509bb6fb5611747be92ef6f25e86b4f94f2578
historical_release="$tmp/release-$release_source_sha"
mkdir -p \
  "$historical_release/scripts/ci/tests" \
  "$historical_release/.ci-control-plane/scripts/ci/tests"
cp "$repo_root/scripts/ci/tests/release-parity.test.sh" "$historical_release/scripts/ci/tests/"
cp "$repo_root/scripts/ci/tests/cd-recovery.test.sh" "$historical_release/scripts/ci/tests/"
cp "$repo_root/scripts/ci/tests/cd-recovery.test.sh" "$historical_release/.ci-control-plane/scripts/ci/tests/"
cp "$repo_root/scripts/ci/tests/cd-image-substitution.test.sh" "$historical_release/.ci-control-plane/scripts/ci/tests/"

[[ ! -e "$historical_release/scripts/ci/tests/cd-image-substitution.test.sh" ]] \
  || fail 'historical release fixture unexpectedly contains the new CD test'

release_test_directory=$(step_working_directory 'Test immutable release parity contract')
[[ "$release_test_directory" == '.' ]] \
  || fail 'release parity test is not bound to the release checkout'
[[ -f "$historical_release/$release_test_directory/scripts/ci/tests/release-parity.test.sh" ]] \
  || fail 'release parity test does not resolve from the historical release checkout'

cd_guard_directory=$(step_working_directory 'Test production CD recovery guards')
[[ "$cd_guard_directory" == '.ci-control-plane' ]] \
  || fail 'CD guard tests are not bound to the current control plane'
for script in cd-recovery.test.sh cd-image-substitution.test.sh; do
  [[ -f "$historical_release/$cd_guard_directory/scripts/ci/tests/$script" ]] \
    || fail "$script does not resolve from the current control plane"
done

# Execute the real image-application shell block from cd.yml with a harmless
# kubectl double. This catches shell syntax drift in the workflow itself rather
# than validating a second copy of the substitution expression.
apply_images_script="$tmp/apply-images.sh"
awk '
  /^      - name: Apply manifests and set release images$/ { in_step=1 }
  in_step && /^        run: \|$/ { in_run=1; next }
  in_run && /^      - name:/ { exit }
  in_run { sub(/^          /, ""); print }
' "$repo_root/.github/workflows/cd.yml" > "$apply_images_script"
[[ -s "$apply_images_script" ]]

mkdir -p "$tmp/bin"
cat > "$tmp/bin/kubectl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *' apply -f - '* ]]; then
  cat >> "$KUBECTL_CAPTURE_DIR/rendered-deployments.yaml"
  printf '\n---\n' >> "$KUBECTL_CAPTURE_DIR/rendered-deployments.yaml"
fi
EOF
chmod +x "$tmp/bin/kubectl"

backend_digest="sha256:$(printf 'a%.0s' {1..64})"
frontend_digest="sha256:$(printf 'b%.0s' {1..64})"
ai_digest="sha256:$(printf 'c%.0s' {1..64})"

run_image_application() {
  local fixture_root=$1
  local backend=${2-$backend_digest}
  rm -f "$tmp/rendered-deployments.yaml"
  (
    cd "$fixture_root"
    PATH="$tmp/bin:$PATH" \
    KUBECTL_CAPTURE_DIR="$tmp" \
    DOCKERHUB_NAMESPACE=registry.example \
    NAMESPACE=starteria \
    ROLLOUT_TIMEOUT=1s \
    SOURCE_SHA=82509bb6fb5611747be92ef6f25e86b4f94f2578 \
    BACKEND_DIGEST="$backend" \
    FRONTEND_DIGEST="$frontend_digest" \
    AI_SERVICE_DIGEST="$ai_digest" \
    GITHUB_RUN_ID=synthetic \
    bash "$apply_images_script"
  )
}

assert_certified_images_rendered() {
  grep -Fq "image: registry.example/starteria-backend@$backend_digest" "$tmp/rendered-deployments.yaml"
  grep -Fq "image: registry.example/starteria-frontend@$frontend_digest" "$tmp/rendered-deployments.yaml"
  grep -Fq "image: registry.example/starteria-ai-service@$ai_digest" "$tmp/rendered-deployments.yaml"
  if grep -Eq 'image: .*starteria-(backend|frontend|ai-service):' "$tmp/rendered-deployments.yaml"; then
    echo 'rendered deployment retained a mutable image tag' >&2
    exit 1
  fi
}

tag_fixture="$tmp/tag-fixture"
mkdir -p "$tag_fixture"
cp -R "$repo_root/k8s" "$tag_fixture/k8s"
run_image_application "$tag_fixture" >/dev/null
assert_certified_images_rendered

digest_fixture="$tmp/digest-fixture"
mkdir -p "$digest_fixture"
cp -R "$repo_root/k8s" "$digest_fixture/k8s"
for svc in backend frontend ai-service; do
  sed -E -i "s#image: [^[:space:]]+/starteria-$svc:[^[:space:]]+#image: registry.example/starteria-$svc@sha256:$(printf 'd%.0s' {1..64})#" \
    "$digest_fixture/k8s/$svc-deployment.yaml"
done
run_image_application "$digest_fixture" >/dev/null
assert_certified_images_rendered

if run_image_application "$tag_fixture" '' >/dev/null 2>&1; then
  echo 'image application accepted an empty certified digest' >&2
  exit 1
fi
if run_image_application "$tag_fixture" 'sha256:not-a-digest' >/dev/null 2>&1; then
  echo 'image application accepted an invalid certified digest' >&2
  exit 1
fi

invalid_fixture="$tmp/invalid-fixture"
mkdir -p "$invalid_fixture"
cp -R "$repo_root/k8s" "$invalid_fixture/k8s"
sed -E -i 's#image: [^[:space:]]+/starteria-backend:[^[:space:]]+#image: registry.example/not-certified:latest#' \
  "$invalid_fixture/k8s/backend-deployment.yaml"
if run_image_application "$invalid_fixture" >/dev/null 2>&1; then
  echo 'image application accepted a manifest without the certified service image' >&2
  exit 1
fi

echo 'CD image substitution tests passed.'
