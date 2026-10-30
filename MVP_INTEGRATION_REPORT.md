# MVP-INT-01 — Informe de integración

Fecha: 2026-10-26

Estado: `INTEGRATED_MVP_QA_PARTIAL / HVA_PENDING`

## Resultado

Se construyó una plataforma QA única sobre `origin/feat/KAN-180-portfolio-lead-integration` (`fd0757ea93470a6d1ec0ac7faf6734fd7fc97a2f`) en el worktree aislado `starteria-mvp-integrated-qa-20261026` y la rama local `feat/mvp-integrated-qa-20261026`.

La instancia integra:

- KAN-180 publicado como base de Portfolio Lead.
- Continuidad post-start compatible de KAN-178, con resolución read-only para `EXISTING_READY`, `EXISTING_ACTIVATION_REQUIRED` y `CHALLENGE_FORMULATION_REQUIRED`.
- AI-01/AI-02 con persistencia por tenant, usuario, proyecto, ciclo y step.
- UX-02B para Step 0, con misión/procedencia, Copilot prioritario y acciones de revisión/confirmación diferenciadas.
- Un stub determinista de IA sólo para QA; no se configuró ni simuló un proveedor LLM real.

No se modificaron Adaptive Core, gates, reglas de checkpoint ni autoridad organizacional. No hubo staging, commit, push, merge ni despliegue.

## KEEP / ADAPT / NEW

### KEEP

- Base publicada KAN-180, sus modelos de entrega, leases, estados y flujo Portfolio Lead.
- Rutas canónicas de Invitation/Accept/Start y Step Core existentes.
- Feature flag y fallback de Step reasoning.
- Bases, ramas y worktrees fuente originales.

### ADAPT

- `schema.prisma`: combinación semántica de KAN-180 con `StepReasoningSession` y `StepReasoningTurn`; se preservaron los modelos KAN-180.
- Constraint de sesión de Step reasoning mapeada al nombre real truncado por PostgreSQL para que Prisma no detecte drift.
- Helper visual KAN-178 habilitado únicamente para la DB QA aislada mediante `MVP_INT01_QA=1`.
- `HandoffInvitationPage`: después de `STARTED` consulta continuidad sin repetir Accept/Start ni crear entidades.

### NEW

- Módulos AI/backend/frontend de Step reasoning y migración `20261026160000_step_reasoning_session_turn`.
- Resolver post-start KAN-178, repositorio, router, UI y pruebas.
- Scripts `scripts/mvp-integration/start-qa.ps1`, `stop-qa.ps1` y stub determinista.
- Evidencia integrada en `artifacts/mvp-integration/`.

## Límites y bloqueos honestos

- KAN-179 sólo existe como contrato propuesto y no como autoridad/implementación publicada. El camino canónico por Invitation funciona, pero no se inventó una entrada nueva desde dashboard; queda `BLOCKED_PENDING_KAN179`.
- AI-03, Card viva persistente y proveedor LLM real están fuera de alcance.
- El preflight y la decisión MVP mencionados por el Goal no estaban disponibles; se reprodujeron manualmente fetch, SHA, worktrees, status, patches, tar de untracked y hashes antes de integrar.
- La HVA humana sigue pendiente. Las capturas Playwright no constituyen aceptación visual.
- Una spec histórica `adaptive-core-prd03.spec.ts` intenta avanzar CP-1.3 sin bindings persistidos y recibe correctamente `CHECKPOINT_TRUTH_BINDING_REQUIRED`. El E2E vigente `r2-persistence.e2e.test.ts` sí valida bloqueo sin bindings y avance con `Claim/Evidence/SourceRef` reales.
- Cuatro aserciones de `entry-d-assigned.spec.ts` fuera del recorrido Step 0–4 fallan por expectativas históricas de UI/gobernanza. El caso exacto Step 0–4 → Decision Package pasa, pero esos fallos impiden declarar una regresión E2E global limpia.
- La suite unitaria completa de AI tiene un fallo basal: `test_app_has_ai_router_mounted` importa la app mínima sin rutas `/api/v1`. El mismo fallo fue reproducido en la base KAN-180; los 476 tests restantes pasan en Python 3.11 y los 2 tests nuevos de Step reasoning pasan.

## Veredicto

La plataforma está levantada y es evaluable, pero el estado no se eleva a `INTEGRATED_MVP_QA_TECH_PASS`: KAN-179 carece de autoridad publicada, quedan fallos E2E históricos documentados y la HVA humana está pendiente.
