# KAN-101 — Final Brief Actions v0.1

**Slice:** KAN-74 E2 — Restore final Brief Download and Delete actions
**Estado:** IMPLEMENTATION READY FOR REVIEW (sin commit)
**Fecha:** 2026-10-03

## Precondiciones y guardrail

- Jira: KAN-101 `En curso`; KAN-74 `En curso`; KAN-100, KAN-96 y KAN-98 `RESUELTO`.
- Git: `HEAD == origin/main` en `d228c18`; árbol limpio al inicio.
- Guardrail: `V2_CHANGE_GUARDRAIL_CHECK`, Slice KAN-74 E2; autoridad Jira KAN-101/KAN-74 subordinada al Experience Contract aprobado; Manifest: Portfolio Entry `ACTIVE_V2_BASELINE` / `PARTIAL_IMPLEMENTATION`; ruta existente; `SEMANTIC_OWNER: V2`; sin supuestos V1 ni conflicto; `Proceed: YES`.

## Evidencia histórica y autoridad

Jira KAN-74 aprueba tres acciones de salida: descargar el Brief, descartarlo/invalidate la Entry conforme al lifecycle, y trabajarlo con Starteria. Descargar no modifica Portfolio. Eliminar no modifica estructura canónica y requiere confirmación si no es reversible. Continuar transfiere el contexto, no auto-incorpora ni auto-envía.

La evidencia Git histórica localizada en la rama local KAN-74:

- `5c41113` añadió la superficie final de acciones.
- `0f255ef` añadió la exportación Markdown `serializeConfirmedBriefMarkdown` y su E2E; solo permite exportar una sesión confirmada con handoff.
- `14e4cdb` añadió la transición terminal `CONFIRMED → ABANDONED`, con revisión incrementada, autorización/idempotencia y bloqueo del resolver/continuación.
- `3f7387b` registró los reportes B2/B3: B2 revisado/aprobado y B3 revisado sin hallazgos. Son evidencia histórica, no autoridad por sí solos.

Las implementaciones B2/B3 dejaron de estar en el baseline actual. Se recupera el alcance semántico con adaptación al runtime D1/D2 y a la superficie vigente. No se restaura ciegamente el código antiguo. KAN-100 y su ruta permanecen intactos salvo la conexión del botón final con el handler existente.

## Superficie final

El resumen confirmado de Portfolio Entry presenta, en orden, `Descargar`, `Eliminar` y `Trabajarlo con Starteria`. El primer botón exporta; el segundo abre confirmación y solo entonces abandona; el tercero llama a la continuación existente. No se añade pantalla. El copy de continuidad ya no adelanta “crear portfolio/frente”.

## Download

El serializador Markdown exige `lifecycleStatus === CONFIRMED`, confirmación `CONFIRMED` y handoff. Proyecta campos aceptados/corregidos del handoff confirmado (resultado, entendimiento, decisión, contexto y enfoque aceptado/corregido) y contexto aún abierto disponible. No usa `rawEntry`, no añade provenance técnico al cuerpo y no hace solicitudes de escritura ni muta estado. Nombre: `starteria-brief-r<revision>.md`.

## Delete y lifecycle

La acción solicita confirmación explícita. `POST .../sessions/:sessionId/abandon` valida ownership/credencial, estado confirmado, confirmación y revisión esperada; usa idempotencia y realiza una sola transición a `ABANDONED` con revisión +1. Repetir la acción devuelve el estado abandonado existente. No hay hard delete ni escritura canónica. D1 ya responde 410 para `ABANDONED`; `continue-portfolio` ahora también responde 410 antes de continuar. La UI descarta la identidad local y muestra un estado terminal sin acción de continuación.

## Trabajarlo con Starteria / KAN-100

Se mantiene el handler KAN-100 de auth/claim, `continue-portfolio`, destino `/portfolio/setup` y D1/D2. El E2E KAN-100 recorre el botón de la superficie final confirmada, verifica el tuple exacto y D1 200 en First Value. No se cambiaron D1, D2, P1/P2/P3, Core, Steps ni la semántica de iniciativa.

## Escrituras y pruebas

- Download: cero escrituras de lifecycle y Portfolio.
- Delete: una actualización únicamente del lifecycle Portfolio Entry; cero escrituras canónicas.
- Prueba focalizada frontend: 26/26 PASS.
- Pruebas focalizadas backend de sesión/router: 56/56 PASS.
- `npm run test:front`: PASS.
- `npm run test:backend`: PASS.
- `npm run typecheck:front`: PASS.
- `npm run typecheck:backend`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS (advertencias existentes sobre chunk grande/import dinámico).
- `npm run build:backend`: PASS.
- E2E KAN-100: wrapper exit 0; identidad exacta y destino `/portfolio/setup`.
- E2E KAN-101 DOWNLOAD: wrapper exit 0; descarga Markdown real, lifecycle/revisión invariantes y canonical counts invariantes.
- E2E KAN-101 DELETE: wrapper exit 0; confirmación, `ABANDONED`, bloqueo de continuación (410) y canonical counts invariantes.

## Hallazgos restantes

- No se cambió el Manifest ni `CURRENT_STATE.md`: no se afirma cierre/integración antes de merge.
- No se hizo commit.
- El wrapper E2E inicial con un filtro unido por `|` falló en PowerShell antes de Playwright; las ejecuciones dirigidas posteriores usan filtros separados.

## V2 change closure check

- Contrato y alcance KAN-74 E2 cumplidos; superficie V2 existente.
- KAN-100 E1 sigue alcanzando `/portfolio/setup`; D1 exacto responde 200.
- Download no muta lifecycle; Delete solo invalida la Entry y la continuación queda bloqueada.
- E2E dirigido KAN-100, DOWNLOAD y DELETE: wrapper exit 0 en cada ejecución.
- Manifest/`CURRENT_STATE.md` se mantienen para el cierre posterior al merge; no se declara estado integrado.
- `Migration status: READY_FOR_REVIEW`; `KEEP_COMPAT` para el runtime y el destino de KAN-100 existentes.
