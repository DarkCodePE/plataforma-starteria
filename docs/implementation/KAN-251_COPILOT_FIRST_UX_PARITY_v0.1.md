# KAN-251 — UX de conversación E1, paridad responsable con referencia HTML v1.0

**Estado:** Propuesta implementada en PR #275 apilada sobre #274, no fusionada ni desplegada.  
**Versión referenciada:** Startería Portfolio Lead Copilot-first v1.0 (HTML del usuario).  
**Propiedad:** Portfolio Bootstrap E1, no Portfolio Entry ni Adaptive Core.

## Qué se toma del prototipo
El diseño trata la conversación como interfaz central: historial alternado, preguntas claras con razón, ayudas editoriales, opción de desconocimiento y síntesis después de comprender. Se toma su lenguaje visual navy/violeta/lavanda y separación Inicio/Copilot. **El prototipo HTML utiliza respuestas y datos ficticios en memoria, sin IA real**; no importar su Javascript ni su contenido simulado al producto.

## Realización en la plataforma
El componente `PortfolioBootstrapSemanticConversation.tsx` ya leía `PortfolioBootstrapSemanticSnapshot`, con turnos, facts, activeQuestion y reasonToAsk. KAN-251 añade presentación conversacional, ayudas no generativas sobre la pregunta del servidor, preparación editable de «No lo sé todavía», consulta de evidencia literal y una lectura visible de claridad ganada. Los controles de ayuda jamás envían un turno ni escriben un ContextReview. El envío permanece explícito y la confirmación humana del snapshot E1 sigue gobernada.

## Condiciones de fidelidad
| Intención del HTML | Contrato real | Riesgo prohibido |
| --- | --- | --- |
| Mensajes usuario/asistente | Turnos con semanticVersion, fuente y pregunta recibida | Inventar un transcript |
| Ayúdame a redactar | Mostrar pauta neutral que el usuario escribe/edita | Atribuir una frase inventada al usuario |
| Qué significa | Exponer `reasonToAsk` del backend | Agregar razones no verificadas |
| No lo sé | Precargar texto editable; solo CTA envía | Marcar unknown sin persistencia/confirmación |
| Contexto anterior | Citas user_input del ledger, sin hechos retractados | Citar hipótesis como declaración |
| Síntesis provisional | Contar hechos observados, pendientes y hipótesis | Convertir propuesta en ContextReview confirmado |
| Continuidad | Mantener submit/retry/polling/CAS de KAN-245/246 | Duplicar efectos de escritura |

## Gates
- KAN-250 PR #274 debe fusionarse/certificarse antes de #275.
- CI, frontend typecheck, test unit KAN-246/251, E2E autenticado KAN-246 con PostgreSQL descartable, revisión independiente.
- `SEMANTIC_E1_ENABLED=false` por defecto; autorización y QA separados para cualquier proveedor IA live, tokens, gasto, métricas de coste o piloto.
- Fases futuras: paridad UX E2 objetivo, forma de reentrada multiperfil y cobertura microempresa/corporación, después E3–E7 por UI.

## Trazabilidad
- Jira: KAN-251, comentarios de paridad v1.0 y PR #275.
- Referencia previa de landing Overview-first: KAN-250 / PR #274.
- No se modifican Core, Prisma, fact ledger, selección de preguntas backend, gates ni asignaciones.
