# KAN-96 — Strategic Intent Hydration D2 v0.1

**Estado:** `BLOCKED` — runtime no implementado por identidad D1 no disponible en la continuación persistida actual.

## A. Preconditions

| Check | Resultado |
|---|---|
| Worktree | `C:\Users\User\proyect-starteria\starteria-KAN-96` |
| Branch | `feat/KAN-96-strategic-intent-hydration` |
| Working tree al inicio | Limpio |
| HEAD == origin/main | Sí — `29dccaac001ea7f99ef0f6e3cf1b432526069804` |
| Jira KAN-96 | En curso |
| Jira KAN-74 | En curso |
| Jira KAN-88 | RESUELTO |
| Jira KAN-89 | RESUELTO |
| Jira KAN-90 | RESUELTO |
| Jira KAN-83 | RESUELTO |

Jira fue consultado antes de editar. No se creó ningún commit.

## B. Authority trace

- `docs/STARTERIA_AUTHORITY.md` declara `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` como Core vigente factual. `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` es candidato no promovido. No se cambia Core ni Steps 0–4.
- `STARTERIA_V2_MANIFEST.md` y `CURRENT_STATE.md` consultados para el estado de los slices; First Value está promovido y D2 no está implementado.
- Jira KAN-96 delimita el runtime D2; KAN-74 mantiene la continuidad y los límites de KAN-63; KAN-88 aprueba el mapping; KAN-89 promueve el resolver; KAN-90 habilita evidencia explícita de confirmación; KAN-83 promueve el First Value vigente.
- Contrato aplicado: `docs/portfolio-lead/06-portfolio-monitoring/contracts/STARTERIA_PORTFOLIO_ENTRY_TO_FIRST_VALUE_INITIALVALUE_MAPPING_v0.1.md` (`MAPPING_CONTRACT_APPROVED`).
- Reportes consultados: KAN-89 confirmed Brief resolver, KAN-90 confirmation coverage y KAN-83 First Value runtime hardening.
- También se consultaron `AGENTS.md`, `TESTING.md`, `.claude/skills/implementar/SKILL.md`, guardrails y playbook V2, la ruta `/portfolio/setup`, el cliente/DTO D1 y el flujo autenticado de continuación.

## C. V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-74 D2 / KAN-96 — Strategic Intent hydration en First Value
Authority: Jira KAN-96/KAN-74/KAN-88/KAN-89/KAN-90/KAN-83; mapping contract aprobado; KAN-63/A.3.2 para First Value; Core v0.2 factual
Manifest status: D1 y First Value promovidos; D2 runtime ausente
Current route: /portfolio/setup, PortfolioLeadFirstValuePage bajo PortfolioLeadLayout
Legacy dependencies: ninguna adoptada; storage actual de claimed session solo guarda sessionId
Semantic owner: V2 para projection/hydration; Portfolio Entry y D1 conservan su autoridad vigente
V1 assumptions detected: ninguna aceptada
Adapter required: sí — identidad exacta D1 hacia cliente D1 y proyección
Tests protecting current behavior: First Value P1/P2/P3 tests; KAN-63 checkpoint/state-preservation tests; D1 resolver regression; Portfolio Entry/auth continuation tests
Tests required for V2: mapper/serializer puros, resolver client, hydrate-once/error UX, directed E2E y matriz del usuario
Authority conflict: el contrato requiere la identidad exacta persistida; el continuation storage actual solo persiste sessionId. Obtener los demás campos vía latest lookup/recalcular revisión está prohibido; persistirlos requiere modificar el handoff de Portfolio Entry excluido por la tarea
Proceed: NO — falta una fuente autorizada y persistida para sessionRevision, handoffId/version y confirmationId/version al entrar a /portfolio/setup
```

## D. Entry condition and identity finding

El journey actual de `AuthenticatedProvisionalContinuationPage` confirma la lectura y luego invoca `continuePortfolioEntryToPortfolio`. El almacenamiento `CLAIMED_SESSION_KEY` en `front/src/features/portfolio-entry/public/storage.ts` valida y devuelve únicamente `{ sessionId }`. La respuesta de la confirmación se guarda en estado local de esa pantalla; no se persiste el identity tuple para el destino de First Value.

D1 requiere `sessionId` en la ruta más los valores exactos `source`, `sessionRevision`, `handoffId`, `handoffVersion`, `confirmationId` y `confirmationVersion`. Ni un lookup de la versión más reciente ni calcular `revision + 1` son sustitutos válidos. Tampoco es válido usar `rawEntry` u otro Brief.

El usuario excluyó cambios a Portfolio Entry y exige consumir la identidad exacta ya persistida. En el baseline revisado, esa identidad no existe en el continuation storage. No hay una forma autorizada de completar este puente sin una decisión/ajuste de alcance que autorice persistir el tuple exacto producido por la confirmación y preservar su vigencia después del handoff. Por ello no se inició la integración.

## E. Projection, confirmation and serialization

No se implementaron mapper ni serializer porque no existe un identity tuple con el que invocar D1 de manera conforme. El mapping aprobado permanece: `desired_outcome → goal`; `understanding → situation`; `decision_to_enable → decisionToEnable`; `known_context → knownContext`; campos confirmados de `unresolved_context` y `evidence_or_clarity_needed → openQuestions`; `recommended_approach → approachHypothesis` solo si accepted/corrected. Los estados terminales contradictorios invalidan la respuesta; rejected/unconfirmed se omiten; `rawEntry` nunca es fallback. Los labels/order definidos por el contrato quedan pendientes de implementación.

## F. Hydration, local edits, loading and errors

Sin runtime nuevo. El First Value existente continúa con sus controles goal/context vacíos en entrada normal. No se añadió fetch, loading overlay, retry ni tratamiento 401/404/409/410 para D2. En consecuencia, no se arriesgó a reemplazar valores locales o a mostrar un composer falsamente vacío durante una carga D1.

## G. Provenance and write boundary

No se añadió provenance ni almacenamiento durable. No se hicieron llamadas a D1, P1, P3 o mutaciones canónicas. La frontera de runtime de esta ejecución fue cero cambios de producto; `AUTO_SUBMIT = NO` y `HYDRATION_CANONICAL_WRITES = 0` se preservan.

## H. KAN-63 preservation

No se modificó la página ni el comportamiento P1/P2/P3. No se cambiaron checkpoints, conservación de estado, aclaraciones, revisión exception-first, confirmación global, asignación ni alignment score.

## I. Tests and E2E evidence

No se ejecutaron tests ni E2E: no existe implementación runtime que validar y la condición previa del identity tuple no se satisface. Esto no es evidencia PASS. Quedan pendientes todos los tests del mapper, First Value hydration, regresiones D1/KAN-63, matriz front/backend, lint/build y directed E2E solicitados.

`LOCAL_E2E`, `REAL_PROVIDER_E2E` y `DEPLOYED_NETWORK` quedan `NOT RUN`; no se afirma cobertura de autenticación/proveedor/red.

## J. Remaining limitation and readiness

**Bloqueo:** autorizar y materializar la transferencia segura del tuple exacto de identidad D1 desde la confirmación ya existente hasta `/portfolio/setup`, o señalar el artefacto vigente que ya lo persiste. Cualquier solución debe demostrar que el tuple sigue refiriéndose al Brief confirmado tras `continue-portfolio`, sin latest lookup, revisión sintética ni cambio de semántica D1/Portfolio Entry.

```text
D2_RUNTIME_READY_FOR_INTEGRATION = NO
STATUS = BLOCKED
KAN74_E2E_READY_AFTER_MERGE = NO
SAFE_TO_COMMIT = NO
```
