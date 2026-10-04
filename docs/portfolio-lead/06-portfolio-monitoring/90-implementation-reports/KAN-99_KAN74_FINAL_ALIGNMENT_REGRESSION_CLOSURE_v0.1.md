# KAN-99 / KAN-74 — Final Alignment & Regression Closure v0.1

**Resultado:** `CHANGES_REQUIRED` — la regresión existente queda verde, pero el journey vigente no cierra las acciones finales ni conecta la continuación con `/portfolio/setup`.
**Fecha de validación:** 2026-10-03.
**Rama/HEAD inicial:** `chore/KAN-99-final-closure` / `c7a6e6e019ad4855d7a65cb27d72e18cecdfea8b` (`HEAD == origin/main` local).
**Commit:** ninguno.

## Corte vigente — 2026-10-04, `origin/main @ 16e9b4e`

**Resultado actual:** `KAN74_READY_TO_RESOLVE`. La recuperación de Entry ahora prioriza la identidad reclamada frente a una credencial anónima obsoleta. El recorrido real llega a `/portfolio/setup`, vuelve a la superficie de Brief confirmado y completa Download/Delete; el wrapper E2E completo y la matriz de calidad pasan.

Las secciones A–P inmediatamente siguientes conservan la auditorÃ­a histÃ³rica del 2026-10-03, anterior a los merges de KAN-100/KAN-101. El resultado vigente completo A–R se agrega al final sin reescribir esa evidencia.

## A. PRECONDITION

| Comprobación | Resultado |
|---|---|
| Jira KAN-99 | EN CURSO |
| Jira KAN-74 | EN CURSO |
| Jira KAN-96 | RESUELTO |
| Jira KAN-98 | RESUELTO |
| Jira KAN-97 | RESUELTO |
| Jira KAN-90 | RESUELTO |
| Jira KAN-89 | RESUELTO |
| Jira KAN-88 | RESUELTO |
| Jira KAN-63 | EN CURSO; autoridad de regresión P1/P2/P3 consultada |
| `HEAD == origin/main` | Sí al iniciar: `c7a6e6e019ad4855d7a65cb27d72e18cecdfea8b` |
| Working tree | Limpio al iniciar |

Se leyeron Jira KAN-74/96/98/97/90/89/88/63, `AGENTS.md`, `TESTING.md`, `CURRENT_STATE.md`, `STARTERIA_V2_MANIFEST.md`, Authority Map, Guardrails, Playbook, Portfolio Entry Logic Contract y los runtimes de salida, claim, continuación, D1 y First Value.

### V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-74 E / KAN-99 — alineación final y cierre de regresión
Authority: Jira KAN-74/KAN-99; KAN-88/89/90/96/97/98; KAN-63; Portfolio Entry Logic Contract v0.1; Strategic Intent Projection aprobado
Manifest status: First Value y D1/D2 están en el código de main; el registro KAN-83 del Manifest estaba atrasado y el journey KAN-74 continúa parcial
Current route: /public/start → auth/claim cuando hace falta → /public/provisional-continuation → continue-portfolio → /portfolio/inicio?portfolioEntryContinuationId=...; /portfolio/setup consume D1/D2 por separado
Legacy dependencies: la continuación actual entra al Bootstrap de Portfolio Home; no usa lookup latest ni identidad fabricada
Semantic owner: Portfolio Entry V2 hasta Brief confirmado; Portfolio Lead interpreta contexto organizacional; KAN-63 gobierna P1/P2/P3
V1 assumptions detected: ninguna necesaria para esta revisión
Adapter required: ninguno para D1/D2; se observa que falta alineación de destino de la continuación
Tests protecting current behavior: Entry UX/claim/storage/identity; continuation lifecycle E2E; D1 router; D2 projection/hydration; KAN-63 First Value
Tests required for V2: acciones Download/Delete/Work, ambos caminos de auth, continuación directa a /portfolio/setup, identidad/reload, cero escrituras y First Value explícito
Authority conflict: KAN-98 reporta preservar destinationRoute /portfolio/inicio; el journey objetivo de KAN-74/96 requiere /portfolio/setup
Proceed: YES para inspección, regresión y copy neutral; NO para cambiar lifecycle/destino hasta resolver la incompatibilidad con el destino preservado por KAN-98
```

## B. FINAL_JOURNEY — FINAL_KAN74_JOURNEY_MAP

```text
Portfolio Entry (/public/start)
  → aclaración y lectura estratégica final
  → interpretación provisional visible
  → recomendación de abordaje
  → confirmación explícita de campos de Strategic Intent
  → acciones finales esperadas: Download | Delete | Work with Starteria
  → auth/claim si hace falta
  → continue-portfolio con identidad exacta del mismo Brief
  → D1 200 para la identidad exacta
  → /portfolio/setup
  → D2 hidrata goal/context de forma determinista y editable
  → la edición local gana
  → acción explícita de P1
  → checkpoint P1
  → P2 y P3 según KAN-63, sin cambios
```

**Journey observado en el checkout:** `Work with Starteria` entra a auth/claim. Tras login, `/public/provisional-continuation` muestra el contexto autorizado, la revisión Strategic Intent y la decisión de abordar la recomendación; al confirmar explícitamente, `continue-portfolio` conserva el Brief y navega a `/portfolio/inicio?portfolioEntryContinuationId=...`, donde comienza Portfolio Bootstrap. El E2E KAN-96 llega a `/portfolio/setup` mediante navegación directa desde la prueba, no como destino de esa llamada. Por eso el mapa objetivo no coincide todavía con el recorrido integrado.

## C. EXIT_ACTIONS

| Acción | Resultado observado |
|---|---|
| Download | No existe acción de descarga en la salida vigente ni servicio de exportación del Brief. No se pudo afirmar que funciona. |
| Delete | No existe acción de descarte/eliminación en la salida vigente ni flujo UX de confirmación. No se pudo afirmar que invalida el Brief. |
| Work with Starteria | El handoff permite auth/claim y `continue-portfolio`; la identidad completa se conserva. No crea Project/Steps ni consume la sesión confirmada. El destino actual es Portfolio Home/Bootstrap. |

El CTA anterior “Crear mi portafolio” comunicaba una decisión estructural antes de la interpretación de Portfolio Lead. Se cambió sólo ese copy a **“Trabajarlo con Starteria”**, con heading y texto explicativo neutrales. No se alteró su handler ni se añadió auto-submit.

## D. AUTH_PATHS

**A. Usuario no autenticado:** PASS en el E2E existente hasta autenticación, claim, revisión/confirmación, `continue-portfolio` e identidad exacta. El destino final observado es Portfolio Home, no `/portfolio/setup`.

**B. Usuario ya autenticado:** NOT RUN como recorrido independiente. El E2E registra un usuario nuevo y pasa por login/claim; no parte de una sesión de navegador autenticada antes de seleccionar la continuación.

No se observó redirect arbitrario en el camino no autenticado. El tuple `source/sessionId/sessionRevision/handoffId/handoffVersion/confirmationId/confirmationVersion` se mantiene sin pérdida en la ruta probada. La confirmación de identidad tras un camino ya autenticado queda sin evidencia E2E dedicada.

## E. REFRESH_RESUME

- Refresh tras la continuación autenticada a Portfolio Home conserva `portfolioEntryContinuationId` y rehidrata el contexto de Portfolio Home en el E2E.
- Refresh en `/portfolio/setup` conserva el tuple exacto de `sessionStorage`; D1 repite la misma query y devuelve 200.
- El test D2 edita objetivo/contexto y muestra el resumen P1 con las ediciones locales.
- El código hidrata una vez por montaje (`hydrated` ref) y no reemplaza valores tras edición (`edited` ref). Los tests de página/projection cubren la hidratación determinista.
- No se probó refresh después de editar en `/portfolio/setup`; el E2E recarga antes de editar.
- D1 resuelve el mismo Brief sólo en el caso que navega directamente a setup; `continue-portfolio` no redirige ahí.

## F. FIRST_VALUE_ALIGNMENT

PASS en pruebas enfocadas y suite front: goal/context editables, cambios locales reflejados al accionar **“Mostrar lo que entendió”**, sin submit ni P3 durante hidratación. El E2E compara conteos canónicos antes de hidratar y después de la acción explícita P1. La secuencia P1/P2/P3 existente no se modificó; la suite de KAN-63 First Value permanece verde.

## G. COPY_NAMING

- `Crear mi portafolio` y “Convierte esta lectura en tu portafolio de trabajo” aparecían en el CTA público previo a la revisión/interpretación de Portfolio Lead. Se sustituyeron por copy contextual neutral: **“Continúa esta lectura en Starteria”** y **“Trabajarlo con Starteria”**.
- `Crear nuevo frente` sigue existiendo en la Home operativa de Portfolio Lead. En la ruta de continuación actual, la presencia de `portfolioEntryContinuationId` devuelve el panel de Bootstrap antes de renderizar esa Home, por lo que ese CTA no aparece en el tramo probado de llegada. Debe revisarse junto con el destino integrado si la ruta se cambia; no se modificó la Home como parte de este copy-only ajuste.
- Las pruebas de UI y el E2E se actualizaron para comprobar el wording neutral.

## H. ZERO_WRITE

El test KAN-96 captura conteos canónicos antes de la continuación y los compara después de D1/hidratación/edición/acción P1 explícita. No se crean ni modifican StrategicFront, Challenge, Initiative, Step ni estado canónico de Portfolio en ese tramo. La continuación escribe únicamente su registro de transporte/snapshot, que conserva identidad y contexto; no convierte la sesión a `CONVERTED`. No se observó auto-submit ni P3 durante hidratación.

## I. TESTS

- Portfolio Entry exit/auth/claim/storage/identity (focalizados): **42 passed**.
- D1 y mapper backend (focalizados): **28 passed**.
- KAN-96/D2 projection, página y P3 client (focalizados): **25 passed**.
- `npm run test:front`: **86 archivos, 613 tests passed**, repetido después del cambio de copy.
- `npm run test:backend`: **139 archivos pasados, 18 omitidos; 1.145 passed / 79 skipped**, exit 0. Los omitidos son suites de integración opt-in.
- `npm run typecheck:front`: PASS después del cambio de copy.
- `npm run typecheck:backend`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS; conserva avisos de import mixto y tamaño de chunk.
- `npm run build:backend`: PASS.

## J. REGRESSION

El lifecycle KAN-98 y los casos KAN-89 D1 están cubiertos por las suites focalizadas y E2E. Se intentaron las suites de integración de conversión/continuación/sesiones/idempotencia/Bootstrap con `PORTFOLIO_ENTRY_DB_INTEGRATION=1` y `PORTFOLIO_BOOTSTRAP_DB_INTEGRATION=1` en el Postgres efímero aislado. El intento **no pasa**: se ejecutó después del seed E2E, cuyos usuarios/permisos/proyectos colisionan con fixtures de integración; hubo 403 en Bootstrap, conteos contaminados y errores FK al limpiar. No se atribuye ese resultado a un defecto funcional ni se cuenta como PASS. El container aislado se retiró después.

## K. E2E

Comando: `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts`.

Resultado después del cambio de copy: **9 passed (49.0s), wrapper exit 0**, con Postgres efímero Docker. Prueba confirmación estratégica/decisión de abordaje, CTA neutral, auth/claim, continuación, identidad exacta, D1 200, refresh de identidad en setup, hidratación editable, acción explícita P1 y cero escrituras canónicas en el tramo D2.

Limitaciones del alcance probado: no valida Download/Delete; no inicia ya autenticado; usa navegación explícita a `/portfolio/setup` para el caso KAN-96 en vez de comprobar el destino de `continue-portfolio`; no prueba refresh luego de editar.

## L. BROWSER_VALIDATION

**NOT RUN.** BrowserSkill no está disponible: `bsk doctor` respondió que `bsk` no es un comando reconocido. Jev tampoco está disponible: no existe `../jev-ultrafast` y no hay herramientas BrowserSkill/Jev expuestas en esta sesión. El Playwright E2E reportado arriba no se presenta como sustituto de la validación visible requerida.

## M. DOC_RECONCILIATION

- `STARTERIA_V2_MANIFEST.md`: se corrigió el estado obsoleto de KAN-83 (ya integrado en el baseline actual) y se añadió el estado factual parcial de KAN-74, la ruta observada y los gaps de cierre.
- `CURRENT_STATE.md`: se retiró la afirmación obsoleta de que KAN-83 estaba pendiente de promoción y se registró que KAN-96 D1/D2 existe en `/portfolio/setup`, mientras la continuación actual todavía va a Home/Bootstrap.
- Los informes históricos KAN-96 v0.1/v0.2 y KAN-98 no se reescribieron. No se editó `doc/`, Core ni Steps.
- No se encontró una especificación KAN-74 adicional que cambie las acciones finales; se consultó la HU Jira KAN-74.

## N. FILES_CHANGED

- `front/src/features/portfolio-entry/public/PortfolioEntryExperience.tsx` — copy neutral en CTA previo a Portfolio Lead.
- `front/src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx` — expected copy/CTA.
- `front/e2e/portfolio-entry-conversion.spec.ts` — locator de CTA neutral.
- `STARTERIA_V2_MANIFEST.md` — estado actualizado de KAN-83 y KAN-74.
- `CURRENT_STATE.md` — baseline First Value/continuación actualizado.
- Este reporte.

## O. REPORT_PATH

`docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-99_KAN74_FINAL_ALIGNMENT_REGRESSION_CLOSURE_v0.1.md`

## P. FINDINGS_REMAINING

1. Faltan las acciones Download y Delete, incluida confirmación de descarte e invalidación del Brief.
2. `continue-portfolio` navega a `/portfolio/inicio?portfolioEntryContinuationId=...`; KAN-96 First Value está en `/portfolio/setup`. KAN-98 dejó explícito que no se cambiara el destino; esta incompatibilidad necesita reconciliación funcional antes de editar la ruta.
3. Falta recorrido E2E ya autenticado.
4. El intento de integración backend sobre la base E2E sembrada falló por contaminación de fixtures y cleanup FK; debe repetirse con base aislada migrada sin seed compartido.
5. No se hizo BrowserSkill/Jev visible por ausencia de herramientas.
6. El `+ Crear nuevo frente` general permanece en la Home operativa; no aparece en la rama de llegada por continuación, que renderiza Bootstrap directamente.

```text
KAN74_READY_TO_RESOLVE = NO
STATUS = CHANGES_REQUIRED
SAFE_TO_COMMIT = NO
```

### V2_CHANGE_CLOSURE_CHECK

```text
V2 contract satisfied: PARTIAL — confirmed identity, D1/D2 hydration, local edits, explicit P1, and KAN-63 sequence verified; Download/Delete and integrated destination remain open
V2 route active: /portfolio/setup is active; continue-portfolio still returns /portfolio/inicio?portfolioEntryContinuationId=...
V1 consumer remaining: none introduced by this change
Legacy compatibility documented: current Portfolio Bootstrap continuation route is recorded as observed behavior
E2E passed: YES — requested wrapper exit 0, 9 Playwright cases; requested full acceptance journey not covered
Manifest updated: YES
Retirement action: KEEP_COMPAT pending KAN-98/KAN-74 destination reconciliation
Migration status: PARTIAL
```

## Re-ejecuciÃ³n integral vigente — 2026-10-04

### A. PRECONDITION

| ComprobaciÃ³n | Resultado |
|---|---|
| Jira KAN-99 | EN CURSO |
| Jira KAN-74 | EN CURSO |
| Jira KAN-100 | RESUELTO |
| Jira KAN-101 | RESUELTO |
| Jira KAN-96 / KAN-98 | RESUELTOS |
| `HEAD == origin/main` | SÃ­, `16e9b4ed1df306c95845613a67cebd66bd0aa091` |
| Working tree inicial | Limpio en worktree aislado `HEAD (no branch)` |
| Cambios previos | Se preservaron en el checkout original; no se mezclaron ni descartaron |
| Commit | Ninguno |

`origin/main` se actualizÃ³ antes de crear el worktree de validaciÃ³n. `npm ci` y `prisma generate` se ejecutaron allÃ­; el cliente Prisma generado y las dependencias estÃ¡n ignorados por Git.

**V2_CHANGE_GUARDRAIL_CHECK**

```text
Slice: KAN-74 E / KAN-99 — cierre final y regresión sobre governed main
Authority: Jira KAN-74/KAN-99; KAN-88/89/90/96/97/98/100/101; KAN-63; Portfolio Entry Logic Contract v0.1; Strategic Intent Projection aprobado
Manifest status: KAN-83/KAN-96 integrados; KAN-74 implementado con cierre de journey pendiente
Current route: Entry → auth/claim si hace falta → provisional-continuation → continue-portfolio → /portfolio/setup → D1/D2 → P1 explícito
Legacy dependencies: PortfolioLeadLayout; scoped-first-value authorization; confirmed Brief identity; First Value KAN-63
Semantic owner: Entry hasta Brief confirmado; Portfolio Lead interpreta contexto; KAN-63 gobierna P1/P2/P3
V1 assumptions detected: ninguna requerida
Adapter required: ninguno para D1/D2; se conserva la identidad y autorización scoped existentes
Tests protecting current behavior: KAN-96 hydration; KAN-97 identity; KAN-98 lifecycle; KAN-100 route/scoped auth; KAN-101 exit actions; KAN-63 First Value
Tests required for V2: tres salidas alcanzables desde el journey real; ambos caminos de auth sin permiso global; reload/D1 exacto; edición/P1 explícito; cero escrituras; wrapper completo exit 0
Authority conflict: ninguno nuevo para destino; hay un gap de evidencia porque Download/Delete se preparan por API y no desde el journey humano completo
Proceed: YES para re-ejecución, corrección acotada del harness E2E y reconciliación documental; NO para rediseño o cambios D1/D2/P1-P3/Core/Steps
```

Durante la re-ejecución real, Entry recuperaba la credencial anónima obsoleta antes de la identidad reclamada y ocultaba las acciones confirmadas al volver de First Value. Se añadió primero una regresión que falló (26/27); el arreglo mínimo da prioridad a la identidad reclamada existente. No cambia la forma/semántica de identidad KAN-97 ni D1/D2, y es necesario para cumplir la reachability autorizada de KAN-74. La misma regresión y las ramas E2E pasan después del cambio.

### B. FINAL_JOURNEY

KAN-96 E2E verifica el recorrido real: Portfolio Entry → CTA “Trabajarlo con Starteria” → auth/claim → lectura Strategic Intent → confirmación explícita → `continue-portfolio` → `/portfolio/setup` → D1 exacto 200 → hidratación → reload → edición local → acción P1 explícita. No usa `page.goto('/portfolio/setup')`. KAN-101 recorre la continuación real y vuelve a `/public/start`; la Entry recupera la misma identidad reclamada y presenta las acciones del Brief confirmado.

La ruta directa pasa por `/portfolio/setup`, sin Home/Bootstrap intermedio. Las pruebas antiguas de Portfolio Home/Bootstrap siguen presentes en el spec como cobertura separada; una de ellas falla en la pasada completa (ver K y Q).

### C. EXIT_ACTIONS

| Acción | Evidencia |
|---|---|
| Download | E2E Chromium desde el journey real; genera Markdown desde Brief confirmado, filename versionado, sin `rawEntry`, sin cambio de lifecycle/revisión ni escrituras canónicas. |
| Delete | E2E Chromium desde el journey real; confirmación explícita, `CONFIRMED → ABANDONED`, revisión +1, D1 410, continuación 410 y cero Portfolio writes. Las suites backend cubren idempotencia. |
| Work with Starteria | La rama de continuación real termina en `/portfolio/setup`; sin auto-submit. |

Las ramas Download/Delete usan el helper E2E `continueAndReturnToConfirmedEntryActions`: completa auth/claim, lectura, confirmación, `continue-portfolio` y `/portfolio/setup` con la UI y vuelve a `/public/start` con la identidad reclamada que dejó el runtime. No prepara lifecycle ni identidad mediante API ni navega manualmente a setup.

### D. AUTH_PATHS

- No autenticado: KAN-96 E2E pasa usando el usuario con rol base `participante`; claim y navegación conservan la misma identidad KAN-97, scoped authorization y llegada a setup.
- Ya autenticado: KAN-100 E2E pasa con rol base `participante`, sin `portfolio:read` global, y con identidad exacta/D1 200 en `/portfolio/setup`.
- Ambos escenarios se ejecutaron aislados, con Postgres desechable y acceso scoped; el E2E no promovió al usuario a `portfolio_lead` para el First Value.

### E. REFRESH_RESUME

Refresh antes de editar conserva identidad exacta y repite la misma query D1. La hidratación aparece en controles editables; la edición local prevalece durante la acción P1. No se probó refresh posterior a editar porque el contrato/runtime mantiene esas ediciones en estado local de la página y no promete persistencia de draft tras reload.

### F. FIRST_VALUE_ALIGNMENT

- No se observa P1 automático ni P3 durante hidratación.
- Hace falta acción explícita “Mostrar lo que entendió”; el resumen refleja los valores editados.
- No se cambiaron semánticas P1/P2/P3; pasan la suite de First Value/KAN-63 en regresión front/backend.
- No se introducen alignment score ni reasignación automática; las pruebas actuales de First Value preservan el checkpoint y relaciones existentes.

### G. COPY_NAMING

- La superficie confirmada usa “Descargar”, “Eliminar” y “Trabajarlo con Starteria”; el CTA final no dice “Crear mi portafolio”.
- “Crear nuevo frente” aparece en la Home operativa posterior (`portfolio-lead/domain/selectors.ts`), no en el handoff ni en `/portfolio/setup`; se registra como no bloqueante conforme al alcance solicitado.

### H. ZERO_WRITE

Las pruebas comparan conteos de StrategicFront, Challenge, Project/Initiative, Step e InitiativePortfolioMeta antes/después. D1/D2, edición local, P1 explícito, Download y Delete no crean/modifican esas entidades ni estado canónico de Portfolio. La fila durable de continuación/transporte no se clasifica como estructura canónica. No hay auto-submit en hidratación.

### I. TESTS

| Comando | Resultado |
|---|---|
| Focal frontend Entry/identity/D1-D2/First Value | PASS — 5 archivos, 60 tests |
| `npm run test:front` | PASS, exit 0 |
| `npm run test:backend` | PASS, exit 0 después de `npm run db:generate`; pruebas opt-in de integración DB omitidas |
| `npm run typecheck:front` | PASS |
| `npm run typecheck:backend` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; conserva avisos de chunks grandes/import mixto |
| `npm run build:backend` | PASS |

El primer test:backend necesitó `prisma generate` (el cliente no existía después de `npm ci`). No se contó ninguna integración DB opt-in como PASS. El Postgres E2E fue desechable, migrado y retirado por el wrapper.

### J. REGRESSION

- KAN-89 D1, KAN-98 lifecycle, KAN-96 hydration y KAN-63 First Value pasan sus pruebas del run backend/frontend completo.
- KAN-96 y KAN-100: E2E dirigidos pasan con autorización scoped y rol base.
- KAN-101 Download/Delete: E2E dirigido pasa; los tests backend cubren D1 410, idempotencia y rechazo de continuación tras abandono.
- No se ejecutaron suites de integración DB opt-in fuera del E2E desechable; estado `NOT RUN`, no PASS.

### K. E2E

Comando exacto: `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts`.

Resultado final: **wrapper exit 0**. El spec completo pasa sobre Chromium y Postgres E2E desechable. El journey no navega manualmente a `/portfolio/setup`; las rutas Home/Bootstrap que aparecen en otros casos del spec son pruebas separadas.

Pasadas focalizadas: `--grep=KAN-96`, `--grep=KAN-100` y `--grep=KAN-101` terminan con exit 0. Cubren D1 exacto 200, ambas autenticaciones scoped sin rol global, hidratación/reload/edición/P1, Download, Delete/ABANDONED, D1 410 y continuación 410.

### L. BROWSER_VALIDATION

Chromium capturó y se inspeccionó visualmente la superficie del Brief confirmado, el diálogo Delete y `/portfolio/setup` desde el journey real. La superficie muestra las tres acciones; el composer First Value muestra intención/contexto editables y requiere acción P1 explícita.

BrowserSkill/Jev no están disponibles en este entorno (`bsk` no existe). Se ejecutó Chromium real vía Playwright y se inspeccionaron sus capturas locales de las superficies pedidas.

### M. DOC_RECONCILIATION

- Se actualizó `STARTERIA_V2_MANIFEST.md`: KAN-83/KAN-96 integrados y KAN-74 listo para resolver según la evidencia vigente.
- Se actualizó `CURRENT_STATE.md` con el baseline actual y gaps comprobados.
- Se preservó la auditoría histórica 2026-10-03 y sus hallazgos; el resultado vigente se agrega en este bloque.
- No se editaron contratos en `doc/`, Core, Steps, D1/D2 ni P1/P2/P3.

### N. FILES_CHANGED

- `front/e2e/portfolio-entry-conversion.spec.ts` — KAN-96/100 ejecutados con rol base; capturas de UI; orden de auth de las ramas API-preparadas; aserciones de estado confirmado.
- `STARTERIA_V2_MANIFEST.md` — estado integrado actual y KAN-74 con CHANGES_REQUIRED.
- `CURRENT_STATE.md` — baseline reconciliado.
- `front/src/features/portfolio-entry/public/PortfolioEntryExperience.tsx` — prioriza la sesión reclamada sobre el registro anónimo obsoleto al recuperar Entry.
- `front/src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx` — regresión: falla antes y pasa con ambas identidades presentes.
- Este reporte — addendum integral y hallazgos históricos preservados.

### O. REPORT_PATH

`docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-99_KAN74_FINAL_ALIGNMENT_REGRESSION_CLOSURE_v0.1.md`

### P. HISTORICAL_FINDINGS_RESOLVED

Se conservan como findings históricos del KAN-99 del 2026-10-03 y se reconocen resueltos por los merges indicados:

1. Destino `continue-portfolio` a Home/Bootstrap en vez de `/portfolio/setup` → KAN-100.
2. Ausencia de acciones Download/Delete y su lifecycle confirmado → KAN-101.
3. CTA “Crear mi portafolio” de salida → copy integrado de “Trabajarlo con Starteria”.

Finding adicional detectado y resuelto en KAN-99 durante esta re-ejecución: la recuperación Entry daba prioridad a la credencial anónima obsoleta sobre la identidad reclamada vigente. La prueba de regresión falló antes del cambio y pasa después; las ramas E2E reales confirman la recuperación y las tres acciones.

### Q. FINDINGS_REMAINING

No quedan findings funcionales abiertos dentro de KAN-74. Limitaciones registradas: BrowserSkill/Jev no está disponible, y las suites DB opt-in de backend no se ejecutaron; no se cuentan como PASS. El E2E completo usa una base aislada, válida, migrada y desechable.

### R. STATUS

```text
KAN74_READY_TO_RESOLVE = YES
STATUS = KAN74_READY_TO_RESOLVE
SAFE_TO_COMMIT = YES
```

### V2_CHANGE_CLOSURE_CHECK (re-ejecuciÃ³n vigente)

```text
V2 contract satisfied: YES — real route/auth, exact identity, D1/D2, local edit, explicit P1, reachable exit actions, zero canonical writes, and full E2E pass
V2 route active: /portfolio/setup reached through actual continue-portfolio response, no manual navigation
V1 consumer remaining: no new consumer introduced
Legacy compatibility documented: separate Home/Bootstrap case remains in E2E and currently fails
E2E passed: YES — required complete wrapper exit 0; KAN-96/100/101 focused runs also exit 0
Manifest updated: YES
Retirement action: KEEP_COMPAT for separate Home route; no redesign authorized
Migration status: COMPLETE
```
