# G02 — Primer gate Playwright autenticado: Inicio Overview-first y reentrada

Fecha: 2026-11-09. Base: main@d1668262303b8e176ac0c3d928ab0912de132559.

## AS-IS comprobado
El CI `e2e-light` ejecuta navegación KAN-212 con sesión existente y Portfolio Entry, pero no certifica que un usuario *sin ninguna preparación* vea primero el Overview, que abrir Inicio sea de solo lectura, ni que la reentrada desde Inicio mantenga el mismo Bootstrap.

## TO-BE implementado (pruebas, sin cambios al producto)
Nuevo `front/e2e/portfolio-g02-overview-first.spec.ts`, ejecutado en `.github/workflows/ci.yml` después de KAN-212:
1. Usuario portfolio_lead real aislado y organización propia registrada por API/Prisma.
2. **Sin proceso:** login UI → `/portfolio/inicio` → overview visible → estado sin preparaciones → CTA visible → recarga → **0** sesiones nuevas.
3. **Con proceso:** crear sesión por API explícita → login UI → vista Overview con `Retomar este espacio` → recarga sin crear otra sesión → clic en Retomar → Bootstrap visible → sesión original intacta y número de sesiones inalterado.
4. **E1 → E2:** con la misma identidad/organización, crear sesión directa y confirmar el contexto E1 por API real; login y Retomar muestran la conversación E2, mantienen E3 bloqueado y no modifican el Anchor ni crean sesiones en recarga.
5. No utiliza simulaciones de los endpoints de negocio, ni screenshots como prueba de persistencia, ni altera los flags de IA.
6. Navegador Chromium en CI con stack E2E de prueba aislado, no producción.

## Evaluación Nielsen
- H1 Visibilidad: Overview y estado de los procesos.
- H3 Control/libertad: retomar solo al pulsar el CTA; no crear sesión al abrir Inicio.
- H4 Consistencia: CTA de retomar y ruta de Inicio persistentes.
- H5 Prevención: evita creación accidental/duplicados.
- H6 Reconocimiento: una sesión existente reaparece sin pedir su identificador.
- H9 Recuperación: recarga conserva el estado.

## AS-IS → TO-BE
AS-IS (evidencia disponible): CI de Portfolio Entry + reentrada con Bootstrap ya preparado, sin gate específico sobre Overview vacío.
TO-BE: CI protege Overview vacío y con trabajo persistido, con verificación cruzada UI ↔ PostgreSQL.

## Definición de terminado de esta entrega
- CI completo, incluyendo el nuevo test, aprobado sobre SHA exacto.
- Revisión independiente del PR.
- Se mantiene ADR-010 como PROPUESTO: no activar E2 multi-turn/checkpoint en producción.
- G02 permanece IN_PROGRESS: faltan los recorridos auténticos E1/E2/E3 con flags ON en staging autorizado, 3 perfiles, tests de accesibilidad y checklist Nielsen H1–H10. Este test no acredita esas partes.

## Gate nuevo E2 → E3 bajo banderas aisladas

- Test Playwright contra browser+backend+PostgreSQL reales con identidad/tenant separados, sin proveedor IA.
- E1 confirmado por API gobernada → retomar mediante UI → 4 respuestas provisionales mediante UI con pregunta server-owned, sin modificar Anchor → revisión acumulada → 4 elecciones humanas → una escritura checkpoint → Anchor suficiente/no confirmado → botón explícito confirmar → Anchor confirmado → E3 visible.
- CI configura `PORTFOLIO_GOAL_E2_LEDGER_ENABLED`, `PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED`, `PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED` y sus banderas `VITE_` **solo en un paso E2E aislado**. No se activa esto en despliegue ni otros jobs.
- Todo fallo del test es un bloqueo de aceptación (se corrige el recorrido o el harness, nunca se desactiva la prueba para marcar verde).
- No sustituye la ratificación ADR-010 ni QA humano/usabilidad con los perfiles pyme/corporate. No habilitar producción.
