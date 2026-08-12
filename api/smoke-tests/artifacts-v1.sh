#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

test -f api/migrations/0027_intap_artifacts.sql
test -f api/migrations-preview/0028_intap_artifacts.sql
test -f api/migrations/0028_artifact_activation_intents.sql
test -f api/migrations-preview/0029_artifact_activation_intents.sql
test -f api/src/artifacts.ts
test -f app/src/components/admin/ArtifactActivation.tsx

rg -q 'CREATE TABLE IF NOT EXISTS intap_artifacts' api/migrations/0027_intap_artifacts.sql
rg -q 'CREATE TABLE IF NOT EXISTS artifact_activation_codes' api/migrations/0027_intap_artifacts.sql
rg -q 'activation_code_hash' api/migrations/0027_intap_artifacts.sql
rg -Fq "app.get('/api/v1/public/artifacts/:publicCode/resolve'" api/src/index.ts
rg -Fq "app.post('/api/v1/public/artifacts/activation/inspect'" api/src/index.ts
rg -Fq "me.post('/artifacts/activate'" api/src/index.ts
rg -Fq "me.patch('/artifacts/:id/profile'" api/src/index.ts
rg -Fq 'const artifactMatch = url.pathname.match' functions/_middleware.ts
rg -Fq 'status: 302' functions/_middleware.ts
rg -Fq 'Cache-Control' functions/_middleware.ts
rg -Fq 'artifact_activation_intents' api/src/index.ts
rg -Fq 'artifact_activation_claim_assertions' api/src/index.ts
rg -Fq 'artifact_activation_claim_assertions' api/migrations/0029_artifact_activation_claims.sql
! rg -q 'CREATE TRIGGER|RAISE\(|BEGIN TRANSACTION|COMMIT' api/migrations/0029_artifact_activation_claims.sql api/migrations-preview/0030_artifact_activation_claims.sql
! rg -q 'intap_activation_code' app/src/components/admin/ArtifactActivation.tsx app/src/components/admin/AuthCallback.tsx
! rg -q 'profile_products.*artifact|artifact.*profile_products' api/src/index.ts api/migrations/0027_intap_artifacts.sql

echo 'B2 artifact contract checks: PASS'
