# UX-03 — Portfolio Lead E2 · Conversación actual e historial verificable

Fecha: 2026-11-09
Baseline: PR #281 HEAD 9ff806ab50144ee38db54b4d60237135cde36d72
Estado: PR apilado sobre UX-02; todavía NO integrado en main.

## AS-IS
- La conversación B3 renderiza todos los turnos del ledger en secuencia, incluso respuestas superseded/retractadas.
- Cada turno presenta metadatos; la distinción entre respuesta vigente y versiones antiguas requiere interpretación.
- El producto dispone de ledger, CAS, incorporación humana y revisión de diferencias UX-01; UX-02 aporta estado y recuperación.
- El backend B1 sigue gobernando una pregunta activa por versión de Anchor: no autoriza conversación ilimitada ni batch acceptance.

## Critique Nielsen
- H1 Visibilidad de estado: falta separar en la lectura rápida lo vigente de lo histórico.
- H3 Control/libertad: el usuario debe poder consultar el historial completo voluntariamente.
- H6 Reconocimiento antes que recuerdo: distinguir una respuesta actual de una reemplazada sin interpretar IDs/versiones.
- H8 Diseño minimalista: reducir carga de respuestas obsoletas en el flujo principal sin eliminar trazabilidad.

## TO-BE (implementado)
- Encabezado «Tu conversación» con conteo de respuestas incorporadas, corregidas y registradas.
- Por defecto, mostrar respuestas no superseded/no retractadas; mostrar etiquetas de estado por turno.
- Toggle explícito «Ver historial completo» / «Ver conversación actual» con aria-pressed.
- El historial completo conserva turnos corregidos y retractados; no se borra ni se migra información.
- No se ejecutan acciones de escritura al alternar vistas.

## Visualización AS-IS → TO-BE (texto)
AS-IS:
[Respuesta 1] [Respuesta corregida 1] [Respuesta 2] [Respuesta corregida 2] [Pregunta vigente]
TO-BE:
[Tu conversación · 2 incorporadas · 2 corregidas · 4 registradas] [Ver historial completo]
[Respuesta vigente 1 · incorporada] [Respuesta vigente 2 · pendiente] [Pregunta vigente]
Al expandir → [Respuestas anteriores, etiquetadas como versión corregida / retractada]

## Fuera de alcance
- No multi-turno sin incorporación: requiere contrato y servicio semántico B4.
- No implementación de aceptación en lote, reordenación de preguntas, nueva taxonomía ni actualización automática del Anchor.
- No cambio en flags, DB, gates E2/E3 o Step 0–4.
- ADR-010 sigue propuesto; ningún rollout autorizado.
- No se implementa con este cambio la totalidad del HTML v1.0.

## Tests de aceptación y QA
- El historial normal oculta turnos reemplazados, pero mantiene la respuesta vigente.
- El toggle muestra los turnos previos y luego vuelve a vista actual.
- El toggle nunca llama POST ni actualiza Anchor.
- Los estados de versión anterior/pendiente/incorporada se mantienen comprensibles.
- CI TypeScript, Node/Vitest y QA navegador autenticado requeridos antes de merge.
- Test de accesibilidad del botón toggle y navegación por teclado en QA.
- Verificar con usuario que puede entender por qué hay respuestas antiguas y cómo acceder a ellas.

## Dependencia
PR #281 debe fusionarse y validarse antes de rebasar este PR apilado sobre main. No hacer merge ni CD de este PR por separado sin cumplir la secuencia.

## Próximo slice UX-04 / KAN-253 B4
Diseñar Conversation Plan semántico que permita continuar con turnos provisionales y recibir una propuesta acumulada para revisión humana sin modificar Anchor en segundo plano. Requiere explicitación de contrato de sesión, control de versiones y test harness antes de modificar backend.
