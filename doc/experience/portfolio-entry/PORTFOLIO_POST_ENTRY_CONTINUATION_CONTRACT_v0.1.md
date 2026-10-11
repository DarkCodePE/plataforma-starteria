# Starteria - Portfolio Post-Entry Continuation Contract

> SUPERSEDED_IN_PART para la frontera 114F — Portfolio Setup Continuity: gobierna el [contrato 114F aceptado](../../../docs/experience/portfolio-entry/PORTFOLIO_SETUP_CONTINUITY_EXPERIENCE_CONTRACT_v0.1.md). Ver [CURRENT_STATE](../../../CURRENT_STATE.md). Este documento conserva su estado `PROPOSED FOR REVIEW` y su contenido histórico; la continuidad sin repetición y la separación de permisos son compatibles, pero los campos y el handoff legacy no gobiernan 114F.

> PROPOSED FOR REVIEW: ver `../../../CURRENT_STATE.md`. Este contrato esta propuesto para revision. La implementacion fue observada como `IMPLEMENTED / LOCALLY VALIDATED` en el checkout productivo autorizado `Dashboardstarteria`, pero esa validacion no aprueba por si misma este contrato ni autoriza incorporar runtime productivo en este repositorio.

Documento: `PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md`
Version: v0.1 propuesta
Estado del contrato: PROPOSED FOR REVIEW
Estado de implementacion observado: IMPLEMENTED / LOCALLY VALIDATED en checkout productivo autorizado
Fecha: 2026-09-12
Tipo: Experience Continuation Contract
Alcance: despues de Handoff/Confirmation de Portfolio Entry y antes de cualquier activacion de iniciativa

## Estado observado de implementacion

Validacion observada en el checkout productivo/autorizado `Dashboardstarteria`:

- Portfolio Entry -> Portfolio Continuation backend + DB: passed.
- Browser E2E through Portfolio Home: passed.
- Representative Portfolio Entry harness cases: passed.
- Portfolio flow does not create Project / Steps / Adaptive Core.

Este repositorio no contiene ni ejecuta la runtime productiva. La validacion observada es evidencia de implementacion, no aprobacion del contrato.

## 0. Autoridad

Este contrato esta subordinado a:

1. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`
2. ADRs de producto aprobados
3. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`

Este contrato no reemplaza el handoff ni crea un nuevo Core. Define la continuidad minima para que una sesion Portfolio Entry confirmada llegue a un contexto Portfolio autorizado sin activar una iniciativa por defecto.

## 1. Handoff conservado

La continuidad debe consumir el handoff existente sin reemplazar sus campos conceptuales:

- `understanding`
- `desired_outcome`
- `decision_to_enable`
- `recommended_approach`
- `alternative_approaches`
- `known_context`
- `unresolved_context`
- `gap_resolution_map`
- `evidence_or_clarity_needed`
- `starteria_path`
- `recommended_cta`
- `provenance_summary`
- `handoff_status`

Si los tipos internos no pueden representar una distincion requerida, se propone una extension versionada. No se debe esconder un objeto nuevo incompatible dentro de strings.

## 2. Estados y permisos separados

La continuidad distingue:

```text
handoff listo
-> revision confirmada
-> elegibilidad
-> autenticacion
-> claim de sesion
-> autorizacion sobre contexto Portfolio
-> conversion/continuidad efectuada
```

Claim de sesion no concede rol empresarial. Confirmar comprension no aprueba estrategia, evidencia, alineamiento, inversion ni creacion de objetos canonicos.

## 3. Resultado minimo

La continuidad Portfolio debe producir:

- referencia versionada al handoff revisado;
- snapshot de contexto y procedencia;
- propietario tecnico de la sesion/claim;
- ambito Portfolio autorizado;
- estado de pendientes;
- primera accion Portfolio funcional.

No debe crear por defecto:

- `Project`;
- `TeamMember OWNER`;
- filas `Step` o modulos;
- `step0Status = IN_PROGRESS`;
- ciclo Adaptive Core;
- `StrategicFront` oficial;
- `Challenge` oficial;
- alineamiento aprobado desde inferencias.

Una creacion o modificacion empresarial requiere autorizacion y confirmacion propia del objeto afectado.

## 4. Continuidad controlada por servidor

El backend productivo debe fijar y validar:

- perfil de sesion;
- version de contrato/runtime/schema;
- destino permitido;
- revision confirmada;
- permisos y ambito;
- estado de conversion.

No tienen autoridad para elegir destino:

- `intent`;
- `entry_state`;
- `starteria_path`;
- `recommended_cta`;
- query params;
- estado de UI;
- ultimo mensaje del usuario.

## 5. Idempotencia y atomicidad

La idempotencia debe incluir como minimo:

- `sessionId`;
- operacion;
- revision confirmada;
- destino/perfil;
- usuario autenticado;
- ambito Portfolio autorizado.

Debe rechazar doble conversion a destinos incompatibles, conversion con revision obsoleta, conversion de sesion ajena, conversion Portfolio sin permiso Portfolio y conversion Project desde sesion Portfolio.

## 6. Definition of Done propuesta

- [ ] Perfil de sesion versionado.
- [ ] Snapshot Portfolio persistido sin `Project`/Steps.
- [ ] Permisos Portfolio validados en API.
- [ ] Conversion Project rechazada para sesiones Portfolio.
- [ ] Idempotencia por revision y destino.
- [ ] UI post-auth muestra contexto real y pendientes.
- [ ] Primera accion Portfolio funcional.
- [ ] Regresion Initiative conversion separada.
- [ ] Integracion DB y E2E ejecutados en entorno autorizado.
