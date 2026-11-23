# KAN-258 — V2_CHANGE_GUARDRAIL_CHECK, reconciliación previa (2026-11-23)

**Resultado: Proceed: NO, para comenzar a editar `front/` desde `main` en este momento.**

## Evidencia de autoridad y baseline

- KAN-257#10870: dirección visual V4.2 ratificada para handoff.
- KAN-259#10873: condiciones y hashes exactos del baseline.
- KAN-259#10874: ratificación humana **expresa** de Product ADR-012 contra PR #352 @ `74d6982503bfa2021db38b31e0e81993fe6899f7`, aceptando las ocho condiciones.
- Product ADR-012: **ACCEPTED** en la rama documental reconciliada; `doc/product-adr/ADR-012-public-landing-v4-ecosystem-narrative.md`.
- Visual V4.2: 27 archivos en PR #352 (abierto); `docs/design-references/landing-v4-2/Starteria_Landing_V4_2_Secciones.html`, QA, evidencias y capturas exactas.
- Product ADR-011 + KAN-255: autoridad y estado factual del **runtime React actual**.
- `STARTERIA_V2_MANIFEST.md`, `CURRENT_STATE.md` y Authority Map: reconciliados en esta rama; aún no integrados en `main`.
- PR de código KAN-258: no existe y no está autorizado a iniciar desde `main` hasta resolver dependencia de documentos.

## V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-257_PUBLIC_LANDING_V4_INTEGRATED_NARRATIVE / KAN-258
Authority: Product ADR-012 ACCEPTED via KAN-259#10874; ADR-011 preserved for existing runtime; Design System Contract v0.1, Page Anatomy System v0.1
Manifest status: APPROVED_V2_TARGET_NOT_YET_RUNTIME on docs authority branch; main still has candidate or previous authority before reconciliation merge
Current route: / → front/src/app/routes.ts → LandingPage.tsx; /public/start independent under PublicLayout
Legacy dependencies: KAN-255 four-stage StarteriaInteractiveStory.tsx, TransformationFlow.tsx, landing.css; existing external Fab link and configured demo CTAs
Semantic owner: Public Landing V2, route / only
V1 assumptions detected: historical ADR-019 comments in routes.ts and old UI framing; no authority to carry a legacy Portfolio Entry funnel into the new landing
Adapter required: scoped frontend presentation adaptation only; no backend, schema, auth, productive AI, Core, Step 0-4 or sw-factory changes
Tests protecting current behavior: LandingPage.test.tsx; routes.public-entry.test.tsx; public-landing-l1.spec.ts; portfolio-entry-conversion.spec.ts
Tests required for V2: current tests plus three-perspective interaction, keyboard/tab/FAQ/mobile/reduced-motion, CTA destination, zero /public/start links, fictitious KPI labels, 390/768/1024/1440 visual parity, typecheck/lint/build/Vitest/Playwright, independent review
Authority conflict: target Product ADR-012 ratified in Jira and reconciled in stacked documentation branch, BUT main does not yet contain the exact baseline PR #352 or reconciled ADR/Manifest/Authority Map; implementation from main would see stale authority
Proceed: NO (from main, before integrating or constructing a verified combined authority checkout)
```

## Cuatro gates

| Gate | Revisión | Resultado |
|---|---|---|
| Contract | Product ADR-012 accepted, perímetro y CTA verificables en rama documental | **PASS en la rama; no sincronizado con main** |
| Dependency | El único front permitido es landing pública, sin nuevos flujos o consumidores | **SCOPED / verificar en checkout de KAN-258** |
| E2E | El prototipo V4.2 pasó QA de referencia; la implementación React todavía no existe | **PENDING POST-IMPLEMENTATION** |
| Retirement | Se reemplazará el framing KAN-255 de cuatro etapas sin eliminar rutas, auth ni Portfolio Entry | **KEEP_COMPAT hasta pruebas React** |

## Condiciones para repetir y obtener YES

1. Los PR documentales de baseline (#352) y reconciliación de autoridad se integran **solo tras revisión y autorización humana separada**, o una rama de trabajo de implementación incluye exactamente todos los documentos aceptados y el baseline con linaje verificable, conforme a la política de trabajo desde main.
2. Verificar en el checkout de KAN-258 los hashes exactos V4.2 del comentario 10873, la presencia y estado ACCEPTED del ADR-012, y el Manifest/Authority Map/Current State conciliados.
3. Comprobar el current-state y el significado de los tests antes del cambio; confirmar que no se introduce semántica legacy ni nuevas capacidades/productos.
4. Volver a emitir un **nuevo** V2_CHANGE_GUARDRAIL_CHECK referido al commit exacto de ese checkout. Solo con `Proceed: YES` se puede editar `front/`.
5. Mantener QA y PR de implementación separados, sin merge ni CD automáticos.

**No ejecutamos una suite de runtime ni un script de CI de KAN-258:** el guardrail aquí es el informe de decisión previo a implementación exigido por `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md` §20, no una certificación de React.
