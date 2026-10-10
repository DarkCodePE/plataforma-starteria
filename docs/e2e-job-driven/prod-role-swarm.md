# Swarm de roles en producción

Un Portfolio Lead orquestador y varios miembros (subagentes de Claude Code) usan la plataforma de
punta a punta en `https://starter-ia.com`, cada uno con su propia cuenta y su rol. No reemplaza al
spec determinístico (`front/e2e/prod/job-driven-prod-cycle.spec.ts`): sirve para encontrar qué
partes se rompen o confunden cuando varias personas con roles distintos trabajan sobre la misma
iniciativa.

## Cuentas

Todas en la organización `org-e2e-prod`, creadas por `backend/scripts/e2e-prod-tenant.ts setup`:

| Cuenta | Rol de plataforma | En el equipo de la iniciativa |
|---|---|---|
| `e2e-lead@starteria.test` | `portfolio_lead` | lo agrega el lead (VIEWER) |
| `e2e-participante@starteria.test` | `participante` | OWNER (la crea) |
| `e2e-participante-2@starteria.test` | `participante` | EDITOR |
| `e2e-colaborador@starteria.test` | `colaborador` | EDITOR |
| `e2e-viewer@starteria.test` | `viewer` | VIEWER |
| `e2e-sponsor@starteria.test` | `sponsor` | VIEWER |

Los cuatro miembros comparten `E2E_PROD_MEMBER_PASSWORD` (secret del environment `production` y
copia local en `~/.config/starteria/e2e-prod.env`). Nunca en el repo.

## Reglas para los agentes

- Escriben sólo dentro de `org-e2e-prod` y con el prefijo `[E2E-SWARM] <fecha>` en todo lo que
  crean.
- No tocan datos de otras organizaciones ni intentan saltarse controles fuera del tenant: probar
  que un rol *no* puede hacer algo se hace sobre objetos del propio tenant.
- Un solo login por cuenta y por corrida (el login de producción tiene rate limit).
- Cada miembro reporta hallazgos con: rol, paso, qué esperaba, qué pasó, evidencia (status HTTP,
  texto en pantalla, captura) y si es bloqueo, bug o confusión.

## Limpieza

```bash
gh workflow run e2e-prod-tenant.yml -f command=cleanup -f apply=false   # listar
gh workflow run e2e-prod-tenant.yml -f command=cleanup -f apply=true    # borrar (con aprobación)
```
