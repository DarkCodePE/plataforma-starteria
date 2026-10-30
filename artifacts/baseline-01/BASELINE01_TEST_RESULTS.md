# BASELINE-01 — Resultados de verificación

Candidato probado: `198167f936c7a907d6e178c3d2c7481028d994d0`  
Checkout temporal limpio: eliminado al finalizar, tras conservar estos resultados.

## Matriz

| Área | Resultado | Evidencia |
|---|---|---|
| Instalación declarada | PASS con riesgo | `npm ci --ignore-scripts` y reconstrucción nativa de `bcrypt`; npm audit informó 37 vulnerabilidades (1 low, 8 moderate, 21 high, 7 critical), sin ejecutar autofix. |
| Prisma schema/client | PASS | `prisma validate` y `prisma generate`. |
| PostgreSQL desde cero | PASS | 67 migraciones sobre contenedor descartable, `migrate status` al día y `migrate diff` sin diferencias. |
| TypeScript | PASS | Typecheck frontend y backend. |
| Build frontend | PASS | Build Vite; sólo advertencia de tamaño de chunk. |
| Frontend unit/integration | PASS | 129 archivos, 1.023 tests. |
| Backend unit/integration | PASS | Con `TZ=UTC`: 198 archivos PASS, 33 skipped; 1.728 tests PASS, 160 skipped. |
| Baseline TZ | DOCUMENTED | Sin `TZ=UTC`, un único test de grandfathering falla por DST europeo (364,958 días); es sensibilidad ambiental reproducida, no regresión funcional. |
| PostgreSQL E2E focal | PASS | 5 archivos, 23 tests: R2 Steps 0–4, SEC-01, SEC-02B CAS/activación, Step Reasoning y continuidad KAN-178. |
| Python Step Reasoning | PASS | Docker aislado, `pytest tests/test_step_reasoning.py -q`: 7 PASS en 2,79 s; sin red ni LLM real. |
| Python instalable editable | FAIL no bloqueante del slice | `pip install -e .[dev]` detecta flat-layout con múltiples paquetes. Se instalaron dependencias declaradas de forma aislada para ejecutar pytest; debe corregirse packaging antes de distribución del servicio. |
| Playwright Step 0 | PASS | DB/servicios efímeros, activación explícita, tres turnos, reload y Pixel 5: 1 PASS. |
| Step 2/histórico UX | PASS previo / HVA pendiente | Cubiertos por suites frontend y evidencias CHAT-02/UX-03B ya existentes; no se usa esa evidencia para ratificar HVA humana. |
| KAN-178 | PASS | Comparación JSON semántica pre/post `true`; hashes de archivo distintos sólo por formato. |
| QA operativa | PASS | HTTP 200 en frontend `:5181`, backend `:4105`, AI stub `:8004` y Mailpit `:8027`. |

## Corrección del fixture E2E

El alta standalone legacy deja el Project sin tenant materializado y con `currentStep=1`. La activación SEC-02B preserva correctamente iniciativas avanzadas, por lo que el fixture no podía representar un Step 0 nuevo. La corrección se limita al PostgreSQL descartable: asigna la organización del actor y `currentStep=0`, y después invoca el endpoint explícito e idempotente de activación. No se relajó ninguna guarda ni se convirtió un GET en escritura.

## Límites de esta verificación

- No se probó teclado virtual Android/iOS físico: `REAL_MOBILE_KEYBOARD_NOT_RUN`.
- No se hizo llamada a proveedor LLM real.
- No se aplicó ninguna migración en QA persistente.
- No se ejecutaron push, PR, merge, tag, release ni deploy.

