# KAW-SP-ID — Identidad de patrocinio accesible

Base Preview: 2bc1baf743b73d10ee88dbdecff58ae616d88e97 (KAW-SP-WA). Owner feedback 2026-11-26: identity is central, not secondary.

Scope: Master Link and Master Kawmed shell UI only. Add direct shortcuts in Inicio and Patrocinios / Gestión de patrocinio; keep existing Más shortcut and canonical deep links for backward compatibility. Identity visually belongs to Patrocinios, with explicit return to that area. All three shortcuts reuse the existing editor, same tenant context and existing navigation handlers. New targets minimum 44px, wrapping labels and existing semantic icon. No additional fields, API calls, migration, dependencies, public Web, Workers, or changes in credentials, sponsor grants or data.

QA: both authorized Master accounts at 320/360/390/430 and desktop; Home and sponsorship shortcuts, same editor, save/reload, back to sponsorship, browser back/forward and direct old More URL; switch account, preserve isolation and pending edits. Existing code filters retained. Beneficiary, doctor and delegate unchanged. CI and authenticated QA required; App-only Preview stage, preserve API module and Web, 39 bindings; no Production approval.
