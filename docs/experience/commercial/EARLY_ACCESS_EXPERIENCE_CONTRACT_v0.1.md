# Starteria — Early Access Experience Contract

**Documento:** `EARLY_ACCESS_EXPERIENCE_CONTRACT_v0.1.md`
**Versión:** v0.1
**Estado:** ACCEPTED
**Tipo:** Experience Contract
**Alcance:** solicitud pública de early access a Starteria
**Implementación autorizada:** NO

Este contrato define la semántica mínima de la solicitud de early access. No define proveedor de CRM,
automatización de email, disponibilidad comercial, pricing, arquitectura técnica ni rutas runtime.

## 0. Autoridad y límites

Este contrato está subordinado a:

1. `docs/STARTERIA_AUTHORITY.md`;
2. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`;
3. ADRs de producto aceptados, especialmente ADR-006 y ADR-003;
4. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` para cualquier contexto
   heredado de Portfolio Entry.

No modifica Portfolio Entry, Clarification, Handoff, Agent, Skills, Core, Step 0–4 ni la autoridad de
registro/autenticación. La solicitud de early access es una conversión comercial pública, no una
continuación de negocio canónico.

## 1. Purpose

Permitir que una persona manifieste interés en probar Starteria y deje la información mínima necesaria
para que el equipo pueda entender la solicitud y definir el siguiente contacto.

Early Access no es onboarding, activación de workspace, acceso concedido automáticamente ni creación de
una organización.

## 2. User job

> Quiero expresar que me interesa probar Starteria y saber qué ocurrirá después.

El usuario no debe tener que explicar toda su organización ni completar un assessment antes de enviar
la solicitud.

## 3. Entry points

### 3.1 Desde Landing

```text
Landing → Solicitar early access → Early Access request
```

Esta ruta debe ser independiente de Portfolio Entry.

### 3.2 Desde Portfolio Entry Continuation

```text
Landing → Portfolio Entry → Clarification → Handoff → Continuation → Early Access
```

La continuación puede reutilizar contexto provisional y trazable de Portfolio Entry, sin convertirlo en
verdad organizacional.

## 4. Promise

La promesa conceptual es:

> Déjanos saber que quieres probar Starteria. Revisaremos tu interés y te explicaremos los próximos
> pasos posibles.

El wording exacto es experimental. No debe prometer acceso, fecha, aprobación, resultados, pricing ni
participación en un piloto.

## 5. Minimum information requested

Solicitar únicamente lo necesario para identificar y responder la solicitud:

- nombre o identificador de contacto;
- email o canal de contacto;
- organización, equipo o contexto profesional, si el usuario desea compartirlo;
- motivo breve del interés en Starteria;
- consentimiento para ser contactado con relación a la solicitud.

El campo de contexto profesional puede ser opcional cuando la política de contacto permita procesar la
solicitud sin él. No exigir taxonomía interna, Portfolio, iniciativa, KPI ni autoridad organizacional.

## 6. Contexto heredable de Portfolio Entry

Si la solicitud llega desde una continuación de Portfolio Entry, puede conservar una referencia trazable
a:

- `entry_id` o referencia equivalente de sesión;
- versión del handoff o snapshot provisional;
- `understanding` / necesidad entendida;
- `desired_outcome`;
- `known_context` relevante;
- `unresolved_context` relevante;
- `recommended_approach`, siempre como sugerencia;
- procedencia y estado de revisión;
- ruta de origen `PORTFOLIO_ENTRY_CONTINUATION`.

El contexto heredado debe permanecer provisional y versionado. No se debe copiar como hecho confirmado
ni borrar la historia de Portfolio Entry.

## 7. Qué no volver a preguntar

Si ya existe información suficiente y trazable, no volver a preguntar:

- qué necesita conseguir o entender;
- el contexto ya declarado;
- el objetivo o resultado deseado ya expresado;
- las áreas, producto o situación ya compartidos;
- la razón por la que eligió continuar hacia Early Access.

Solo puede pedirse una aclaración adicional si es necesaria para procesar la solicitud o si el usuario
quiere corregir el contexto heredado. No repetir preguntas por defecto.

## 8. Submission semantics

Enviar una solicitud significa:

- registrar una manifestación de interés;
- asociar los datos mínimos y su procedencia;
- registrar si el usuario llegó directamente o desde Portfolio Entry;
- dejar la solicitud en estado pendiente de revisión/contacto.

Enviar no significa:

- acceso concedido;
- aceptación en un piloto;
- creación de cuenta u organización;
- aprobación de una necesidad o iniciativa;
- confirmación de alineamiento, ownership, KPI o evidencia.

## 9. Confirmation state

Tras un envío válido, la experiencia debe mostrar una confirmación clara, por ejemplo:

> Recibimos tu solicitud de early access. Revisaremos la información y te contactaremos para explicarte
> los próximos pasos.

Estados conceptuales mínimos:

- `draft`;
- `submitted`;
- `received_pending_review`;
- `contacted`;
- `closed`;
- `withdrawn`;
- `failed`.

`submitted` no equivale a `accepted` ni a `access_granted`.

## 10. What happens next

La confirmación debe explicar que el siguiente paso puede ser:

- revisión de la solicitud;
- contacto para entender encaje y disponibilidad;
- invitación posterior a una experiencia autorizada;
- propuesta de demo si resulta más adecuada;
- comunicación de que todavía no hay acceso disponible.

El contrato no fija cuál de esas opciones ocurrirá ni cuándo. Una eventual invitación, piloto o acceso
requiere su propio contrato y autorización.

## 11. Persistence semantics

La solicitud debe conservar, conceptualmente:

- identificador de solicitud;
- datos de contacto y consentimiento;
- mensaje o motivo declarado;
- origen de entrada;
- referencia al contexto heredado, si existe;
- versión de contrato;
- timestamps;
- estado de procesamiento;
- historial de correcciones, retiro o cambios relevantes.

La persistencia debe ser idempotente para evitar duplicar solicitudes por reintentos. Los datos heredados
no deben sobrescribir el snapshot original de Portfolio Entry.

## 12. Canonicalization boundary

Early Access no crea ni activa:

- `Organization`;
- `StrategicFront`;
- `Challenge`;
- `Initiative`;
- `Step`;
- `Decision`;
- `Evidence` canónica;
- Step 0 o Adaptive Core.

Tampoco concede Portfolio membership, Portfolio Lead authority, Initiative ownership o permisos
organizacionales. Registro/autenticación, si aparece posteriormente, conserva identidad y continuidad;
no canonicaliza negocio.

## 13. Privacy / consent expectations

La experiencia debe:

- explicar por qué solicita cada dato;
- distinguir datos necesarios de opcionales;
- obtener consentimiento explícito para contacto comercial relacionado con Early Access;
- permitir retirar la solicitud o el consentimiento según la política aplicable;
- minimizar datos sensibles y no pedir información corporativa innecesaria;
- conservar procedencia del contexto heredado;
- no presentar contexto público o inferido como hecho interno de la organización.

El contrato no decide la política legal concreta ni el proveedor de almacenamiento.

## 14. Analytics events conceptuales

Los eventos deben ser conceptuales y no contener texto sensible innecesario:

- `early_access_viewed`;
- `early_access_started`;
- `early_access_context_reused`;
- `early_access_context_corrected`;
- `early_access_submitted`;
- `early_access_submission_failed`;
- `early_access_withdrawn`.

Los eventos deben distinguir `LANDING_DIRECT` de `PORTFOLIO_ENTRY_CONTINUATION` y no deben convertir
una impresión, click o envío en acceso concedido.

## 15. Failure / error states

La experiencia debe contemplar:

- datos mínimos ausentes;
- email o contacto inválido;
- consentimiento no otorgado;
- solicitud duplicada o ya enviada;
- referencia heredada inexistente, expirada o no perteneciente al usuario;
- error temporal de persistencia;
- fallo al enviar;
- retiro o cancelación de una solicitud existente.

El error debe permitir reintentar sin duplicar ni perder silenciosamente el contexto. No debe redirigir a
Step 0 ni crear una entidad alternativa como fallback.

## 16. Definition of Done

- [ ] Early Access se entiende como manifestación de interés, no como acceso automático.
- [ ] Existe entrada directa desde Landing.
- [ ] Existe entrada conceptual desde Portfolio Entry Continuation.
- [ ] El contexto heredado conserva procedencia y referencia trazable.
- [ ] No se repite información ya conocida sin motivo.
- [ ] La solicitud pide solo información mínima.
- [ ] El envío y la confirmación explican qué ocurrirá después.
- [ ] `submitted` no equivale a `accepted` ni `access_granted`.
- [ ] No se crean objetos Core ni se activa Step 0.
- [ ] Consentimiento, retiro y minimización de datos están definidos conceptualmente.
- [ ] Existen estados de error y reintento idempotente.
- [ ] Los eventos analíticos distinguen origen directo y continuidad.
- [ ] No se fija proveedor, CRM, email, pricing, calendario ni arquitectura técnica.
