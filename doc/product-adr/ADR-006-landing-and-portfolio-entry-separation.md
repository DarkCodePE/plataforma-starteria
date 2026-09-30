# ADR-006: Separation between Starteria Landing and Portfolio Entry

**Estado:** ACCEPTED
**Fecha:** 2026-09-30
**Tipo:** Product ADR
**Relates to:** `backend/docs/adr/ADR-019-public-landing-absorbed.md`,
`doc/product-adr/ADR-002-portfolio-entry-active-question-clarification-convergence.md`,
`doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md`,
`doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`

> Este ADR formaliza una decisión de framing y boundary de experiencia. No autoriza por sí mismo
> cambios de frontend, backend, rutas productivas, Portfolio Entry, handoff, Core ni Step 0–4.

## 1. Context

Starteria necesita poder comprenderse como plataforma antes de que una persona interactúe con
Portfolio Entry.

La autoridad Core define Starteria como un sistema que combina espacios de trabajo estructurados,
asistencia de IA, gobernanza de evidencia y lógica de decisión de portafolio. Su tesis conecta lo que
la organización quiere mover, el trabajo activado, la evidencia generada, el valor sostenible y la
decisión posterior.

El Experience Contract activo de Portfolio Entry v0.1 define otra responsabilidad: permitir que una
persona empiece desde su realidad, exprese una necesidad en lenguaje natural y obtenga una
interpretación provisional, estructurada y trazable. Portfolio Entry es pre-Core y no debe crear
estructura corporativa canónica.

El checkout actual heredó una frontera más estrecha: Landing y Portfolio Entry fueron absorbidos en
una sola experiencia pública. La propuesta aprobada
`LANDING_PORTFOLIO_ENTRY_FRAMING_CHANGE_PROPOSAL_v0.1.md` identifica que esa combinación hace que la
entrada conversacional parezca el producto completo y que el usuario deba interactuar antes de
entender Starteria.

## 2. Problem

La experiencia pública debe servir a tres jobs distintos:

1. comprender qué es Starteria y qué beneficio genera;
2. solicitar early access o agendar una demo;
3. ordenar una situación concreta cuando todavía no existe claridad suficiente sobre el punto de
   partida.

Si Landing y Portfolio Entry se presentan como la misma experiencia, se producen estos riesgos:

- Portfolio Entry parece obligatorio, en lugar de opcional;
- el Copilot parece ser el producto, en lugar de una puerta inteligente de entrada;
- la conversión comercial queda subordinada a una interacción de diagnóstico;
- la representación del workspace y la interpretación provisional se confunden;
- se puede interpretar erróneamente que una entrada pública crea o activa trabajo formal.

## 3. Previous decision / ADR-019

ADR-019 fue aceptado para resolver un problema técnico y de navegación: absorber el landing dentro
de `front/`, hacer de `/` la superficie pública principal y reemplazar CTAs externos por navegación
interna hacia `/public/start`.

La decisión anterior estableció, en esencia:

```text
/ → Landing público → /public/start
```

También decidió que la implementación del landing fuera un componente del front existente y que la
raíz quedara fuera del guard de autenticación.

Esa absorción fue válida para el objetivo original, pero no formalizó una separación entre:

- explicación de Starteria;
- conversión comercial;
- orientación opcional mediante Portfolio Entry.

## 4. New decision

### 4.1 Landing principal

`/` sigue siendo la Landing pública principal de Starteria y debe poder comunicar por sí misma:

- qué es Starteria;
- qué beneficio genera;
- cómo conecta estrategia/necesidades, iniciativas, evidencia, seguimiento y decisiones;
- una representación simple e ilustrativa del producto/workspace.

La Landing no depende de que la persona introduzca una situación para comprender la plataforma.

### 4.2 Portfolio Entry opcional

Portfolio Entry permanece disponible desde la Landing, pero es una experiencia pública opcional para
quien todavía necesita ordenar su:

- objetivo;
- necesidad;
- problema;
- oportunidad;
- iniciativa;
- solución;
- decisión.

Portfolio Entry es una puerta inteligente de entrada al producto. No representa todo Starteria ni
sustituye al workspace.

### 4.3 Conversiones directas

La Landing debe ofrecer dos caminos directos e independientes de Portfolio Entry:

- solicitar early access;
- agendar una demo de Starteria.

Los nombres y rutas productivas concretos de estos caminos quedan fuera de este ADR y requieren su
propio contrato/implementación posterior.

### 4.4 Funnel objetivo

```text
Ruta A
Landing → Solicitar early access

Ruta B
Landing → Agendar demo de Starteria

Ruta C
Landing → Portfolio Entry → Handoff → Continuation
                                  ├── Early access
                                  └── Demo Starteria
```

La Ruta C no convierte automáticamente el contexto provisional en una entidad Core. Early access y
demo son destinos de conversión/continuación, no sinónimos de canonicalización de negocio.

### 4.5 Workspace como destino conceptual

El modelo mental público es:

```text
Starteria
= plataforma que conecta estrategia/necesidades,
  iniciativas, evidencia, seguimiento y decisiones.

Portfolio Entry
= orientación opcional para encontrar el punto de partida.

Workspace Starteria
= lugar donde ese contexto se convierte en trabajo estructurado,
  trazable y gobernable.
```

La Landing puede representar esta relación de forma visual, pero la representación debe ser
ilustrativa y no debe presentarse como análisis real del visitante.

## 5. Why Portfolio Entry remains valuable

La explicación de plataforma no elimina la necesidad de una entrada guiada. Portfolio Entry sigue
siendo valioso porque:

- acepta lenguaje natural e incompleto;
- no exige conocer `StrategicFront`, `Challenge`, `Initiative` o `Step`;
- ayuda a detectar desde qué situación entra la persona;
- separa lo declarado, lo extraído, lo inferido y lo que falta aclarar;
- prepara una interpretación provisional y trazable;
- permite llegar al handoff con contexto sin convertirlo prematuramente en estructura canónica.

Su valor es orientar el punto de partida, no explicar por sí solo toda la plataforma ni reemplazar el
workspace.

## 6. Landing responsibilities

La Landing es responsable de:

- comprensión pública de Starteria;
- propuesta de valor y lenguaje de plataforma;
- relación visible entre necesidades/estrategia, iniciativas, evidencia, seguimiento y decisiones;
- representación conceptual del workspace;
- acceso directo a early access;
- acceso directo a demo;
- acceso opcional a Portfolio Entry;
- explicar que el Copilot ayuda a ordenar la entrada y no constituye el producto completo.

La Landing no es responsable de:

- ejecutar un análisis sobre el visitante sin acción explícita;
- crear objetos Core;
- declarar alineamiento, evidencia canónica, ownership o decisiones;
- reemplazar la revisión humana;
- activar Steps.

## 7. Portfolio Entry responsibilities

Portfolio Entry es responsable de:

- recibir una necesidad expresada en lenguaje natural;
- identificar intent y entry state según su contrato;
- extraer contexto declarado con procedencia;
- identificar ambigüedades, gaps y preguntas críticas;
- mantener la incertidumbre como incertidumbre;
- producir una interpretación provisional, estructurada y trazable;
- preparar y preservar el handoff actual;
- permitir que el usuario confirme o corrija su representación antes de una continuación gobernada.

`/public/start` permanece pre-Core.

Portfolio Entry no crea:

```text
Organization
StrategicFront
Challenge
Initiative
Step
Decision
```

Tampoco crea Evidence canónica, activa Step 0, declara alineamiento estratégico ni transforma una
inferencia de IA en una verdad confirmada.

## 8. Direct conversion paths

| Camino | Propósito | Frontera | Restricción |
|---|---|---|---|
| Landing → early access | expresar interés y permitir seguimiento comercial | conversión pública | no inicia Portfolio Entry ni crea workspace automáticamente |
| Landing → demo | solicitar conversación guiada sobre Starteria | conversión pública | no simula análisis ni exige contexto de negocio |
| Landing → Portfolio Entry | ordenar un punto de partida | entrada pre-Core | sólo produce interpretación provisional y handoff existente |
| Portfolio Entry → continuation → early access | convertir una sesión orientada en solicitud comercial | después del handoff | no canonicaliza el contexto |
| Portfolio Entry → continuation → demo | convertir una sesión orientada en solicitud de demo | después del handoff | no activa trabajo ni Steps |

Las rutas de early access y demo deberán definir posteriormente captura, consentimiento, estado,
destino y evidencia de conversión. Este ADR no inventa rutas productivas ni autoriza una integración
externa.

## 9. Route implications

Este ADR fija implicaciones de experiencia, no nombres ni cambios de rutas.

- `/` continúa siendo la Landing pública principal.
- `/public/start` continúa siendo la superficie directa de Portfolio Entry y permanece pre-Core.
- Portfolio Entry debe ser alcanzable desde Landing como opción explícita.
- Early access y demo deben ser alcanzables directamente desde Landing.
- El handoff actual permanece vigente y no se rediseña en este ADR.
- La continuación posterior al handoff debe mantener la separación entre conversión comercial y
  canonicalización de negocio.
- Ningún camino nuevo debe hacer que una visita pública llegue automáticamente a Step 0–4.

La definición de rutas concretas, controladores, servicios, payloads o integraciones queda para slices
de implementación autorizadas.

## 10. Canonical/Core guardrails

La decisión es compatible con Core v0.2 y conserva estos límites:

- la IA propone, organiza y orienta; las personas conservan autoridad organizacional;
- el chat/Copilot es un canal de interacción, no el registro oficial;
- los claims materiales requieren procedencia;
- estrategia y ejecución permanecen como capas diferentes;
- una preview o representación ilustrativa no es análisis real;
- early access y demo no crean autoridad de dominio;
- Portfolio Entry no crea `Organization`, `StrategicFront`, `Challenge`, `Initiative`, `Step` ni
  `Decision`;
- no se activa Step 0 ni se modifica la lógica de Step 0–4;
- no se modifica el Adaptive Cycle ni sus gates;
- confirmación de intención no equivale a confirmación organizacional;
- registro/autenticación no equivale a canonicalización de negocio.

## 11. Impact on ADR-019

ADR-019 no queda completamente obsoleto.

```text
ADR-019
PARTIALLY SUPERSEDED BY ADR-006
```

### Partes que permanecen vigentes

- Landing pública en `/`;
- Landing fuera del guard de autenticación;
- absorción del landing dentro de la aplicación `front/` como componente, no como app standalone;
- uso del mismo deploy/stack de la aplicación;
- existencia de `/public/start` como superficie interna de Portfolio Entry.

### Parte que deja de gobernar

La siguiente regla de ADR-019 queda superseded:

```text
Todos los CTAs del landing deben reemplazar el destino externo por navegación interna a
/public/start, haciendo del piloto/Portfolio Entry el destino general del landing.
```

Desde ADR-006, esa regla se reemplaza por:

```text
Landing → early access
Landing → demo
Landing → Portfolio Entry opcional
```

También queda superseded la interpretación de que Landing y Portfolio Entry forman una única puerta
mental de entrada. No se supersede la absorción técnica ni se ordena eliminar `/public/start`.

## 12. Impact on ADR-002

ADR-002 permanece vigente y sin modificación.

Su decisión sobre una sola pregunta user-facing por turno, identidad de respuesta, resolución de gaps
y convergencia aplica cuando una persona entra en Quick Clarification dentro de Portfolio Entry.

ADR-006 no cambia:

- cardinalidad de preguntas;
- `matchedQuestionIds`;
- `answered_gaps`;
- reglas de suficiencia;
- límites del contrato cognitivo de Portfolio Entry.

## 13. Impact on ADR-003

ADR-003 permanece vigente y sin modificación.

La Landing agrega caminos anteriores a la frontera de registro/continuación, pero no modifica sus
reglas:

```text
AUTHENTICATION != BUSINESS CANONICALIZATION
PUBLIC_ENTRY_CONTINUATION != PROJECT_CREATION
PUBLIC_ENTRY_CONTINUATION != STEPS_ENTRY
```

Cuando una sesión de Portfolio Entry continúe después del handoff, la selección de destino debe
seguir siendo explícita, versionada, autorizada y compatible con el perfil de continuación. Early
access y demo no pueden usarse para inferir un perfil Initiative ni para saltar el gobierno de
Portfolio.

## 14. Consequences

### Positivas

- Starteria puede entenderse como plataforma antes de pedir interacción.
- Portfolio Entry conserva su valor como orientación opcional y pre-Core.
- Early access y demo tienen caminos directos y legibles.
- El Copilot queda correctamente posicionado como puerta de entrada inteligente.
- La arquitectura separa comprensión, conversión y canonicalización.
- ADR-019 conserva sus decisiones técnicas válidas sin mantener un funnel único.

### Costes y riesgos

- Será necesario definir contratos de early access y demo antes de implementar sus destinos.
- Habrá que reconciliar el Experience Contract que actualmente llama a Portfolio Entry “Landing
  pública”.
- La UI deberá evitar dos CTAs primarias incompatibles; el Design System permite una acción primaria
  y una alternativa visible.
- Debe verificarse que ningún camino comercial herede accidentalmente la semántica de handoff o
  registro.
- La implementación actual puede seguir mostrando ambas funciones juntas hasta que exista una slice
  frontend autorizada; ese estado no cambia la decisión documental.

## 15. Alternatives considered

### A. Mantener Landing y Portfolio Entry como una sola experiencia

Rechazada. Mantiene el problema de comprensión, hace obligatorio de facto el diagnóstico y presenta
Copilot como producto.

### B. Convertir Landing en una página sólo comercial y retirar Portfolio Entry

Rechazada. Elimina una entrada de alto valor para usuarios que todavía no pueden expresar su contexto
en la ontología del producto.

### C. Hacer que toda entrada pase primero por Portfolio Entry y luego ofrecer early access/demo

Rechazada como default. Mantiene Portfolio Entry como gate comercial y contradice el requisito de
acceso directo a early access y demo.

### D. Separar Landing, conversiones directas y Portfolio Entry opcional

Seleccionada. Permite explicar Starteria, convertir directamente y conservar una orientación
inteligente para quien la necesita, sin modificar la frontera pre-Core.

## 16. No-regression constraints

- No modificar Core v0.2 mediante este ADR.
- No modificar Step 0–4, Adaptive Cycle, gates ni permisos.
- No crear `Organization`, `StrategicFront`, `Challenge`, `Initiative`, `Step` o `Decision` desde
  Landing, early access, demo, Copilot o Portfolio Entry.
- No modificar Portfolio Entry ni su lógica de clarificación en esta ejecución.
- No modificar el handoff, sus payloads, persistencia, revisión, confirmación o destinos.
- No modificar rutas productivas en esta ejecución.
- No convertir inferencias de IA en hechos confirmados.
- No presentar la representación del workspace como análisis real.
- No mezclar early access/demo con registro o continuación como si fueran la misma frontera.
- No marcar ADR-019 como completamente deprecated o superseded.
- Mantener ADR-002 y ADR-003 vigentes salvo que una futura evidencia demuestre un conflicto explícito.

## 17. Migration / implementation implications

Este ADR no implementa migración. Las slices posteriores propuestas son:

1. actualizar el Experience Contract de Landing / Platform Framing;
2. ajustar el alcance semántico del Portfolio Entry Contract sin reescribir su lógica;
3. definir contratos de early access y demo, incluidos consentimiento, estado y destino;
4. adaptar la arquitectura visual de Landing para desacoplar la explicación de la interacción de
   Portfolio Entry;
5. conservar `/public/start` y verificar su comportamiento sin cambios;
6. añadir tests de no-regresión para Portfolio Entry, handoff y destinos prohibidos;
7. ejecutar evidencia visual, accesibilidad, responsive y E2E de los tres caminos.

Cada slice requiere su propio alcance, `V2_CHANGE_GUARDRAIL_CHECK`, tests y evidencia. Ninguna de
estas implicaciones autoriza cambios de código por sí misma.

## 18. Status and supersession relationship

```text
STATUS: ACCEPTED
DECISION: SEPARATE LANDING / PORTFOLIO ENTRY / EARLY ACCESS / DEMO
IMPLEMENTATION AUTHORIZED: NO
RUNTIME CHANGED: NO
CORE CHANGED: NO
STEP_0_4_CHANGED: NO
HANDOFF_CHANGED: NO

ADR-019: PARTIALLY SUPERSEDED BY ADR-006
ADR-002: REMAINS VIGENT
ADR-003: REMAINS VIGENT
```

La aceptación de este ADR autorizaría la actualización de Experience Contract correspondiente como
siguiente decisión documental. No autoriza aún frontend, backend, rutas ni integración comercial.
