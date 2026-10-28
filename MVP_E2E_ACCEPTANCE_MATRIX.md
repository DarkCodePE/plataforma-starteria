# MVP-INT-01 — Matriz E2E ejecutada

Fecha: 2026-10-26

| ID | Estado | Evidencia reproducible / observación |
|---|---|---|
| E2E-01 | PASS | KAN-180 base + tests Portfolio; Brief runtime y materialización ejecutados en la instancia final. |
| E2E-02 | PASS | Suites KAN-180/KAN-178 y regresión backend validan identidad/versionado del Brief. |
| E2E-03 | PASS | Regresión backend 1710/1710 incluye delivery, leases, retry y reconciliación; no se cambió el modelo KAN-180. |
| E2E-04 | PASS | KAN-178 navegador distingue challenge/existing y origen. |
| E2E-05 | PASS | KAN-178 HTTP y UI conservan Brief/Accept/Reject antes de Start. |
| E2E-06 | PASS | KAN-178 HTTP valida `ACCEPTED` sin Steps y Start explícito. |
| E2E-07 | PASS | KAN-178 HTTP 2/2 + navegador: resolver post-start read-only y reentrada estable. |
| E2E-08 | PASS | Capturas desktop/mobile de `EXISTING_READY`; mismo Project en Step 2. |
| E2E-09 | PASS | Captura y asserts de `EXISTING_ACTIVATION_REQUIRED`; sin creación lateral. |
| E2E-10 | BLOCKED | UI honesta `CHALLENGE_FORMULATION_REQUIRED` sin CTA muerto; comando KAN-179 no autorizado/publicado. |
| E2E-11 | PASS | Pruebas Owner/independiente y sesión Portfolio sin Handoff ficticio. |
| E2E-12 | PASS | UX-02B Playwright 1/1 y capturas 1440/768/390. |
| E2E-13 | PASS | Persistencia DB 3/3; aislamiento/contexto; failure-safe; stub QA declarado, no LLM real. |
| E2E-14 | PASS | `r2-persistence` Step 0→4 4/4 y caso exacto Decision Package PASS; sin decisión organizacional automática. |
| E2E-15 | PASS | `r2-persistence`: bloqueo sin binding y avance con Claim/Evidence/SourceRef persistidos. |
| E2E-16 | PASS | R2 persistence valida reload/idempotencia; regresión backend cubre Assignment/concurrencia. |
| E2E-17 | PASS | KAN-178 cross-tenant y Step reasoning tenant/user scope pasan. |
| E2E-18 | PASS | Capturas desktop/tablet/mobile; compositor y checkpoint comprobados por UX-02B. |
| E2E-19 | FAIL | Front/back/Prisma verdes; suite AI completa conserva 1 fallo basal y regresión browser ampliada tiene 5 fallos documentados. |
| E2E-20 | PASS | DB 5433 intacta; backups/hashes; sin credenciales/tokens en evidencia; sin staging/commit/merge/deploy. |

## Evidencia numérica

- Front unit: 992/992 PASS.
- Backend unit: 1710/1710 PASS con `TZ=UTC`.
- Focused integration: frontend 66/66; backend 21/21; AI Step reasoning 2/2; persistence 3/3.
- Adaptive Core DB E2E: 4/4 PASS.
- KAN-178 HTTP DB: 2/2 PASS.
- KAN-178 browser: PASS, 8 checks/7 screenshots/0 HTTP failures/0 console errors.
- Portfolio runtime final: 2/2 PASS.
- UX-02B browser: 1/1 PASS.
- Python 3.11 AI unit: 476 PASS, 1 FAIL basal, 16 deselected.
- Browser ampliado: 7 PASS, 5 FAIL; resumen saneado en `artifacts/mvp-integration/regression-summary.md`. Las trazas crudas se eliminaron porque podían incluir credenciales sintéticas.

Resultado global: `INTEGRATED_MVP_QA_PARTIAL / HVA_PENDING`.
