#!/usr/bin/env bash
# KAW-G8-P0: deterministic Worker startup validation with local workerd.
# NO cloud credentials, no remote writes, no Production/Preview deployment, no D1/R2.
set -euo pipefail
test "$GITHUB_EVENT_NAME" = "pull_request" || { echo "BLOCKED: CI pull_request only"; exit 1; }
test "$(node --version)" = "v22.12.0" || { echo "BLOCKED: pinned CI Node missing"; exit 1; }
BASE="71dd92b870482427d8576e68d89c3167bcfe8f12"
git merge-base --is-ancestor "$BASE" HEAD
git diff --exit-code "$BASE" HEAD -- api/src api/wrangler.toml package-lock.json >/dev/null || { echo "BLOCKED: worker code/dependencies modified"; exit 1; }
TMP_WORKER="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kawvo-g8-worker-XXXXXX")"
trap 'rm -rf "$TMP_WORKER"' EXIT
echo "1/3 Building exact G8 esbuild module (local only)"
./node_modules/.bin/esbuild api/src/preview-free-entry.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --external:cloudflare:* --outfile="$TMP_WORKER/worker.mjs"
HASH="$(shasum -a 256 "$TMP_WORKER/worker.mjs" | awk '{print $1}')"
echo "Module SHA256: $HASH"
echo "esbuild in CI: $(./node_modules/.bin/esbuild --version)"
echo "Lockfile SHA256: $(shasum -a 256 package-lock.json | awk '{print $1}')"
if test "$HASH" != "f465c714f3a5b4b3627d58797be32621c674e7056e27ff4c36fbf8e09e96fbd6"; then
  echo "WARN_CI_BUNDLE_DIFFERS_FROM_MAC: startup test will cover CI-built source only, not exact Mac upload bytes"
fi

# Local config intentionally has no Production binding IDs/secrets, routes, cron or D1/R2.
# The purpose here is ONLY Worker module parse/startup validation, not handlers or data.
cat > "$TMP_WORKER/wrangler.toml" <<'EOF'
name = "kawvo-g8-offline-startup-validation"
main = "worker.mjs"
compatibility_date = "2024-02-08"
EOF
export WRANGLER_SEND_METRICS=false
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CF_API_TOKEN CF_API_KEY || true
echo "2/3 Wrangler 4 pinned local-only startup analysis"
# Wrangler detects monorepo root as an unsupported app; run against isolated temp project.
cd "$TMP_WORKER"
npx --yes --package=wrangler@4.166.0 -- wrangler --version
npx --yes --package=wrangler@4.166.0 -- wrangler check startup \
  --config "$TMP_WORKER/wrangler.toml" --args="--no-bundle"
echo "3/3 PASS_LOCAL_STARTUP: Workerd loaded exact G8 bundle (not a remote Cloudflare certification)"
