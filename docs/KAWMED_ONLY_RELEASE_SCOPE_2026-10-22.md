# KawMed-only production integration — scope gate

Base branch: `main` at `2391896286839528557066968ca4b8abe9831fb9`.
Feature source: `reconcile/kawmed-medical-profile-v1-2026-10-19-v2`.
**This release branch is deliberately based on production main, NOT on the entire feature branch.**

## Functional invariants
- Free, Sponsored and Trial plans: no behavior, limits, login, onboarding, billing, visibility or rights changes.
- No demo patient seeds or preview profile assets copied to production.
- Preserve existing domain routing, QR/NFC profiles, public links, account data and existing D1 rows.
- Reuse only the 11 tested additive KawMed migrations (0090–0099 and 0150).
- Any shared file change requires an identified KawMed entry point, focused diff review and regression contract verification.
- A green CI result on the broad feature branch is NOT evidence that an isolated release cherry-pick compiles.

## Diff inventory before isolation
`main...reconcile/kawmed-medical-profile-v1-2026-10-19-v2`: 319 commits, 76 changed paths at time of assessment; material changes in the following shared modules:
- `api/src/index.ts`, `api/src/preview-free-entry.ts`, `api/src/account-home-route.ts`, `api/src/sponsor-*.ts`, `api/src/sponsored-*.ts`
- `app/src/App.tsx`, `app/src/components/admin/AdminLogin.tsx`, `AuthCallback.tsx`, `SuperAdminLayout.tsx`, `SponsorDashboard.tsx`, `PwaNotificationBridge.tsx`
- `web/src/App.tsx`, appointment modal and owner bar.

**Do not merge the entire 319-commit branch or use the old KawMed deploy runner.** This branch begins with scope gate only; it is not runnable KawMed release.

## Integration order
1. Copy exact approved medical migrations without Preview fixtures; verify contents and dependencies.
2. Copy medical-only API modules and explicit route registration, minimizing changes to shared router.
3. Copy medical-only App/Web components, wire their routes via narrowly scoped edits.
4. Run existing Free/Sponsored/Trial contracts and KawMed contracts together; build all workspaces and typecheck.
5. Rehearse migration and check no additional tables/fixtures; compare diff against allowlist.
6. Only then prepare command to publish compatible Worker, App and Web, with D1 checkpoints and monitored smoke.

## Release acceptance
No production writes until this isolated branch builds and regression checks pass; existing backup remains valid but confirm freshness before deploy. Any need to modify shared contracts is a release blocker requiring focused compatibility analysis, never silently copy broad feature diffs.
