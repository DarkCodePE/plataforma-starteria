# G02 · Checkpoint de Objetivo: claridad antes de decidir

Fecha: 2026-11-09. Base: main@4d44794efd80706bfd2507c16c8a78634028c2c4.
Este documento describe un ajuste verificado por inspección de código, no un resultado de prueba de usuario.

## AS-IS observado
El checkpoint E2 acumulado presenta cada respuesta con acciones «Incorporar / No incorporar», pero la comparación **Valor actual / Propuesto** aparece en fichas separadas más abajo. La persona debe relacionar mentalmente respuestas y valores distantes, especialmente con 4 campos. Las respuestas `unknown` / `not_applicable` no explicitan junto a la decisión que su incorporación preserva incertidumbre, no un KPI.

## TO-BE implementado
- Cada respuesta en el checkpoint incluye comparación local del valor actual del Anchor y el resultado previsto si se incorpora.
- Se conserva la respuesta original literal para trazabilidad.
- `unknown` / `not_applicable`: explicación contextual de que no produce meta/cifra/resultado confirmado.
- Se preservan radios por respuesta, obligación de elegir cada decisión, botón de aplicación humana y transacción backend sin cambios.
- Feature flag experimental OFF por defecto. No se activa E2 semántico live ni se altera Core.
- Tests frontend: valores actual/propuesto, estado deshabilitado previo a decisiones, contrato de aplicación existente y tratamiento de incertidumbre.

## Nielsen
- H1 Visibilidad del estado: distinguir actual vs posible efecto.
- H2 Correspondencia: lenguaje «Si decides incorporar» en vez de términos técnicos.
- H3 Control: la vista previa nunca es escritura.
- H5 Prevención: mejora decisión informada antes de activar checkbox y confirma después.
- H6 Reconocimiento: se elimina la comparación mental entre bloques alejados.
- H8 Minimalismo: dos valores junto a la decisión, sin forzar navegación adicional.

## AS-IS → TO-BE visual
AS-IS: Respuesta → «Incorporar / No incorporar» → recorrer 4 fichas para descubrir el antes/después → volver a decidir.
TO-BE: Respuesta → [Valor actual | Si decides incorporar] → «Incorporar / No incorporar» → aplicar checkpoint conjunto → confirmar Anchor por separado.

## Límites / Definition of Done G02
- El PR no cierra Goal #292; quedan UX real en navegador autenticado, comparación con prototipo, 3 perfiles, reentrada, accesibilidad y heurísticas H1-H10.
- ADR-010 sigue PROPUESTO/PENDIENTE DE RATIFICACIÓN y el runtime semántico E2 no está habilitado.
- No marcar producción tras merge sin verificar CD, flags y smoke.
