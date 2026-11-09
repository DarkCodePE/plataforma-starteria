# KAN-253 B4-A / UX-04 — Contexto conversacional E2 verificable

**Fecha:** 2026-11-09
**Baseline:** rama UX-02, HEAD cef29bdca1a674a6f609fb08f3caf5ee9a9f624c (incorpora UX-03).
**Estado:** candidato, sin deploy ni activación de LLM. Apilado: PR #281 pendiente de merge a main; PR #282 se fusionó en su rama base.

## AS-IS comprobado
- Inicio es Overview-first; E1 tiene un contexto confirmado separado.
- B1 elige una única pregunta determinista en función del Anchor.
- B2/B3 guardan turnos provisionales y sólo los incorporan mediante revisión humana.
- UX-01 muestra diff; UX-02 expone disposición y recuperación; UX-03 separa conversación actual e historial.
- El backend no posee todavía un contexto de entrada a E2 que separe de forma explícita Anchor, E1 confirmado y cada turno vigente/no confirmado.
- Un turno NO debe convertirse en Anchor, KPI, baseline, target, decisión o Step por inferencia.

## Critique heurística NN/g
1. Visibilidad del estado: datos declarados, incorporados y sin confirmar deben diferenciarse.
3. Control/libertad: conservar correcciones, retractaciones y la posibilidad de no adoptar lo propuesto.
5. Prevención de errores: no usar respuestas de versiones stale ni E1 provisional como hechos.
6. Reconocimiento antes que recuerdo: el razonador debe recuperar contexto y correcciones sin pedir al usuario repetirlas.

## TO-BE de este slice — implementado
- Nueva proyección pura `buildE2ConversationContext`: E1 confirmado vigente, `anchorDraft`, turnos vigentes, estado de revisión y versiones.
- Los turnos sustituidos y retractados se excluyen del conjunto activo, pero sus IDs quedan en `excludedHistory`.
- Una respuesta aceptada se distingue de la no revisada, sin declararla automáticamente hecho validado.
- Respuestas ancladas a otra versión reciben `stale_anchor`.
- Nuevo GET autenticado y guardado por flag `/sessions/:sessionId/objective/conversation-context` de solo lectura.
- El endpoint reutiliza los controles owner/tenant de los servicios existentes. No POST/PATCH.
- Tests unitarios: incorporado vs pendiente, corrección/retractación, E1 draft, stale/unknown, vacío.

## Visual AS-IS → TO-BE
AS-IS:
E1 confirmado + Anchor + lista de turnos -> distintos consumidores deben reconstruir y clasificar por su cuenta.

TO-BE:
E1 confirmado (sólo si sigue vigente)
          +
Anchor en borrador (NO confirmado automáticamente)
          +
Turnos actuales:
  - incorporado
  - sin revisar
  - versión obsoleta
          +
Historial excluido (correcciones/retractaciones)
          ↓
Contexto verificable de solo lectura
          ↓
FUTURO B4-B: modelo semántico sujeto a schemas, provenance, budget y checkpoints humanos

## Lo que todavía NO está implementado
- Preguntas semánticas generadas por LLM, turnos provisionales múltiples con preguntas nuevas o aprobación agrupada.
- Recomendación de enfoque, síntesis generativa o inferencias de negocio.
- Nuevo proveedor, secretos o consumo de tokens.
- UX visual de revisión por lotes y confirmación por campo.
- Validación de navegador autenticado y rollout.
- ADR-010 continúa PROPUESTO, no se ratifica por crear este endpoint.

## Contrato previo a B4-B
- Un planner semántico puede LEER el contexto, pero no mutar directamente Anchor.
- Debe diferenciar `user_input`, propuesta de IA, contexto E1 confirmado y datos obsoletos.
- Cada pregunta debe declarar gap/resolves y mantener presupuesto y stopping rule.
- La aceptación en lote requerirá validación CAS/recibos en backend y un checkpoint humano claro.
- No generar automáticamente Front, Challenge, Initiative, Step o Decision.
- Si el contexto cambia durante la lectura, se debe detectar la discrepancia antes de cualquier aplicación futura.

## Validación pendiente
- CI TypeScript, Vitest y regresión.
- Revisión independiente y QA del endpoint con flags ON en entorno aislado.
- Análisis de consistency snapshot si se decide usar el endpoint en una operación de escritura en B4-B.
- No merge automático / no CD.
