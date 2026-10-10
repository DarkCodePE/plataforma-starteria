# E2E Job-Driven en producción con usuario dedicado

Cómo correr el recorrido E2E contra producción (`https://starter-ia.com`) **sin usar cuentas
reales** y sin que los datos de prueba se vean en otras organizaciones.

> Producción es una puerta de una vía: lo que se escribe queda escrito hasta que se limpia. Cada
> paso de escritura de este runbook pide confirmación explícita de una persona.

## Precondiciones

1. **Aislamiento por organización desplegado.** Las listas de portafolio (frentes, Portfolio Home,
   capacidad, aprendizajes) filtran por la organización de quien las lee
   (`backend/modules/portfolio/portfolio-scope.ts`). Sin esto, otros Portfolio Lead verían los
   frentes de prueba. Lo cubre `front/e2e/job-driven/portfolio-org-isolation.spec.ts`.
2. **Fix de `teamMembers` desplegado** (PR #135). Sin él, Portfolio Home se cae apenas una
   iniciativa de Reto avanza un Step.
3. **Acceso a la base de producción** para el setup y la limpieza (`DATABASE_URL`). En producción
   el registro va a waitlist y no hay API para crear organizaciones.

## 1. Crear el tenant de prueba (una vez)

Por workflow, sin acceso local a la base. Las contraseñas son secrets del environment
`production` (`E2E_PROD_LEAD_PASSWORD`, `E2E_PROD_PARTICIPANT_PASSWORD`, ≥12 caracteres):

```bash
gh workflow run e2e-prod-tenant.yml -f command=setup -f apply=false   # seco: muestra qué crearía
gh workflow run e2e-prod-tenant.yml -f command=setup -f apply=true    # crea y corre el smoke
```

Cada corrida pide la aprobación del environment `production`. A mano, con `DATABASE_URL` de
producción, sigue funcionando el script directo:

```bash
cd front
npx tsx ../backend/scripts/e2e-prod-tenant.ts setup [--apply]
```

Crea, de forma idempotente:

| Qué | Valor |
|---|---|
| Organización | `org-e2e-prod` · "Starteria E2E (prueba)" |
| Portfolio Lead | `e2e-lead@starteria.test` (`portfolio_lead`, admin de la org) |
| Participante | `e2e-participante@starteria.test` (`participante`, miembro de la org) |
| Miembros del swarm de roles | `e2e-participante-2`, `e2e-colaborador`, `e2e-viewer`, `e2e-sponsor` `@starteria.test` (contraseña `E2E_PROD_MEMBER_PASSWORD`). Ver `prod-role-swarm.md` |

Los emails se cambian con `E2E_PROD_LEAD_EMAIL` / `E2E_PROD_PARTICIPANT_EMAIL`. Las contraseñas
nunca van al repo.

## 2. Correr el recorrido

```bash
cd front
E2E_PROD_BASE_URL=https://starter-ia.com \
E2E_PROD_LEAD_PASSWORD=... E2E_PROD_PARTICIPANT_PASSWORD=... \
npm run test:e2e:prod
```

`front/e2e/prod/job-driven-prod.spec.ts` usa **sólo API y navegador** (nada de Prisma). Todo lo
que crea lleva el prefijo `[E2E-PROD] <fecha>`:

| Paso | § del doc | Escribe |
|---|---|---|
| Frente en la org de prueba (verifica `organizationId`) | §7 | Frente |
| Copilot sugiere separar; se confirma un solo reto | §8–§11, §26 | Reto |
| Participante crea la iniciativa; el lead queda con autoridad; Mission Review en navegador | §15, §18, §23 | Proyecto, governance |
| Lectura de cobertura y de capacidad | §13, §4/§24 | — |
| Reconstrucción y modos del Copilot | §14, §20 | — |

**No corre en producción** el ciclo Step 0–4 ni la decisión organizacional: el ciclo exige evidencia
validada (`/truth`) y la decisión deja `Decision` + `PortfolioLearning`, que no se borran por API.
Siguen cubiertos por la suite local (`npm run test:e2e:job-driven`).

Al terminar, el spec borra sus frentes (los retos caen en cascada) y archiva el proyecto.

`npm run test:e2e` (local) no incluye `e2e/prod/`: sólo entra si `E2E_PROD_BASE_URL` está definida.

## Smoke con sesión después de cada deploy

`cd.yml` corre `scripts/ci/prod-api-smoke.sh` después del rollout: login de
`e2e-lead@starteria.test` y GET a `/portfolio/strategic-fronts`, `/portfolio/home`,
`/portfolio/capacity` y `/projects`, todos 200. No escribe. Existe porque `/api/health` no toca
la base y dio 200 mientras el portafolio respondía 500 (2026-09-25 → 2026-10-07). Si el secret no
está habilitado, el paso avisa y se omite: después del `setup --apply` hay que poner la variable del environment `production` `E2E_PROD_TENANT_READY=true` (`gh variable set E2E_PROD_TENANT_READY --env production --body true`). A mano: `gh workflow run e2e-prod-tenant.yml -f command=smoke -f apply=false`.

## 3. Limpiar

El `afterAll` limpia lo que puede por API. Para dejar el tenant en cero (proyectos archivados,
governance, cualquier resto de una corrida cortada):

```bash
gh workflow run e2e-prod-tenant.yml -f command=cleanup -f apply=false   # seco: lista lo que borraría
gh workflow run e2e-prod-tenant.yml -f command=cleanup -f apply=true
```

Borra sólo frentes de `org-e2e-prod` o de los usuarios de prueba, y proyectos de esos usuarios.
**Aborta** si encuentra un frente de esos usuarios en otra organización.

## Qué ve el resto de la plataforma

- Otros Portfolio Lead: nada (alcance por organización).
- Admins de plataforma: ven todo, incluidos los frentes `[E2E-PROD]` mientras existan.
- Participantes: el reto de prueba no se publica, así que no aparece en bandejas.

## Antes de la primera corrida

- [x] PR de aislamiento por organización (#136) y PR #135 desplegados
- [x] Schema de producción al día (2026-10-07, run 37572213341)
- [ ] Setup en seco revisado por una persona, luego `--apply`
- [ ] Contraseñas guardadas en el gestor de secretos
- [ ] Primera corrida con alguien mirando; limpieza en seco revisada antes de `--apply`
