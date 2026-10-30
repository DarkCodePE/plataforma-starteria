# BASELINE-01 — Exclusión verificable de AI-03A y migración 68

## Resultado

`PASS`: el árbol committed de `198167f936c7a907d6e178c3d2c7481028d994d0` contiene 67 migraciones y no necesita ninguna tabla, modelo, router ni componente de Card viva.

## Comprobaciones sobre checkout limpio

| Control | Resultado |
|---|---|
| Directorios en `front/prisma/migrations` | 67 |
| `20261027120000_ai03a_step_living_card` | Ausente |
| Modelos/enums/relaciones `StepLivingCard*` | Ausentes del schema candidato |
| SQL o runtime Living Card | Ausente |
| Router/API Living Card | Ausente |
| `LivingCardPreview` y E2E AI-03A | Ausentes |
| Referencias AI-03A restantes | Sólo aserciones negativas de auditoría; no runtime |
| `prisma validate` / `prisma generate` | PASS |
| `migrate deploy` desde cero | 67/67 PASS |
| `migrate status` | Up to date |
| `migrate diff` | Sin diferencias |

La migración 67 incluida es `20261026160000_step_reasoning_session_turn`; proporciona las sesiones y turnos de Chat-01/02 y no depende de AI-03A.

## Preservación del experimento

La exclusión se hizo mediante staging selectivo, sin borrar el experimento. En el worktree original siguen presentes, sin stage:

- `front/prisma/migrations/20261027120000_ai03a_step_living_card/migration.sql`.
- El schema experimental completo, con SHA-256 `E8DF99615479DFD327FC2556FE196DB485DD77A40CFB333AEEA5E12DCBB8829C`.
- El SQL 68, con SHA-256 `4DF869FED1AE07030E2AEA8FBBBBB1861890DBA158F9F165AA339A6DDE125106`.
- Backend, frontend, tests, fixtures y artefactos AI-03A.

Además, el backup restaurable externo conserva el WIP íntegro. No se aplicó la migración 68 a QA ni a producción.

