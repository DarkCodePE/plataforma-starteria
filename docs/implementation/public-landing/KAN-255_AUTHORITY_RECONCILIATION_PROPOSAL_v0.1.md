# KAN-255 — Propuesta de reconciliación de autoridad para Public Landing V2

**Estado:** PROPUESTA / NO ES AUTORIDAD / IMPLEMENTACIÓN BLOQUEADA  
**Fecha:** 2026-11-19  
**Issue:** [KAN-255](https://stateria.atlassian.net/browse/KAN-255)  
**Superficie:** exclusivamente `/`  
**No modifica:** `/public/start`, Portfolio Entry, Core, Steps 0–4, backend, IA productiva, schema, auth ni `sw-factory`

Este documento prepara la decisión y la reconciliación solicitadas por KAN-255. Su presencia en el
repositorio no aprueba la decisión, no cambia el estado de ningún ADR y no autoriza código de
producto. La autorización efectiva requiere una decisión humana explícita y trazable en Jira y su
posterior materialización en el Product ADR y el Manifest V2.

## 1. Hechos observados

- KAN-255 está en estado `Por hacer`, no tiene subtareas, comentarios, issue links ni una
  ratificación de Producto registrada.
- `main` ya representa una landing sin enlaces a `/public/start`, con CTA comercial dirigido a
  `PUBLIC_LANDING_CONFIG.demoBookingUrl` y una narrativa Platform + Fab.
- Ese comportamiento fue introducido después de KAN-102, pero `CURRENT_STATE.md`, el Manifest y los
  contratos de Landing siguen describiendo Portfolio Entry como una opción alcanzable desde `/` y
  Demo/Early Access como destinos bloqueados.
- El código no puede resolver esa discrepancia: la autoridad debe reconciliarse antes de continuar.

## 2. Conflictos de autoridad

### CONFLICT KAN-255-C01 — Portfolio Entry alcanzable desde la Landing

```text
Contract: Product ADR-006 §§4.2, 4.4, 6 y 9
Requirement: KAN-255 AC5 — cero enlaces desde `/` hacia `/public/start`
Current document/code: CURRENT_STATE y Manifest KAN-102 aún declaran Portfolio Entry opcional;
                       el código actual ya muestra cero enlaces
Observed mismatch: la autoridad exige que Portfolio Entry sea alcanzable desde Landing;
                   KAN-255 y el runtime actual lo desacoplan por completo de `/`
Risk: implementar AC5 sin decisión superior consolida un cambio de funnel contrario a un ADR aceptado
Recommended treatment: UPDATE mediante Product ADR-011 que superseda parcialmente ADR-006
Requires ADR: yes
```

ADR-006 debe conservar la separación conceptual, la existencia directa de `/public/start`, la
frontera pre-Core y todos sus guardrails. Solo se propone superseder la obligación de enlazar
Portfolio Entry desde `/` y el funnel público de tres rutas.

### CONFLICT KAN-255-C02 — Dos conversiones frente a un único destino configurado

```text
Contract: Product ADR-006 §§4.3, 4.4, 6 y 8; Public Landing UX Spec §§3–7;
          Public Landing / Portfolio Entry Continuation Architecture §§1–3
Requirement: KAN-255 AC6 — CTAs exclusivamente al destino comercial configurado
Current document/code: los contratos exigen Early Access y Demo independientes;
                       el código usa un único demoBookingUrl configurado
Observed mismatch: el funnel contractual de dos conversiones no coincide con la CTA única de KAN-255
Risk: presentar una CTA como acceso, reserva o piloto concedido, o mantener contratos que describen
      caminos inexistentes
Recommended treatment: UPDATE mediante Product ADR-011; mantener los contratos comerciales como
                       no implementados y autorizar únicamente el destino configurado
Requires ADR: yes
```

La CTA autorizable no crea acceso, no concede un piloto y no certifica una reserva. Inicia una
conversación para evaluar una demo contextualizada o un piloto acordado.

### CONFLICT KAN-255-C03 — Estado del destino comercial

```text
Contract: STARTERIA_V2_MANIFEST KAN-102 y CURRENT_STATE —
          RUNTIME_PENDING / BLOCKED_BY_DESTINATION
Requirement: KAN-255 AC6 — conservar el destino comercial configurado
Current document/code: PUBLIC_LANDING_CONFIG tiene fallback real de Calendly y la Landing ya lo usa
Observed mismatch: la evidencia de código posterior no fue reconciliada con el estado documental
Risk: tratar una implementación existente como autorización de producto
Recommended treatment: UPDATE Manifest/CURRENT_STATE solo después de ratificación humana
Requires ADR: yes, por estar unido a la revisión del funnel de ADR-006
```

### CONFLICT KAN-255-C04 — Autoridad de Landing y Portfolio Entry conflada

```text
Contract: docs/STARTERIA_AUTHORITY.md §4 — “Pantalla 1 - Portfolio Entry / Landing publica”
Requirement: KAN-255 limita el cambio a `/` y prohíbe modificar Portfolio Entry
Current document/code: `/` y `/public/start` ya son superficies y componentes separados
Observed mismatch: el rótulo de autoridad puede interpretarse como un único vertical slice
Risk: usar el contrato de Portfolio Entry para gobernar copy, funnel o claims de `/`
Recommended treatment: ADD una aclaración de ownership sin modificar el contrato de Portfolio Entry
Requires ADR: no adicional; ADR-011 puede fijar la aclaración
```

## 3. Tratamiento de documentos anteriores

| Documento | Tratamiento propuesto | Motivo |
|---|---|---|
| Product ADR-006 | `PARTIALLY_SUPERSEDED_BY_ADR_011` | Conserva separación y guardrails; cambia el funnel de `/`. |
| Public Landing UX Spec v0.1 | `SUPERSEDED_FOR_ROOT_LANDING_BY_KAN_255` | Sus bloques obligatorios de Portfolio Entry y Early Access/Demo no aplican al nuevo `/`. |
| Public Landing / Portfolio Entry Continuation Architecture v0.1 | `PARTIALLY_SUPERSEDED_FOR_ROOT_LANDING` | Sigue siendo referencia histórica de continuación, no anatomía activa de `/`. |
| KAN-102 implementation report | `HISTORICAL` | Evidencia válida de su slice, no autoridad del nuevo diseño. |
| Portfolio Entry Logic Contract v0.1 | `UNCHANGED` | Continúa gobernando `/public/start`. |
| Design System Contract y Page Anatomy System | `KEEP` | Admiten experimentación de copy, orden y visuales sin cambiar semántica. |

## 4. Decisión de producto propuesta — Product ADR-011

Título propuesto:

```text
ADR-011 — Public Landing V2 Platform + Fab narrative and Portfolio Entry disconnection
```

Decisión propuesta:

1. `/` es la superficie comercial y explicativa de Startería Platform; debe comprenderse sin
   interacción previa y sin presentar un chatbot, un gestor de tareas o una consultoría aislada.
2. `/public/start` permanece disponible como ruta directa y conserva íntegramente la autoridad de
   Portfolio Entry, pero deja de ser un destino o CTA de la Landing.
3. La Landing usa una única familia de CTAs comerciales, todos dirigidos a
   `PUBLIC_LANDING_CONFIG.demoBookingUrl`. El destino permite iniciar una conversación; no concede
   acceso, reserva, piloto ni resultado.
4. Fab se presenta como capacidad tecnológica opcional durante la ejecución. No es un producto
   competidor de Platform, no implica integración automática Platform–Fab y no modifica el
   repositorio o la lógica de `sw-factory`.
5. La única demostración de producto es ilustrativa, etiquetada y organizada en cuatro etapas:
   clarificar, conectar/priorizar, ejecutar/preparar decisión y reutilizar aprendizaje.
6. En ejecución se muestran dos rutas no excluyentes: con el equipo y con Fab. Ambas convergen en
   entregables, evidencia, resultado y continuidad de la iniciativa.
7. No se autorizan métricas, ROI, ahorros, capacidades BYO LLM, integración E2E o resultados no
   verificados.
8. El slice es frontend-only. No cambia rutas, auth, Core, Steps 0–4, backend, IA productiva,
   schema, permisos ni Portfolio Entry.

Relación de supersession propuesta:

```text
ADR-006: PARTIALLY SUPERSEDED BY ADR-011

RETAIN:
- `/` como Landing pública principal y fuera del auth guard
- separación Landing / Portfolio Entry
- `/public/start` como superficie directa y pre-Core
- representación ilustrativa, autoridad humana y no canonicalización
- límites de Core, Steps, handoff y conversiones

SUPERSEDE FOR `/`:
- Portfolio Entry debe ser alcanzable desde Landing
- funnel Landing → Portfolio Entry
- obligación de presentar Early Access y Demo como dos CTAs independientes
- obligación de explicar Copilot/Portfolio Entry dentro de Landing
```

## 5. Texto de ratificación humana propuesto

La decisión debe quedar registrada por Product Decision Owner en KAN-255. Texto sugerido:

```text
RATIFY KAN-255 / Product ADR-011

Apruebo la decisión de producto descrita en
docs/implementation/public-landing/KAN-255_AUTHORITY_RECONCILIATION_PROPOSAL_v0.1.md.

Autorizo un slice frontend-only para `/` que:
- elimina todo enlace de la Landing a `/public/start`, sin retirar ni modificar Portfolio Entry;
- usa exclusivamente el destino comercial configurado y no promete acceso, reserva o piloto;
- presenta Fab como capacidad opcional de ejecución, sin integración automática certificada;
- supersede parcialmente ADR-006 y los contratos de Landing únicamente en los puntos enumerados;
- no modifica Core, Steps 0–4, backend, IA productiva, schema, auth ni sw-factory.

Autorizo materializar ADR-011, reconciliar Manifest/CURRENT_STATE e implementar KAN-255 dentro de
estos límites. No autorizo merge ni despliegue automático.
```

La identidad, fecha e ID del comentario de ratificación deben incorporarse al ADR-011 y al Manifest.

## 6. Entrada propuesta para STARTERIA_V2_MANIFEST.md

No agregar como `ACTIVE` antes de la ratificación. Después de ella, registrar:

```text
slice_id: KAN-255_PUBLIC_LANDING_V2_PLATFORM_FAB_NARRATIVE
HU: KAN-255
logic_status: ACTIVE_V2_BASELINE (Product ADR-011; frontend framing only)
implementation_status: AUTHORIZED_NOT_IMPLEMENTED
visual_status: V2_CANDIDATE
evidence_status: NO_IMPLEMENTATION_EVIDENCE
semantic_owner: Public Landing V2 exclusively for /
authority: KAN-255 + ratification comment ID + Product ADR-011 + Design System Contract v0.1 +
           Page Anatomy System v0.1
entry_boundary: public route /
exit_boundary: /auth | /dashboard for authenticated user | configured commercial destination |
               in-page anchors | external Fab information link
portfolio_entry_boundary: /public/start remains direct and unchanged; zero links from /
commercial_boundary: PUBLIC_LANDING_CONFIG.demoBookingUrl only; conversation request, not access,
                     booking guarantee or automatic pilot
fab_boundary: explanatory external link and optional delivery route; no certified Platform-Fab
              integration and no sw-factory changes
scope: Landing copy, information architecture, one four-stage illustrative demo, Team/Fab branch,
       compact impact/friction sections, responsive/accessibility, affected frontend tests and evidence
excluded: Portfolio Entry; Core; Steps 0–4; backend; Prisma/schema; auth; permissions; productive AI;
          sw-factory implementation; new commercial routes; fabricated metrics; merge; deploy
tests_protecting_current_behavior: LandingPage.test.tsx; routes.public-entry.test.tsx;
                                   public-landing-l1.spec.ts; portfolio-entry-conversion.spec.ts
supersession: ADR-006 PARTIALLY_SUPERSEDED; Landing UX Spec and continuation architecture superseded
              only for the root Landing surface; KAN-102 report retained as historical evidence
```

Al autorizarse, `CURRENT_STATE.md` debe registrar el nuevo baseline y dejar KAN-102 como estado
histórico, sin reescribir su evidencia.

## 7. V2_CHANGE_GUARDRAIL_CHECK

```text
V2_CHANGE_GUARDRAIL_CHECK

Slice: KAN-255_PUBLIC_LANDING_V2_PLATFORM_FAB_NARRATIVE (candidate)
Authority: KAN-255 definition only; Product ADR-011 and ratification not yet present
Manifest status: ABSENT / NOT_AUTHORIZED
Current route: / → LandingPage; /public/start remains a separate direct route
Legacy dependencies: KAN-102 copy/tests; ADR-006 optional Portfolio Entry funnel; Landing UX Spec;
                     continuation architecture; configured commercial CTA introduced after KAN-102
Semantic owner: Public Landing V2 for /; Portfolio Entry V2 remains owner of /public/start
V1 assumptions detected: Landing and Portfolio Entry treated as one funnel; required Optional
                         Portfolio Entry block; two commercial paths without authorized runtime
Adapter required: NO — presentation-only frontend slice
Tests protecting current behavior: LandingPage.test.tsx; routes.public-entry.test.tsx;
                                   public-landing-l1.spec.ts; portfolio-entry-conversion.spec.ts
Tests required for V2: focused Vitest; route regression; Playwright four-stage/Team-Fab/CTA/no-entry;
                       overflow and captures at 390/768/1024/1440; keyboard/focus/contrast;
                       reduced-motion; build; full typecheck; lint
Authority conflict: YES — KAN-255 AC5/AC6 conflict with accepted ADR-006, Landing UX Spec,
                    continuation architecture, Manifest and CURRENT_STATE; no ratification comment
Proceed: NO
```

## 8. Condición para repetir el guardrail

Repetir el guardrail solo cuando existan conjuntamente:

1. comentario humano de ratificación en KAN-255;
2. Product ADR-011 materializado con identidad y evidencia de la decisión;
3. entrada KAN-255 en `STARTERIA_V2_MANIFEST.md` con estado autorizado;
4. reconciliación no destructiva de `CURRENT_STATE.md` y del índice de Product ADRs;
5. alcance técnico confirmado como frontend-only y sin cambios en las exclusiones.

