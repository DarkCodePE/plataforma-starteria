# TESTING.md

Qué correr, cuándo y cómo, en los tres frentes. Lo usa la skill `/verificar`
(`.claude/skills/verificar/SKILL.md`). Si un comando de acá deja de ser cierto, se corrige en el
mismo PR que lo cambió.

## 1. Qué corro ahora

| Momento | Qué | Por qué |
|---|---|---|
| mientras iterás | el test del archivo o dominio que tocás (§2–§4, "un solo test") | segundos, no minutos |
| antes de pedir review | la **matriz** de los frentes que tocó el diff (§5) | es la evidencia del PR |
| si el cambio toca un journey, una ruta o auth | E2E dirigido a los specs de ese journey (§6) | CI sólo corre el de Portfolio Entry |
| si el cambio toca prompts o agentes de IA | eval determinístico del harness (§4) | un test unitario no mide la decisión |
| antes del PR | lo mismo que CI **más** `typecheck` y `lint`, que CI no corre | llegan rojos al CI si no |

Tiempos de referencia en una máquina de desarrollo (2026-09-29): typecheck ~11 s por frente,
`test:front` 12 s (561 tests), `test:backend` 21 s (1079), `build` 6 s, `pytest -m unit` 4 s (446),
eval determinístico 1 s, E2E de Portfolio Entry ~65 s (8 tests). La matriz completa entra en
unos 2 minutos: no hay excusa para no correrla antes del review.

Todo comando que no se pudo correr (falta Docker, falta una clave, timeout) se reporta con el
motivo. Un nivel no corrido no es un nivel verde.

## 2. front — `front/src/`

Todos los comandos desde `front/`. Primera vez: `npm ci && npx prisma generate` (sin el cliente
Prisma generado, `typecheck:backend` y `test:backend` fallan con errores de tipos que no son tuyos).

| Nivel | Comando | Qué cubre |
|---|---|---|
| typecheck | `npm run typecheck:front` | `tsc -p tsconfig.front.json --noEmit` |
| lint | `npm run lint` | baseline propio (`scripts/lint-baseline.ts`), no ESLint: incluye la regla de la única salida a ai-service |
| unit / componente | `npm run test:front` | Vitest + jsdom + Testing Library + msw; `src/**/*.{test,spec}.tsx` |
| un solo test | `npx vitest run --config vitest.front.config.ts <ruta>` | |
| cobertura | `npm run test:coverage:front` | umbral 80 % líneas (CI) |
| build | `npm run build` | `vite build` |

## 3. back — `backend/`

También desde `front/` (es el workspace Node del backend).

| Nivel | Comando | Qué cubre |
|---|---|---|
| typecheck | `npm run typecheck:backend` | `tsc -p tsconfig.backend.json --noEmit` (strict apagado: el typecheck no reemplaza tests) |
| unit / API | `npm run test:backend` | Vitest node + supertest + nock + ioredis-mock; `../backend/**`, `../tests/**`, `../test/portfolio-entry-v02-isolated-validation/**` |
| un solo test | `npx vitest run --config vitest.backend.config.ts <ruta>` | |
| integración con base real | `PORTFOLIO_ENTRY_DB_INTEGRATION=1 PORTFOLIO_BOOTSTRAP_DB_INTEGRATION=1 npm run test:backend -- <ruta>` | archivos `*.integration.test.ts`; sin la variable se saltean. Necesitan Postgres (`docker compose up -d postgres` desde la raíz, :5433) |
| cobertura | `npm run test:coverage:backend` | umbral 80 % (CI) |
| build | `npm run build:backend` | `tsc` a `dist/backend/` |

Migraciones: `npx prisma migrate dev --name <slug>` en local; nunca `db:push` ni `db:reset` contra
una base que no sea tuya y descartable.

## 4. ai — `ai-service/`

Todos los comandos desde `ai-service/`. Primera vez: `uv sync --all-extras`.

| Nivel | Comando | Qué cubre |
|---|---|---|
| lint | `uv run ruff check .` | en CI es advisory (`--exit-zero`); en tu diff, sin hallazgos nuevos |
| unit | `uv run pytest -m unit` | LLM falseado (respx, fixtures); ningún test `unit` llama a un modelo real |
| un solo test | `uv run pytest tests/<archivo>.py::<test>` | |
| cobertura | `uv run pytest -m unit --cov` | umbral 75 % (CI) |
| integración | `uv run pytest -m integration` | requiere servicios; hoy casi no hay tests con esta marca |
| eval determinístico | `uv run python -m harness.eval.runner --mode deterministic --out harness/eval/out/scorecard.json` | A/B baseline vs harness sobre `harness/eval/dataset.py`, hermético, sin red |
| eval live | `HARNESS_EVAL_LIVE=1 uv run python -m harness.eval.runner --mode live --sample 5` | llama a OpenRouter de verdad: cuesta dinero, **sólo con el sí de la persona** |

- Las marcas son estrictas (`--strict-markers`): `unit`, `integration`, `contract`. Un test sin marca
  no corre en CI (`-m unit`).
- `contract` está declarada pero no hay tests con esa marca. Hasta que existan, un cambio de
  schema pydantic se protege con `tests/test_schemas.py` y los tests del bridge del lado Node.
- Para el eval: guardá el scorecard antes y después del cambio y poné la diferencia en la
  evidencia del PR.

## 5. Matriz por frente tocado

Lo que corre `/verificar` antes de pedir review, según qué carpetas toca `git diff --name-only
origin/main...HEAD`:

| Diff toca | Obligatorio |
|---|---|
| `front/src/**` | `typecheck:front` · `lint` · `test:front` · `build` |
| `backend/**`, `tests/**` | `typecheck:backend` · `lint` · `test:backend` · integración del dominio si toca persistencia |
| `front/prisma/**` | todo lo de backend · `npx prisma validate` · la migración aplica en limpio (`npm run db:e2e:migrate` o base local descartable) |
| `ai-service/**` | `ruff check` · `pytest -m unit --cov` · eval determinístico si toca `agents/`, `prompts/` o `harness/` |
| `backend/modules/ai/**` o `ai-service/schemas/**` | los dos frentes: es el contrato entre back y ai |
| rutas, auth, flujo de Portfolio Entry | E2E dirigido (§6) |
| cualquier cambio que el usuario ve o recorre | validación en navegador (§9) |
| sólo `doc/`, `docs/`, `*.md` | nada de código; revisar que los links y rutas citadas existan |

## 6. E2E — `front/e2e/`

Playwright (Chromium). `npm run test:e2e` (`scripts/run-e2e.ts`) levanta todo: Postgres efímero de
`docker-compose.e2e.yml` (:55433, proyecto `starteria-e2e`), crea la base `starteria_e2e`, corre
`migrate deploy` y `seed.e2e.ts`, backend en :4100 y Vite en :5176.

```bash
cd front
npx playwright install --with-deps chromium        # primera vez
npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts   # un spec (es el que corre CI)
npm run test:e2e:debug -- e2e/<spec>                 # con inspector
```

La verificación full-stack de Portfolio Entry en CI usa estos modos explícitos:

```bash
npm run test:e2e -- --portfolio-entry-full-stack-test e2e/portfolio-entry-conversion.spec.ts --grep CURRENT_114D
npm run test:e2e -- --portfolio-entry-full-stack-test e2e/portfolio-entry-conversion.spec.ts --grep LEGACY_COMPAT
npm run test:e2e -- --portfolio-entry-full-stack-test e2e/portfolio-entry-live-understanding.integration.spec.ts
npm run test:e2e -- --portfolio-entry-postgres-confirmation-test
```

El modo full-stack levanta la app y API reales sobre PostgreSQL y sustituye sólo el adaptador de
síntesis KAN-114 por el determinístico aceptado de prueba. Exige `NODE_ENV=test` y
`PORTFOLIO_ENTRY_E2E_TEST=true`, deja vacías las claves de proveedor y eleva el límite incidental de
creación de sesiones a 500 sólo en ese router de prueba. El router de producción y los tests del
límite conservan el valor predeterminado de 20. El modo PostgreSQL ejecuta el archivo de integración
Prisma con `PORTFOLIO_ENTRY_DB_INTEGRATION=1` contra la base desechable `starteria_e2e`; no cuenta
como evidencia la sola migración y seed.

Variables útiles: `E2E_SKIP_DOCKER=1` (usar una base que ya levantaste, con `E2E_DATABASE_URL`),
`E2E_KEEP_DOCKER=1` (no bajar el contenedor al terminar), `E2E_BASE_URL`. Credenciales y flags
tienen defaults de prueba en `run-e2e.ts`; no pongas secretos reales.

Al terminar, el log muestra varios `prisma:error ... terminating connection due to administrator
command` (`E57P01`): es el contenedor de Postgres bajando mientras el backend todavía tiene
conexiones abiertas. Es ruido del teardown, no un fallo; lo que cuenta es la línea `N passed`.

### Deuda heredada: 20 fallos conocidos

La suite completa da `21 passed / 20 failed / 4 did not run`, y **los 20 fallos se reproducen en el
repo de origen** (`STARTERIA_PLATFORM_REPO_MIGRATION_AUDIT.md`, "FULL BROWSER E2E FAILURE
ANALYSIS", con la matriz test por test). Están en: `adaptive-core-prd03`, `dual-role-authz`,
`initial-review-prd-audit`, `initiative-states`, `pdf-autofill`, `portfolio-challenge-states`,
`portfolio-copilot-create-front`, `portfolio-lead-role` y `portfolio-steps-integration`.

- Un fallo de esa lista **no bloquea** tu PR, pero se nombra en la evidencia ("fallo conocido,
  ver auditoría"), no se omite.
- Un fallo **fuera** de esa lista, o un test de esa lista que falla de otra forma, es tuyo hasta
  demostrar lo contrario.
- Arreglar uno de esos fallos es una subtarea propia, no algo que se hace de paso.

## 7. Clasificar un test antes de confiar en él

Guardrails §13: antes de apoyarte en una suite existente, clasificala:

| Clase | Significa |
|---|---|
| `V2_CONFORMANCE` | protege comportamiento V2 con autoridad vigente |
| `V1_REGRESSION` | protege comportamiento V1; no puede bloquear una migración V2 |
| `COMPATIBILITY` | protege un adapter o compat explícito |
| `HYPOTHESIS` | experimental, sin autoridad |
| `UNKNOWN` | no se sabe qué protege: se audita antes de tocarlo |

Si un test falla: identificá qué autoridad protege, decidí si debe quedar, y adaptalo sólo si V2
cambia legítimamente el comportamiento. **Nunca se cambia un expected sólo para que pase**, ni se
agrega `.skip` para despejar el camino.

## 8. Reglas para escribir tests

- Test primero: el test que demuestra un `CA-n` se escribe antes que el código y se ve fallar.
- Nombres en términos del comportamiento del CA, no de la implementación.
- Nada de red real ni de modelos reales en `test:front`, `test:backend` ni `pytest -m unit`
  (msw, nock, respx).
- Nada de estado compartido: cada test arma y limpia lo suyo; la base de integración es descartable.
- Un test flaky no se reintenta hasta que pase: se reporta y se investiga.

## 9. Validación en navegador

Los tests de §2–§6 prueban el código; esta sección prueba que **lo que pide la HU funciona en la
app real**, navegándola como una persona. Va en `/verificar` cuando el diff cambia algo que el usuario
ve o recorre (pantallas, rutas, auth, Portfolio Entry), y otra vez después del deploy.

Dos herramientas, para dos cosas distintas:

| Herramienta | Para qué | Cuándo |
|---|---|---|
| **BrowserSkill** (`bsk`, skill `browser-skill`) | Explorar los `CA-n` de la HU en la app levantada, con consola y red capturadas | Antes del PR, contra local |
| **`scripts/jev-regresion.py`** (jev-ultrafast + Jev) | Recorridos repetibles en lenguaje natural, con verificación de la ruta por fuera del agente | Antes del PR contra local, y después del deploy contra producción |

### Antes del PR, contra local

1. Levantar la app: `cd front && npm run dev:all` (front en `http://localhost:5173`).
2. **La persona** inicia sesión en su Chrome. El agente usa esa sesión y nunca escribe credenciales,
   códigos ni datos de pago: si aparece un login, para y lo pide.
3. Con BrowserSkill, por cada `CA-n` visible: `bsk debug start`, navegar, `bsk observe`, actuar,
   y guardar captura + errores de consola y red (`bsk debug aggregate`, `bsk debug console`).
   Errores de consola de extensiones del navegador no cuentan.
4. Si la HU agrega o cambia un recorrido, sumarlo a `scripts/jev-regresion.cases.json` con su
   `"hu": "KAN-nnn"` y correrlo:
   ```bash
   STARTERIA_URL=http://localhost:5173 \
     uv run --project jev-ultrafast --env-file jev-ultrafast/.env python scripts/jev-regresion.py --hu KAN-nnn
   ```
   Un recorrido es `start` + `goal` en lenguaje natural + `expect` (la ruta final). Para rutas que
   deben abrirse directo o sobrevivir a una recarga, usar `deep_links`: ahí no actúa el agente, así
   que no puede tapar un redirect volviendo por el menú.

### Después del deploy, contra producción

La suite completa contra `https://starter-ia.com`, sin `STARTERIA_URL`. Sale con 1 si algo falla.
Es solo lectura: los objetivos piden navegar sin crear, editar ni borrar.

### Reglas

- **El `DONE` de Jev no es evidencia.** Lo que cuenta es la ruta final, el texto visible o la
  respuesta de la API, verificados por fuera del agente.
- Recorridos que crean datos (un proyecto, un frente) no van en la suite: se prueban con BrowserSkill
  sobre datos marcados `[QA]` y con el sí de la persona si es producción.
- La entrada pública limita a 20 sesiones cada 10 minutos por IP: tandas grandes contra producción
  chocan con 429.

### Preparar el entorno (una vez)

- BrowserSkill: CLI `bsk` y la extensión en Chrome (`bsk doctor` para revisar).
- jev-ultrafast: `git clone https://github.com/browser-use/jev-ultrafast.git && cd jev-ultrafast && uv sync`
  en la raíz del repo (está en `.gitignore`). Su `.env`: `TYPESAFE_API_KEY=<JEV_API_KEY>`,
  `TYPESAFE_MODEL=jev-latest`, `TEXT_MODEL_API_KEY=<OPENROUTER_API_KEY>`,
  `TEXT_MODEL_BASE_URL=https://openrouter.ai/api/v1`.
- Chrome con `chrome://inspect/#remote-debugging` habilitado.

Si falta algo de esto, la validación va como `NO CORRIDO` con el motivo; no se reemplaza por
"debería funcionar".
