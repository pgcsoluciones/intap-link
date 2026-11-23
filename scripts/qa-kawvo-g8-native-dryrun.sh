#!/usr/bin/env bash
# KAW-G8 native dry-run; CI only, never upload/deploy.
set -euo pipefail
test "${GITHUB_EVENT_NAME:-}" = "pull_request" || { echo 'BLOCKED: PR CI only'; exit 1; }
test "$(node --version)" = "v22.12.0" || { echo 'BLOCKED: Node pin'; exit 1; }
BASE=71dd92b870482427d8576e68d89c3167bcfe8f12
git merge-base --is-ancestor "$BASE" HEAD
git diff --exit-code "$BASE" HEAD -- api/src api/wrangler.toml package-lock.json >/dev/null || { echo 'BLOCKED: G8 runtime or dependencies drift'; exit 1; }
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CF_API_TOKEN CF_API_KEY CF_EMAIL CF_ACCOUNT_ID || true
export CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false
export WRANGLER_SEND_METRICS=false
TMP="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kawvo-g8-native-dryrun-XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
echo '1/3 Pinned Wrangler native help'
npx --yes --package=wrangler@4.166.0 -- wrangler --version
npx --yes --package=wrangler@4.166.0 -- wrangler versions upload --help > "$TMP/help.txt"
for flag in --strict --keep-vars --dry-run; do
  grep -Fq -- "$flag" "$TMP/help.txt" || { echo "BLOCKED: Wrangler unsupported $flag"; exit 1; }
done
echo '2/3 Dry-run native versions upload; no Cloudflare credentials'
npx --yes --package=wrangler@4.166.0 -- wrangler versions upload \
  --config api/wrangler.toml --name intap-api --strict --keep-vars --dry-run \
  --outdir "$TMP/out" > "$TMP/output.log" 2>&1 || {
    # Never dump arbitrary output, which might contain unintended configuration.
    echo 'BLOCKED_NATIVE_DRY_RUN: Wrangler returned nonzero (private CI debug required; no upload)';
    exit 1;
  }
echo '3/3 PASS_NATIVE_DRY_RUN: no credentials, no upload, no traffic activation'
