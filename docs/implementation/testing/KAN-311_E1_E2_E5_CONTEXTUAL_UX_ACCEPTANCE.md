# KAN-311 — aceptación E1→E2→E5 y creación contextual

Fecha de ejecución local: 2026-11-11  
Autoridad de producto: [GitHub Issue #311](https://github.com/DarkCodePE/plataforma-starteria/issues/311)  
Base verificada: `origin/main@18a52368d54db15afaadc8666c3d3e645882c80e`

## V2_CHANGE_GUARDRAIL_CHECK

```text
V2_CHANGE_GUARDRAIL_CHECK

Slice: Portfolio Lead Bootstrap E1→E2→E5 y creación de frente adicional
Authority: GitHub Issue #311 + instrucción directa del responsable; excepción documentada porque KAN-311 no existe en Jira
Manifest status: Portfolio Lead Bootstrap V2 activo; este cambio no altera su estado
Current route: /portfolio/inicio y /portfolio/frentes-estrategicos
Legacy dependencies: StrategicFrontFormDrawer se conserva sólo como alternativa manual explícita
Semantic owner: V2
V1 assumptions detected: ninguna
Adapter required: no
Tests protecting current behavior: RTL bootstrap/home/fronts, router/materialización y Playwright release-parity existentes
Tests required for V2: cafetería, pyme 3, corporate 25, sesión adicional, reentrada, procedencia y matriz visual
Authority conflict: ninguno; Core, Steps, MCP, memoria y cardinalidad quedan fuera de alcance
Proceed: YES
```

## Resultado funcional candidato

El candidato conserva el recorrido E1–E7 existente y corrige la unión visible entre E1, E2 y E5:

- E1 mantiene la captura progresiva, procedencia y confirmación humana; cuando E2 todavía no está disponible explica el bloqueo y la acción siguiente.
- E2 muestra el contexto efectivo confirmado en E1, con valor, disposición y procedencia, sin convertirlo en respuestas del objetivo ni repreguntarlo.
- El modo visible distingue `Copilot semántico` únicamente cuando el runtime semántico está realmente activo en E1. El resto se presenta como `Guía estructurada · sin IA de pago`.
- E5 muestra la procedencia de objetivo y trabajo considerado, conserva la propuesta como editable y no materializa nada antes de la confirmación humana.
- El horizonte estratégico del frente y el plazo propio del reto son opcionales e independientes. Una incompatibilidad se advierte sin corregirla ni copiar fechas automáticamente.
- `Crear nuevo frente` ofrece dos rutas: `Guiarme desde mi necesidad`, que abre una sesión adicional limpia e idempotente, y `Crear manualmente`, que reutiliza `StrategicFrontFormDrawer`.
- Una sesión adicional conserva frentes previos sólo como referencia y no mezcla respuestas, decisiones ni datos de la sesión anterior.

No se cambiaron Core, Steps, MCP, memoria, cardinalidad ni Prisma. No se activó IA live/de pago y no se crearon iniciativas, Projects o Steps automáticamente.

## Matriz de aceptación automatizada

| Escenario | Evidencia |
| --- | --- |
| Cafetería sin equipo ni iniciativas | E1 guiado, confirmación y CTA E2; E2 reutiliza E1; objetivo confirmado; E3 sin trabajo; E5 editable y confirmado; persistencia y reentrada |
| Pyme con 3 iniciativas | Análisis determinista, revisión humana, E5 con cobertura y procedencia de 3 fuentes; sin horizonte ni campos corporativos inventados |
| Corporate con 25 iniciativas | Igual que pyme con 25 elementos; propuesta no materializada antes de confirmar; reentrada en la misma sesión |
| Creación de frente adicional | Elección contextual/manual, sesión nueva, idempotencia de reintento y ausencia de mezcla con el frente existente |
| Procedencia | E1 marca declarado/unknown/not_applicable; E5 identifica Anchor, cantidad de trabajo y confirmación humana requerida |
| Horizontes | La propuesta revisada conserva fechas distintas; sólo el horizonte del frente se materializa en el campo canónico existente. El plazo de reto permanece en la propuesta hasta que un ADR autorice un campo canónico propio |

Pruebas principales:

- `front/e2e/kan311-e1-e2-e5-contextual.spec.ts`
- `front/src/app/pages/__tests__/PortfolioLeadStrategicFrontsPage.kan311.test.tsx`
- `front/src/features/portfolio-lead/bootstrap/components/__tests__/PortfolioBootstrapHome.test.tsx`
- `backend/modules/portfolio-bootstrap/__tests__/portfolio-organization.materialization.integration.test.ts`
- `backend/modules/portfolio-bootstrap/__tests__/portfolio-bootstrap.router.test.ts`

## Evidencia ejecutada

- Playwright full-stack sobre artefacto real con PostgreSQL descartable y flags efectivos por defecto: **3/3 PASS**.
- RTL focal de E1/E2/E5 y creación adicional/manual: **75/75 PASS**.
- Router backend focal: **30/30 PASS**.
- Suite frontend completa: **PASS**.
- Typecheck frontend + backend: **PASS**.
- Lint baseline y build de producción: **PASS**.
- `git diff --check`: **PASS**.

La suite backend amplia ejecutó **233 archivos PASS / 44 skipped** y no pudo ejecutar los 11 casos de materialización contra la base local porque esa base no tenía las migraciones vigentes. No se alteró ni migró esa base. El mismo módulo sí quedó validado en el runner E2E descartable, que creó PostgreSQL desde cero y aplicó las 80 migraciones antes del **3/3 PASS**.

El E2E adjunta el checklist Nielsen H1–H10 en `nielsen-h1-h10-kan311.json`. CI ejecuta el spec y publica el artefacto `kan-311-e1-e2-e5-contextual-ux-<run_id>` inmediatamente después, antes de que otros specs puedan sustituir `front/test-results`.

## Capturas comparables

El caso cafetería genera una matriz de nueve capturas `fullPage`:

| Etapa | 375 × 812 | 768 × 1024 | 1440 × 1000 |
| --- | --- | --- | --- |
| E1 | `kan311-e1-cafeteria-mobile-375.png` | `kan311-e1-cafeteria-tablet-768.png` | `kan311-e1-cafeteria-desktop-1440.png` |
| E2 | `kan311-e2-cafeteria-mobile-375.png` | `kan311-e2-cafeteria-tablet-768.png` | `kan311-e2-cafeteria-desktop-1440.png` |
| E5 | `kan311-e5-cafeteria-mobile-375.png` | `kan311-e5-cafeteria-tablet-768.png` | `kan311-e5-cafeteria-desktop-1440.png` |

La inspección local confirma legibilidad, adaptación responsive, procedencia visible y ausencia de overflow horizontal en esos viewports.

## Gate visual humano pendiente

`STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html` está citado en KAN-252 y en el issue #311, pero no está versionado en el repositorio ni en su historial, no figura como adjunto de Jira/Confluence y no apareció por nombre exacto o aproximado en Drive. Por ello:

- las capturas candidatas sí quedan generadas y publicadas para comparación;
- no se declara paridad visual con el HTML ni `UX PASS` definitivo;
- antes de CD, Producto/Diseño debe aportar o abrir el HTML y registrar la aceptación humana de la matriz E1/E2/E5;
- tras una autorización productiva separada, el flujo debe revalidarse en `starter-ia.com` sobre el SHA desplegado.

CI verde, por sí solo, no satisface este gate. Esta PR no despliega, no aplica migraciones y no autoriza CD.

## V2_CHANGE_CLOSURE_CHECK

```text
V2_CHANGE_CLOSURE_CHECK

V2 contract satisfied: YES funcional; aceptación visual humana pendiente
V2 route active: YES en el artefacto candidato
V1 consumer remaining: editor manual, como alternativa explícita y no como ruta contextual
Legacy compatibility documented: YES
E2E passed: YES, 3/3 sobre PostgreSQL descartable y artefacto candidato
Manifest updated: NO; no cambia el estado del slice ni introduce una migración V2
Retirement action: KEEP_COMPAT
Migration status: PARTIAL hasta aceptación visual humana antes de CD
```
