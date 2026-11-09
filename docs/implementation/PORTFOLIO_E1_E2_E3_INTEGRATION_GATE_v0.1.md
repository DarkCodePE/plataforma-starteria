# Portfolio Lead — Validación E1 → E2 → E3 y subida a main

Fecha: 2026-11-09
Base para las pruebas: rama feat/portfolio-e2-b4b-semantic-question-candidate @ f68f4ba26848762d42f299cb84f0bff136b5cf85
Estado: PR de validación, no acreditación de despliegue.

## Inventario confirmado en GitHub
- main @ dfd1ac44bf6e21ff56f2c5de14326e0b687a5358 contiene KAN-250, KAN-251, KAN-252, KAN-253 B1-B3 y UX-01 (#280).
- PR #281 (UX-02) abierto, Draft, base main. Rama incluye merges #282 (UX-03) y #283 (B4-A).
- PR #284 (B4-B) abierto, Draft, base rama #281. Rama incluye merges #285 (B4-C1), #286 (B4-C2A), #287 (B4-C2B), #288 (B4-C2C), #289 (B4-C2D).
- El CI de la rama #284 @ f68f4ba26848762d42f299cb84f0bff136b5cf85 es SUCCESS (run 42626047150), pero NO equivale a una prueba de navegador de toda la experiencia, merge a main ni deploy.
- El candidato semántico B4-B no está conectado al runtime live. E2 multi-turn usa planner determinista enriquecido por respuestas provisionales.
- Flags E2 nuevas OFF por defecto; ADR-010 aún propuesto según documentos revisados. No autorizar activación de producción por este test.

## AS-IS
El último test PostgreSQL ejercita dos respuestas E2 y checkpoint accept/reject, pero no prueba una ficha suficiente confirmada ni la transición de E2 a E3 para un negocio sin iniciativas. El E2E light es Portfolio Entry y no certifica el Copilot-first de Portfolio Lead.

## TO-BE — Test HTTP/PostgreSQL agregado
1. Sesión con E1 confirmado y Anchor inicial insuficiente.
2. Cuatro preguntas emitidas por el servidor y respuestas provisionales consecutivas (resultado, decisión, contexto, señal).
3. Convergencia `ready_for_human_review` sin autoescrituras en Anchor.
4. Checkpoint de aceptación humana de las cuatro respuestas en una transacción.
5. Anchor pasa a suficiente pero no confirmado.
6. `confirmAnchor` humano explícito, con usuario y versión.
7. E3 sin iniciativas existentes vía `work-items/none`.
8. Reentrada de sesión conserva Anchor confirmado, contexto, fase y estado `no_existing_work`.

## Criterios de aceptación
- El CI debe ejecutar el test real con PostgreSQL; no basta que la prueba se añada.
- Los permisos, la idempotencia, el CAS, el historial y el guard de E1 deben seguir pasando.
- La secuencia debe ser verde antes de activar banderas para usuarios.
- En navegador autenticado: Inicio overview-first → Retomar → E1 → E2 (mínimo cuatro respuestas) → checkpoint → Confirmar → E3 sin iniciativas. Verificar un caso con iniciativas existentes, reentrada, multi-tab, recuperación y accesibilidad.

## Secuencia de integración sugerida
1. Revisar y fusionar #281 en main con CI/revisión aprobados.
2. Rebasear #284 sobre main, eliminar dependencia de la rama intermedia y fusionar tras revisar diff/CI.
3. Integrar este test de regresión con su PR sobre #284 o cambiar base a main tras #284.
4. Ejecutar smoke E2E autenticado y verificar CD/URL de despliegue, logs y flags por entorno. No afirmar producción sin evidencia.
5. No reutilizar secretos/keys de E1 para activar inferencia E2 sin un contrato de runtime propio.
