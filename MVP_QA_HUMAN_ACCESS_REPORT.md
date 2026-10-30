# MVP-INT-01 — Acceso humano QA

Fecha: 2026-10-26

Estado: `MVP_QA_HUMAN_ACCESS_READY`

## Perfiles verificados

| Perfil humano | Correo | Rol real en DB | Organización / membresía | Activo | URL | Autenticación UI |
|---|---|---|---|---|---|---|
| Portfolio Lead | `kan178-lead@starteria.test` | `portfolio_lead` | `KAN-178 Org` / `admin` | Sí; desbloqueado | `http://127.0.0.1:5181/auth` | PASS; login HTTP 200 y aterrizaje en superficie `/portfolio` |
| Initiative Owner | `kan178-owner@starteria.test` | `colaborador` | `KAN-178 Org` / `member` | Sí; desbloqueado | `http://127.0.0.1:5181/auth` | PASS; login HTTP 200, invitación válida abierta y reentrada a iniciativa real en Step 2 |

`Initiative Owner` es el perfil funcional. Su rol persistido es `colaborador`; la propiedad efectiva procede de `Project.ownerId`, la invitación reclamada y la membresía de organización.

## Estado leído de PostgreSQL QA

- Ambos usuarios tienen password hash, `isActive=true`, cero intentos fallidos y `lockedUntil=null`.
- Ambos pertenecen a `kan178-org`; no se usó la base protegida de puerto 5433.
- `kan178-owner` es owner de `kan178-project-ready`, estado `IN_PROGRESS`, `step0Status=COMPLETED`, `currentStep=2`.
- Existen tres asignaciones KAN-178 `STARTED` dentro de `kan178-org`, reclamadas por el Owner y no revocadas: dos `EXISTING_INITIATIVE` y una `CHALLENGE`.
- La invitación `EXISTING_READY` abre el mismo Project y presenta continuidad en Step 2, sin repetir Accept/Start.

## Evidencia de navegador

Ejecución real contra `http://127.0.0.1:5181`:

- `KAN178_BROWSER_PASS checks=8 screenshots=7 failedResponses=0 consoleErrors=0`
- Login independiente de Portfolio Lead comprobado.
- Login independiente de Owner comprobado en desktop y móvil.
- Invitación válida, Overview, reentrada, activation-required y challenge-formulation comprobados.

Evidencia saneada: `artifacts/mvp-integration/human-access/`. No contiene passwords, tokens ni headers de autorización.

## Credenciales

Las contraseñas y el deep link de la invitación se guardaron exclusivamente fuera del worktree en:

`C:\Users\User\proyect-starteria\_qa-runtime\MVP-INT-01-20261026\human-access.env`

El archivo tiene herencia ACL deshabilitada y permisos sólo para el usuario local `User` y `SYSTEM`. No está bajo ningún worktree Git.

No se ejecutó ningún seed ni escritura de provisionamiento: las cuentas y relaciones requeridas ya existían.
