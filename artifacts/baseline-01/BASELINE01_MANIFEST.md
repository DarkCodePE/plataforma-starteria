# BASELINE-01 — Manifiesto del candidato local

Fecha de cierre técnico: 2026-10-28  
Rama local: `baseline/mvp-lite-20261028`  
Candidato de código: `198167f936c7a907d6e178c3d2c7481028d994d0`  
Estado: `BASELINE01_LOCAL_COMMITS_REPRODUCIBLE / NO_PUSH / NO_MERGE / NO_DEPLOY`

## Punto de partida y remoto observado

- HEAD de entrada: `fd0757ea93470a6d1ec0ac7faf6734fd7fc97a2f`.
- PR #222 seguía abierto y apuntaba a ese mismo head al inspeccionarlo; no se aplicó ni fusionó de nuevo.
- `origin/main` observado por `git ls-remote`: `0a0d18460513e173eab08cf81888a8f14c8bb3d3`.
- No se ejecutaron fetch mutante, rebase, merge, push, tag, release ni deploy.

## Commits locales revisables

| SHA | Parent | Grupo | Contenido principal |
|---|---|---|---|
| `21a122af83edaf23457895d5c2b45eab51a20333` | `fd0757ea93470a6d1ec0ac7faf6734fd7fc97a2f` | Portfolio/Handoff | Continuidad post-start del Owner y lectura Portfolio asociada. |
| `b0dafe92f0cbad2e61d7cdeb158501ddf17f89f2` | `21a122af83edaf23457895d5c2b45eab51a20333` | SEC/datos | Autoridad efectiva, aislamiento, CAS, activación explícita y lecturas canónicas. |
| `c6f7ab250f3bb9ed36179974849097357f72627d` | `b0dafe92f0cbad2e61d7cdeb158501ddf17f89f2` | Steps/UX | Step Reasoning, migración 67, Chat-02, UX-03B y ChatFix. |
| `6f9108bd5c45a9b11b46ce3d0be1ff6fcf81a468` | `c6f7ab250f3bb9ed36179974849097357f72627d` | Pruebas | Regresión integrada, E2E y harness QA. |
| `198167f936c7a907d6e178c3d2c7481028d994d0` | `6f9108bd5c45a9b11b46ce3d0be1ff6fcf81a468` | Fixture E2E | Fixture Step 0 con tenant y activación explícita en DB descartable. |

El commit documental posterior no cambia el SHA del candidato ejecutable anterior.

## Backup y restaurabilidad del WIP

- Ubicación protegida, fuera del repositorio: `C:\Users\User\proyect-starteria\_codex-backups\BASELINE01-20261028`.
- Archivo: `baseline01-wip-files.tgz`.
- SHA-256: `B82FD1AC0DBD14A58D83F4A3742901E21708CDE423ED72EFBA509D8D2DCCCE1B`.
- 366 archivos tracked modificados o untracked no ignorados inventariados y verificados uno a uno tras restauración aislada: 366/366 PASS.
- El backup excluye `.env`, secretos, claves, dumps, bases, logs vivos y PIDs runtime. No se leyó ni distribuyó ningún secreto.
- Hash del schema completo conservado en el WIP original: `E8DF99615479DFD327FC2556FE196DB485DD77A40CFB333AEEA5E12DCBB8829C`.
- Hash del SQL experimental 68 conservado: `4DF869FED1AE07030E2AEA8FBBBBB1861890DBA158F9F165AA339A6DDE125106`.

## Alcance incluido

- Continuidad Handoff/Portfolio del Owner sin reinicializar ciclos.
- Guardas SEC-01/SEC-02B, autoridad efectiva, aislamiento tenant/Project y CAS compatible con el esquema aprobado.
- Operación explícita de activación del ciclo con preservación de iniciativas avanzadas.
- Step Reasoning persistente de Chat-01/02, migración 67 y UI Steps 0–4 UX-03B/ChatFix.
- Pruebas unitarias, de integración, PostgreSQL y Playwright necesarias para reproducir el candidato.

## Alcance excluido del candidato y preservado en WIP

- Migración `20261027120000_ai03a_step_living_card` (número 68).
- Modelos/enums/relaciones `StepLivingCard*` del schema completo.
- Backend Living Card, contratos API, tests, router y montaje de ruta AI-03A.
- `LivingCardPreview`, E2E, fixtures y artefactos AI-03A.
- Cualquier aplicación de la migración 68, Card viva o escritura UI asociada.
- Artefactos de runtime como `qa-pids.json`, secrets y material ignorado.

## Protección de datos y plataforma

- KAN-178 no se modificó. La comparación semántica pre/post fue `true`.
- PostgreSQL QA `:55436`, `starteria-db:5433` y producción no recibieron migraciones ni escrituras de prueba.
- Todas las escrituras de verificación usaron PostgreSQL/Docker descartable.
- QA quedó operativa: frontend, backend, AI stub y Mailpit respondieron HTTP 200 al cierre.

