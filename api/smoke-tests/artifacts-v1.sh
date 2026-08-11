#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

test -f api/migrations/0027_intap_artifacts.sql
test -f api/migrations-preview/0028_intap_artifacts.sql
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
! rg -q 'profile_products.*artifact|artifact.*profile_products' api/src/index.ts api/migrations/0027_intap_artifacts.sql

echo 'B2 artifact contract checks: PASS'
