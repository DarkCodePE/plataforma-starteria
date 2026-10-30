# MVP-INT-01 — Release gates

| Gate | Resultado | Evidencia / motivo |
|---|---|---|
| Base KAN-180 publicada y SHA verificado | PASS | local = remoto `fd0757e...` |
| Worktree aislado | PASS | `feat/mvp-integrated-qa-20261026` |
| WIP fuente protegido | PASS | backups + hashes + revalidación de HEAD/status |
| Sin staging/commit/push/merge/deploy | PASS | index vacío; rama permanece en SHA base |
| Prisma en DB nueva | PASS | 67 migraciones, validate PASS, diff sin drift |
| Typecheck frontend/backend | PASS | ambos proyectos |
| Lint y builds | PASS | frontend y backend; sólo warnings de chunks existentes |
| Unit frontend | PASS | 992/992 |
| Unit backend | PASS | 1710/1710 con `TZ=UTC`; 141 tests con gates explícitos skipped |
| AI-01/AI-02 focal | PASS | 2/2 Python + suites frontend/backend focales |
| AI unit completo | FAIL_BASELINE | 476 PASS, 1 FAIL basal `test_app_has_ai_router_mounted`, 16 deselected |
| KAN-178 HTTP DB E2E | PASS | 2/2 |
| KAN-178 navegador | PASS | 8 checks, 7 capturas, 0 respuestas fallidas, 0 console errors |
| UX-02B navegador | PASS | 1/1; desktop/tablet/mobile |
| Portfolio → Steps materialization | PASS | 1/1 en instancia final |
| Brief runtime Portfolio | PASS | 1/1 en instancia final |
| Step 0→4 + CP-1.3 persistente | PASS | R2 persistence 4/4; Decision Package E2E exacto PASS |
| Regresión browser histórica completa | FAIL | 5 fallos/12: 1 harness CP-1.3 obsoleto + 4 expectativas UI/gobernanza históricas |
| KAN-179 dashboard entry | BLOCKED | contrato propuesto, sin autoridad/implementación publicada |
| HVA humana | BLOCKED | requiere revisión humana; Playwright no acepta visualmente |
| Producción | NOT_RUN | fuera de alcance y no autorizada |

## Decisión

`INTEGRATED_MVP_QA_PARTIAL / HVA_PENDING`.

No se declara `INTEGRATED_MVP_QA_TECH_PASS` porque la regresión browser ampliada no está completamente verde y KAN-179 sigue sin autoridad publicada.
