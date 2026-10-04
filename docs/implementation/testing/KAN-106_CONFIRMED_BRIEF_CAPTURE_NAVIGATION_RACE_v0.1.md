# KAN-106 — Confirmed-Brief capture navigation race v0.1

## Resultado

`NAVIGATION_RACE_STABILIZED` para el alcance de validación KAN-106. KAN-96 y KAN-100 pasaron focused x5 y combined x5; el spec completo pasó una vez (13/13). Los checks front solicitados también pasaron. No se observó `Execution context was destroyed` ni `Network.getResponseBody`.

No se hizo commit.

## A. PRECONDITION

| Comprobación | Resultado |
|---|---|
| Jira KAN-106 | `En curso` |
| `HEAD == origin/main` | Sí, `d361095f4b628f99a270ead138f6f46e6d14a38a` |
| Working tree inicial | Sólo los dos archivos de KAN-106 indicados en el pedido |
| Informe KAN-103 | Leído: `docs/implementation/testing/KAN-103_PORTFOLIO_ENTRY_E2E_STABILITY_v0.1.md` |
| KAN-104 | Jira y comentarios leídos: `REASON_TO_ASK_READY`; CI #153 bloqueado por helper compartido, sin evidencia de defecto runtime de KAN-104 |
| Spec actual | Leído: `front/e2e/portfolio-entry-conversion.spec.ts` |
| Evidencia CI #153 | Comentario de KAN-104: `page.evaluate: Execution context was destroyed, most likely because of a navigation`, entre `waitForFunction()` y `page.evaluate()` |

### V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-106, harness E2E de Portfolio Entry
Authority: Jira KAN-106 y límites explícitos del pedido
Manifest status: Portfolio Entry ACTIVE_V2_BASELINE; runtime/producto no cambia
Current flow: XHR loadend → array en window → waitForFunction → page.evaluate shift()
Target: XHR loadend → copiar status/url/JSON → binding expuesto → Promise Node
Semantic owner: comportamiento probado V2; cambio de observabilidad de test únicamente
Legacy dependencies: harness Playwright existente; no se introduce semántica legacy
Conflicts / authority gaps: ninguno para esta captura
Tests protecting behavior: asserts existentes de KAN-96/KAN-100 y escrituras canónicas cero
Proceed: YES
```

## B. ROOT_CAUSE

KAN-103 resolvió el fallo CDP de `Network.getResponseBody: No resource with given identifier found`: el cuerpo se copia sincrónicamente desde `XMLHttpRequest.responseText` al evento `loadend`.

KAN-106 corrige una carrera posterior y distinta. Aunque el cuerpo ya estaba copiado, quedaba en memoria del contexto de página. `waitForFunction()` podía completarse y, antes de que `page.evaluate()` ejecutara `shift()`, una navegación reemplazaba ese contexto. CI #153 observó esa destrucción del contexto; no indicaba que D1 devolviera un cuerpo incorrecto.

## C. OLD_CAPTURE_FLOW

```text
XHR loadend
→ window.__starteriaConfirmedBriefCaptures.push({status, url, body})
→ waitForFunction()
→ page.evaluate(() => captures.shift())
```

La ventana entre las dos últimas operaciones permitía que la navegación destruyera el contexto propietario del array.

## D. NEW_CAPTURE_FLOW

```text
XHR loadend
→ filtrar GET /api/v1/public/portfolio-entry/sessions/:sessionId/confirmed-brief
→ copiar status, URL y JSON de responseText
→ binding Playwright expuesto para este invocation
→ Promise Node se resuelve con la copia
```

Se elimina la lectura posterior mediante `waitForFunction()` y `page.evaluate()`. El binding tiene nombre único por invocation. El interceptor comparte la instalación entre documentos y actualiza el sink activo; cada helper espera únicamente su propia Promise. No se almacena el body en `window`.

## E. NAVIGATION_SAFETY

La Promise se resuelve en Node al recibir el binding, antes de cualquier lectura posterior del contexto de página. El binding expuesto permanece disponible con navegación, refresh y reemplazo de execution context. La identidad de sesión sólo se lee desde la página para formar diagnóstico si el body no es JSON válido o falta; no se usa para recuperar el body.

## F. ASSERTIONS_PRESERVED

El diff sólo reemplaza el helper de captura. Permanecen los asserts existentes de:

- D1 status 200, pathname exacto y query tuple exacta;
- `sessionId`, `revision`, `handoffId/version`, `confirmationId/version`;
- Brief `CONFIRMED` y campos aceptados;
- hydration, refresh con la misma identidad, edición local y explicit P1;
- cero escrituras canónicas prematuras y rutas prohibidas.

No se quitó ni debilitó ningún assert.

## G. SECURITY / DIAGNOSTICS

El XHR sólo invoca el sink para GET al pathname exacto de `/api/v1/public/portfolio-entry/sessions/:sessionId/confirmed-brief`. El payload del binding contiene status, URL y JSON parseado; no contiene headers, cookies, authorization ni tokens. Los errores reportan URL capturada, status, URL actual de página, identity tuple y causa de parseo genérica; no se incluyen secretos.

## H–K. REPETITION MATRIX

| Grupo | Resultado |
|---|---|
| KAN-96 focused x5 serial | 5/5 PASS |
| KAN-100 focused x5 serial | 5/5 PASS |
| KAN-96 + KAN-100 combined x5 serial | 10/10 PASS |
| Full `portfolio-entry-conversion.spec.ts` una vez | 13/13 PASS |

La matriz se ejecutó serialmente con un worker. La combinación usó el selector compatible con Windows documentado por KAN-103 (`--grep KAN- --grep-invert KAN-10[12]`), que seleccionó KAN-96 y KAN-100.

## L. FRONT_REGRESSION / CI-LIKE

| Comando | Resultado |
|---|---|
| `npm run test:front` | PASS |
| `npm run typecheck:front` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; conserva avisos de import mixto y tamaño de chunk |
| `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts` | PASS, exit 0 (misma ruta invocada por CI) |

`npm.cmd` se usó en Windows por la política de ejecución de PowerShell. E2E requirió acceso aprobado a Docker Desktop para crear y retirar el Postgres aislado.

## M. FILES_CHANGED

- `front/e2e/portfolio-entry-conversion.spec.ts`
- `docs/implementation/testing/KAN-106_CONFIRMED_BRIEF_CAPTURE_NAVIGATION_RACE_v0.1.md`

## N. BOUNDARIES

No se cambiaron runtime de producto, D1/D2, KAN-96/KAN-100, `reason_to_ask`, auth, Core ni Steps. No se modificaron asserts. No se hizo commit.

## O. FINDINGS_REMAINING

- KAN-96 y KAN-100 focused y combined repiten correctamente con la captura Node-side.
- El CI-like exacto terminó con 13/13 y exit 0.
- Los fallos residuales declarados por el pedido (KAN-101 confirmed-actions, redirect auth Portfolio-first y anchor/confirm P2002) no se diagnosticaron ni modificaron aquí; siguen asignados a KAN-108.
- No se observó `Execution context was destroyed` ni `Network.getResponseBody` en la validación.

```text
STATUS = NAVIGATION_RACE_STABILIZED
SAFE_TO_COMMIT = YES
COMMIT_CREATED = NO
```
