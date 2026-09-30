# Starteria — Demo Request Experience Contract

**Documento:** `DEMO_REQUEST_EXPERIENCE_CONTRACT_v0.1.md`
**Versión:** v0.1
**Estado:** ACCEPTED
**Tipo:** Experience Contract
**Alcance:** solicitud pública de demo de Starteria
**Implementación autorizada:** NO

Este contrato define la semántica mínima de la solicitud de demo. No define proveedor de calendario,
CRM, automatización de email, pricing, disponibilidad comercial, arquitectura técnica, integración con
Gmail/Calendar ni el diseño detallado de un piloto.

## 0. Autoridad y límites

Este contrato está subordinado a:

1. `docs/STARTERIA_AUTHORITY.md`;
2. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`;
3. ADRs de producto aceptados, especialmente ADR-006 y ADR-003;
4. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` para cualquier contexto
   heredado de Portfolio Entry.

No modifica Portfolio Entry, Clarification, Handoff, Agent, Skills, Core, Step 0–4 ni la frontera de
autenticación. Una demo es una conversación de comprensión y aplicación potencial, no una activación
automática de trabajo.

## 1. Purpose

Permitir que una persona solicite una conversación para conocer Starteria y explorar cómo podría
aplicarse a su equipo u organización.

La demo debe explicar la plataforma completa y sus posibles usos. No debe reducirse a revisar únicamente
el resultado de Portfolio Entry.

## 2. User job

> Quiero conocer Starteria, entender cómo funciona y valorar cómo podría aplicarse a mi equipo u
> organización.

El usuario no necesita llegar con un diagnóstico cerrado ni completar un formulario largo.

## 3. Entry points

### 3.1 Desde Landing

```text
Landing → Agendar demo de Starteria → Demo request
```

Esta ruta es independiente de Portfolio Entry.

### 3.2 Desde Portfolio Entry Continuation

```text
Landing → Portfolio Entry → Clarification → Handoff → Continuation → Demo Starteria
```

La demo puede usar el contexto provisional para hacer la conversación más relevante, pero no queda
limitada a ese contexto.

## 4. Promise

La promesa conceptual es:

> Conoce cómo Starteria conecta necesidades y estrategia con iniciativas, evidencia, avance y decisiones,
> y explora qué podría aportar a tu equipo.

No promete implementación, resultados, encaje confirmado, disponibilidad, pricing ni piloto.

## 5. Minimum qualification / context information

Solicitar únicamente lo necesario para preparar una conversación útil:

- nombre o identificador de contacto;
- email o canal de contacto;
- organización, equipo o contexto profesional, si el usuario desea compartirlo;
- qué le gustaría entender o explorar en la demo;
- tamaño o tipo de equipo, solo si cambia materialmente la preparación;
- preferencia de contacto o disponibilidad general, si aplica al mecanismo futuro.

No exigir un inventario de iniciativas, KPI, estructura organizacional, presupuesto, procurement,
roadmap, business case ni diagnóstico completo.

## 6. Reuse of Portfolio Entry context

Si la solicitud llega desde Portfolio Entry, puede reutilizar:

- `entry_id` o referencia equivalente de sesión;
- versión del handoff o snapshot provisional;
- necesidad entendida y resultado deseado;
- contexto conocido relevante;
- incertidumbres y gaps abiertos;
- `recommended_approach` como sugerencia, no como conclusión;
- `starteria_path` y `recommended_cta` como contexto de origen;
- procedencia y estado de revisión;
- origen `PORTFOLIO_ENTRY_CONTINUATION`.

La demo puede usar ese contexto para proponer una agenda inicial, pero debe presentar Starteria como
plataforma completa: no solo como respuesta a una única lectura provisional.

## 7. What NOT to ask again

Si ya existe contexto suficiente, no volver a preguntar:

- qué necesita conseguir o entender;
- el problema, objetivo o situación ya declarados;
- las áreas, producto, unidad o mercado ya compartidos;
- qué motivó la entrada original;
- los gaps ya identificados, salvo que el usuario quiera corregirlos.

Puede pedirse información adicional solo cuando cambie materialmente la preparación de la demo o cuando
sea necesaria para contactar. No repetir el journey de Portfolio Entry.

## 8. Demo request semantics

Enviar una solicitud de demo significa:

- expresar interés en conocer Starteria;
- permitir que el equipo prepare una conversación contextualizada;
- registrar el origen directo o desde Portfolio Entry;
- dejar la solicitud pendiente de coordinación o respuesta.

Enviar no significa:

- haber recibido una demo;
- haber sido aceptado en un piloto;
- haber comprado o contratado Starteria;
- haber creado una organización, portfolio o iniciativa;
- haber confirmado que Starteria es adecuado para el caso.

## 9. Scheduling / next-step semantics

El siguiente paso puede ser:

- coordinación de una conversación;
- selección de un horario mediante un mecanismo que se definirá después;
- contacto para aclarar el objetivo de la demo;
- respuesta informativa sin reunión, si esa resulta la mejor continuación;
- propuesta comercial o de piloto posterior, únicamente como decisión separada.

Este contrato no fija proveedor de calendario ni disponibilidad. La solicitud puede quedar en estado
`pending_scheduling` hasta que exista una confirmación real de coordinación.

## 10. Confirmation state

Tras un envío válido, la experiencia debe mostrar una confirmación como:

> Recibimos tu solicitud de demo. Te contactaremos para coordinar la conversación y adaptar la demo a lo
> que quieres entender.

Estados conceptuales mínimos:

- `draft`;
- `submitted`;
- `pending_scheduling`;
- `scheduled`;
- `completed`;
- `cancelled`;
- `closed`;
- `failed`.

`submitted` no equivale a `scheduled`, `completed` ni `pilot_started`.

## 11. Demo vs Pilot boundary

La demo sirve para conocer Starteria, su lógica, sus superficies y su posible aplicación.

Un piloto es una decisión comercial y de adopción posterior que requiere definir separadamente, como
mínimo:

- objetivo y alcance;
- participantes y autoridad;
- condiciones de acceso;
- duración y soporte;
- evidencia esperada;
- criterios de revisión;
- tratamiento de datos y consentimiento correspondiente.

La solicitud o realización de una demo no crea un piloto, no reserva un piloto y no activa trabajo de
Starteria. El equipo puede proponer el piloto como siguiente decisión comercial posible, pero el usuario
debe aceptarlo mediante un flujo y contrato posteriores.

## 12. Persistence semantics

La solicitud debe conservar, conceptualmente:

- identificador de solicitud;
- datos de contacto y consentimiento;
- objetivo declarado de la demo;
- contexto mínimo aportado;
- origen de entrada;
- referencia al contexto heredado, si existe;
- versión de contrato;
- timestamps;
- estado de coordinación;
- historial de cambios, cancelación o retiro.

La persistencia debe ser idempotente para evitar solicitudes duplicadas por reintentos. El contexto
heredado se referencia o copia con procedencia; no se modifica el Handoff original.

## 13. Canonicalization boundary

Demo Request no crea ni activa:

- `Organization`;
- `StrategicFront`;
- `Challenge`;
- `Initiative`;
- `Step`;
- `Decision`;
- `Evidence` canónica;
- Step 0 o Adaptive Core.

Tampoco concede Portfolio membership, Portfolio Lead authority, Initiative ownership o permisos
organizacionales. Registro/autenticación mantiene identidad y continuidad provisional, no autoridad de
negocio.

## 14. Analytics events conceptuales

Los eventos deben ser conceptuales y minimizar datos sensibles:

- `demo_request_viewed`;
- `demo_request_started`;
- `demo_request_context_reused`;
- `demo_request_context_corrected`;
- `demo_request_submitted`;
- `demo_request_scheduling_started`;
- `demo_request_scheduled`;
- `demo_request_cancelled`;
- `demo_request_failed`.

Los eventos deben distinguir `LANDING_DIRECT` de `PORTFOLIO_ENTRY_CONTINUATION`. Ningún evento de
solicitud debe interpretarse como demo realizada o piloto iniciado.

## 15. Failure / error states

La experiencia debe contemplar:

- datos mínimos ausentes;
- contacto inválido;
- consentimiento no otorgado;
- solicitud duplicada o ya enviada;
- referencia heredada inexistente, expirada o no perteneciente al usuario;
- imposibilidad temporal de coordinar horario;
- conflicto de disponibilidad;
- cancelación o retiro;
- error temporal de persistencia;
- fallo al enviar.

El error debe explicar si la solicitud fue recibida o no y permitir reintentar sin duplicar. No debe
crear un piloto ni redirigir a Step 0 como fallback.

## 16. Definition of Done

- [ ] Demo se entiende como conversación para conocer Starteria y explorar su aplicación.
- [ ] Existe entrada directa desde Landing.
- [ ] Existe entrada conceptual desde Portfolio Entry Continuation.
- [ ] La demo no se reduce al resultado de Portfolio Entry.
- [ ] El contexto heredado se reutiliza con procedencia.
- [ ] No se repite información ya conocida sin motivo.
- [ ] La solicitud pide solo información mínima.
- [ ] Se distingue `submitted`, `scheduled`, `completed` y `pilot_started`.
- [ ] Demo no inicia automáticamente un piloto.
- [ ] No se crean objetos Core ni se activa Step 0.
- [ ] Los eventos distinguen origen directo y continuidad.
- [ ] Existen estados de error, cancelación y reintento idempotente.
- [ ] No se fija proveedor de calendario, CRM, email, pricing ni arquitectura técnica.
