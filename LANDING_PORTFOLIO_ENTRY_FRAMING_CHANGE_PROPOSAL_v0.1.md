# LANDING_PORTFOLIO_ENTRY_FRAMING_CHANGE_PROPOSAL_v0.1

**Estado:** propuesta de auditoría y contract shaping; no autoriza implementación
**Fecha:** 2026-09-30
**Branch auditada:** `feat/KAN-XX-landing-entry-framing`
**Alcance:** landing pública, Portfolio Entry y framing de entrada

## 1. Current state

La autoridad vigente establece una distinción que hoy no está reflejada completamente en la
experiencia pública:

- Starteria es un sistema de espacios de trabajo estructurados, asistencia de IA, gobernanza de
  evidencia y lógica de decisión de portafolio. No es sólo un formulario, un gestor de proyectos ni
  un chatbot (`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, identidad y tesis Core).
- El Experience Contract activo de Portfolio Entry v0.1 lo define como la primera experiencia
  pública para que una persona empiece desde su realidad y produzca una interpretación provisional,
  estructurada y trazable.
- Ese contrato incluye actualmente “landing pública” dentro de su alcance y usa como CTA
  `Analizar mi situación`.
- ADR-019 decidió absorber el landing en `front/`, hacer de `/` la landing pública para todos y
  rutear sus CTAs hacia `/public/start`, el piloto interno de Portfolio Entry.
- En el checkout actual, `LandingPage` presenta explicación de plataforma, pero también monta
  `PortfolioEntryExperience` en la misma superficie. `/public/start` vuelve a presentar la
  experiencia de entrada conversacional.

La consecuencia es una sola superficie mental: entender Starteria y comenzar un diagnóstico
conversacional aparecen como el mismo acto. Portfolio Entry queda implícitamente como camino
principal y el producto se explica desde su puerta de entrada.

La lectura de V2 sigue siendo documental y no certifica globalmente el runtime. El Core v0.2 es la
autoridad factual “por validar”; el contrato de Portfolio Entry v0.1 es el Experience Contract
activo aprobado para auditoría e implementación.

## 2. Problem observed

La absorción resolvió correctamente un problema histórico de navegación: evitar que `/` rebotara a
login y reunir el landing y el piloto en un solo deploy. Pero dejó sin separar tres jobs distintos:

1. comprender qué es Starteria y por qué importa;
2. decidir si solicitar acceso o hablar con el equipo;
3. ordenar una situación concreta mediante Portfolio Entry.

Esto produce cuatro riesgos de producto:

- un visitante puede interpretar que debe escribir una necesidad antes de comprender la plataforma;
- `Portfolio Entry` parece ser el producto completo, en vez de una entrada opcional asistida;
- Copilot/IA puede parecer el centro del producto, aunque sólo debe ayudar a entrar y ordenar;
- las conversiones comerciales (early access/demo) quedan subordinadas a un flujo cognitivo que no
  todos los visitantes necesitan.

## 3. New product decision

Starteria tendrá una landing pública de explicación y conversión que precede y contextualiza las
experiencias de producto.

La landing debe comunicar brevemente:

- qué es Starteria;
- qué beneficio genera;
- cómo conecta estrategia/necesidades, iniciativas, evidencia y decisiones;
- una representación simple del producto/workspace.

Debe ofrecer dos caminos directos, diferenciados de Portfolio Entry:

- solicitar early access;
- agendar una demo de Starteria.

Portfolio Entry queda como una experiencia pública opcional para quien todavía necesita ordenar un
objetivo, necesidad, oportunidad, problema, iniciativa o decisión. El Copilot se presenta como una
puerta inteligente de entrada, no como el producto completo.

La decisión no cambia el Core, no cambia Steps 0–4 y no convierte una entrada pública en autoridad
canónica.

## 4. Target mental model

El modelo mental objetivo es:

```text
Starteria = workspace para conectar
necesidades / estrategia → iniciativas → evidencia → decisiones

Landing pública
  ├─ Solicitar early access
  ├─ Agendar demo
  └─ Necesito ordenar mi situación → Portfolio Entry / Copilot
                                      → interpretación provisional
                                      → handoff existente
```

El visitante debe poder entender el producto sin interactuar con el Copilot. Si entra por Copilot,
debe entender que está pidiendo ayuda para ordenar su punto de partida, no creando el workspace ni
ejecutando la plataforma completa.

## 5. Landing role

La landing es la capa pública de posicionamiento, comprensión y conversión.

Su responsabilidad es explicar el sistema y mostrar una representación ilustrativa del workspace,
sin presentar datos reales del visitante ni prometer que el análisis ya ocurrió. Puede reutilizar el
marco narrativo del Core y de CRAZY 8s:

```text
alinear → detectar → seguir → decidir
```

Ese marco debe seguir comunicando capacidades del producto, no resultados ejecutados sobre el
visitante.

La landing puede mostrar una vista simple de relaciones entre prioridad/necesidad, iniciativa,
evidencia y decisión. La representación debe ser conceptual/ilustrativa y no crear entidades ni
estado.

## 6. Portfolio Entry role

Portfolio Entry conserva su contrato y su propósito pre-Core:

- comenzar desde lenguaje natural;
- detectar intención y estado de entrada;
- extraer sólo contexto declarado con procedencia;
- identificar ambigüedades y preguntas críticas;
- producir una interpretación provisional y trazable;
- preparar el handoff ya definido.

Deja de ser “la landing” en sentido de framing de producto. Pasa a ser una experiencia pública
opcional, accesible desde la landing y también preservable como superficie directa de entrada.

No crea:

```text
Organization
StrategicFront
Challenge
Initiative
Step
Decision
```

Tampoco crea Evidence canónica, activa Step 0, declara alineamiento ni transforma inferencias de IA
en hechos confirmados.

## 7. Direct conversion paths

Los caminos públicos deben ser conceptualmente independientes:

| Camino | Job | Resultado esperado | No debe hacer |
|---|---|---|---|
| Solicitar early access | expresar interés y permitir contacto | lead/solicitud comercial con estado explícito | iniciar Portfolio Entry ni crear workspace automáticamente |
| Agendar demo | pedir una conversación guiada sobre Starteria | solicitud de agenda/demo | simular un análisis o exigir una entrada de negocio |
| Ordenar mi situación | obtener una primera lectura de una necesidad | sesión provisional y posible handoff | crear objetos Core o llevar directamente a Steps |

La landing debe tener una CTA primaria coherente con la estrategia de conversión elegida y una
alternativa visible. La regla del Design System de una sola CTA primaria se conserva; no implica
ocultar el segundo camino, sino jerarquizarlo.

## 8. Relationship with existing handoff

El handoff existente se mantiene como frontera de Portfolio Entry. El cambio de framing no lo
reconstruye, no cambia su payload ni modifica su destino.

La secuencia futura permitida es:

```text
Landing
  → Portfolio Entry opcional
  → interpretación provisional
  → confirmación/corrección humana cuando corresponda
  → handoff existente
  → registro/continuación según el perfil y ADR-003
```

El camino early access/demo termina en una conversión comercial y no debe entrar en el handoff de
Portfolio Entry salvo que el usuario elija explícitamente ordenar su situación.

ADR-003 sigue siendo relevante después de Portfolio Entry: registro/autenticación debe conservar
continuidad, no canonicalizar automáticamente, y no convertir una entrada pública en Project/Steps.

## 9. Existing ADR impact

### ADR-019 — impacto: supersede parcial

ADR-019 es la regla que hizo que Landing y Portfolio Entry quedaran absorbidos en una sola
experiencia. En particular, decidió:

- `/` como landing pública;
- el landing como componente dentro de `front/`;
- CTAs del landing apuntando al piloto interno `/public/start`.

La nueva decisión conserva los dos primeros puntos como decisiones técnicas/históricas de
integración, pero supersede parcialmente el tercero como regla de experiencia: no todos los CTAs de
la landing deben llevar a Portfolio Entry. Debe añadirse la separación entre comprensión de
plataforma, conversión comercial y entrada opcional.

```text
CONFLICT
Contract: backend/docs/adr/ADR-019-public-landing-absorbed.md, Decision 5
Requirement: la landing debe permitir early access/demo y Portfolio Entry debe ser opcional
Current document/code: los CTAs del landing se dirigen al piloto interno /public/start y la
LandingPage monta PortfolioEntryExperience
Observed mismatch: el landing y Portfolio Entry comparten la misma función de entrada
Risk: Portfolio Entry parece obligatorio y Copilot parece ser el producto
Recommended treatment: UPDATE / SUPERSEDE PARCIALMENTE
Requires ADR: yes
```

### ADR-002 — impacto: no contradice

ADR-002 gobierna cardinalidad y convergencia de preguntas dentro de Quick Clarification. No decide
el rol de la landing ni la conversión comercial. Se mantiene sin cambios.

### ADR-003 — impacto: compatible, con frontera posterior

ADR-003 gobierna registro y continuación después de Public Entry. La nueva landing agrega caminos
anteriores a esa frontera, pero no cambia sus invariantes:

```text
AUTHENTICATION != BUSINESS CANONICALIZATION
PUBLIC_ENTRY_CONTINUATION != PROJECT_CREATION
PUBLIC_ENTRY_CONTINUATION != STEPS_ENTRY
```

Debe verificarse que early access/demo no se mezclen con registro/continuación ni creen autoridad.

### Core v0.2 — impacto: compatible

La decisión refuerza la tesis Core y `INV-03`: la IA propone/organiza, pero no decide ni crea
autoridad. No modifica invariantes ni Step 0–4.

## 10. Contract impact

Se requiere separar dos contratos de experiencia:

1. un contrato de Landing pública / Platform Framing, responsable de comprensión y conversión;
2. el contrato activo de Portfolio Entry, reducido semánticamente a la entrada opcional y su
   interpretación provisional.

La actualización del contrato de Portfolio Entry debe retirar la equivalencia conceptual
`Portfolio Entry = Landing pública`, pero conservar sus reglas cognitivas, alcance pre-Core, CTA de
análisis, handoff y restricciones.

El nuevo contrato de landing debe definir como mínimo:

- audiencia y job de comprensión;
- propuesta de valor y lenguaje público;
- modelo visual mínimo del workspace;
- relación no jerárquica entre early access, demo y Portfolio Entry;
- Copilot como asistencia de entrada;
- límites de claims, preview y autoridad;
- métricas/criterios de éxito de comprensión y conversión;
- accesibilidad y responsive conforme al Design System.

No basta con cambiar copy: el boundary entre landing y Portfolio Entry es una decisión de producto.

## 11. KEEP / ADAPT / NEW / REMOVE matrix

| Área | Disposición | Tratamiento |
|---|---|---|
| Core v0.2 e invariantes | KEEP | No cambiar identidad, tesis, autoridad humana, procedencia ni Steps 0–4. |
| Portfolio Entry Logic Contract v0.1 | ADAPT | Quitar su rol de landing general; conservar entrada natural, interpretación provisional, clarificación y handoff. |
| Portfolio Entry runtime/handoff | KEEP | No reconstruir ni cambiar lógica, payload, persistencia provisional o destinos protegidos en este slice. |
| Landing `/` como superficie pública | KEEP / ADAPT | Mantenerla pública; separar explicación de plataforma de la interacción opcional. |
| `LandingPage` que embebe `PortfolioEntryExperience` | ADAPT | Posteriormente desacoplar el embedding y enlazar a Portfolio Entry como camino explícito. |
| CTA único hacia `/public/start` | REMOVE como regla general | Sustituir por jerarquía de early access/demo y entrada opcional. La ruta existente no se elimina en este slice. |
| `/public/start` | KEEP | Continúa siendo la superficie directa de Portfolio Entry; no se modifica aquí. |
| Copilot como puerta de entrada | ADAPT | Explicar que ayuda a ordenar; no presentarlo como sustituto del workspace ni del sistema. |
| Modelo visual prioridad → reto → iniciativa → evidencia → decisión | ADAPT | Mantenerlo como representación conceptual; rotularlo como ilustrativo y compatible con pre-Core. |
| Early access | NEW | Camino de conversión y contrato de captura/estado, sin crear autoridad de dominio. |
| Demo de Starteria | NEW | Camino de conversión/agenda, separado de análisis público. |
| ADR-019 | ADAPT / SUPERSEDE PARCIALMENTE | Mantener absorción técnica de la superficie; actualizar la decisión de CTAs y roles. |
| ADR-002 | KEEP | Sin impacto funcional. |
| ADR-003 | KEEP / VERIFY | Mantener la frontera de registro y continuación; auditar que los nuevos caminos no la atraviesen indebidamente. |
| CRAZY 8s E2E base | ADAPT | Separar Landing/primer valor de Portfolio Entry opcional y mantener la cadena estrategia/iniciativas/evidencia/decisión. |
| Design System | KEEP / ADAPT | Reusar foundations/patterns; tratar copy, orden de secciones y marketing visuals como capa experimental controlada. |
| Step 0–4 | KEEP | Fuera de alcance y sin cambios. |
| Organización/Frente/Reto/Iniciativa/Step/Decisión | KEEP AS PROHIBITED | No crear durante landing, early access, demo ni Portfolio Entry. |

## 12. ADR required: yes/no + rationale

**Sí: requiere un nuevo ADR de producto, o una revisión formal de ADR-019 con trazabilidad equivalente.**

Rationale:

- cambia la función estable de la superficie pública `/`;
- cambia la relación de autoridad/entrada entre Landing y Portfolio Entry;
- supersede parcialmente una decisión aceptada de ADR-019;
- introduce dos caminos de conversión nuevos con límites distintos;
- no es sólo una variante visual ni una modificación de copy.

El nuevo ADR debe declarar explícitamente qué partes de ADR-019 quedan vigentes y cuáles quedan
superseded. No necesita modificar Core, ADR-002 ni ADR-003 salvo para agregar referencias y límites.

## 13. Documents to update

Después de aprobación humana del ADR/decisión, actualizar en el mismo paquete de reconciliación:

1. `backend/docs/adr/ADR-019-public-landing-absorbed.md` — estado y decisión de CTAs/roles.
2. Un nuevo Experience Contract de Landing / Platform Framing, o el contrato de landing que la
   autoridad apruebe como único nombre canónico.
3. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` — sólo para separar
   “landing pública” de “Portfolio Entry opcional”, sin reescribir su lógica.
4. `doc/STARTERIA_CRAZY8S_E2E_BASE_LOGIC_v0.1.md` — aclarar la secuencia Landing → Entry opcional.
5. `docs/design-system/STARTERIA_DESIGN_SYSTEM_CONTRACT_v0.1.md` — sólo si se fijan nuevos patrones
   de conversión; copy/orden/marketing visual pueden quedar en la capa experimental.
6. `STARTERIA_V2_MANIFEST.md` — registrar el nuevo slice y separar sus estados de lógica,
   implementación, visual y evidencia.
7. `CURRENT_STATE.md` — registrar el cambio de framing y mantener explícito que no certifica runtime
   ni autoriza implementación por sí solo.
8. `docs/STARTERIA_AUTHORITY.md` — incorporar el contrato nuevo y su lugar en la jerarquía, si se
   aprueba.

No se deben editar esos documentos como parte de esta ejecución de audit + proposal only.

## 14. Proposed implementation slices

Las siguientes slices son una propuesta posterior y requieren aprobación/planificación propia:

1. **Product decision / ADR:** aprobar el nuevo boundary y resolver la supersesión parcial de
   ADR-019.
2. **Experience contract reconciliation:** crear/aprobar Landing Platform Framing y ajustar el
   alcance de Portfolio Entry.
3. **Landing information architecture:** separar explicación de plataforma, representación de
   workspace, early access, demo y entrada opcional. Sin tocar `/public/start`.
4. **Conversion contracts:** definir captura, estado, consentimiento, destino y evidencia de early
   access/demo; decidir si requieren backend o integración externa antes de implementar.
5. **Frontend landing adaptation:** desacoplar el embedding actual de Portfolio Entry, conservar el
   enlace directo y añadir los dos caminos de conversión.
6. **Portfolio Entry regression verification:** probar que la entrada directa, clarificación,
   handoff y destinos prohibidos no cambian.
7. **E2E/visual evidence:** verificar comprensión de plataforma, acceso directo a los tres caminos,
   responsive, accesibilidad y no-regresión de Portfolio Entry.

No se propone en este documento cambiar backend, rutas, contratos de Step 0–4, persistencia Core ni
la lógica del handoff.

## 15. No-regression constraints

- No modificar Step 0–4, Adaptive Cycle ni sus gates.
- No crear `Organization`, `StrategicFront`, `Challenge`, `Initiative`, `Step` o `Decision` desde
  landing, early access, demo, Copilot o Portfolio Entry.
- Mantener Portfolio Entry como interpretación provisional y pre-Core.
- Mantener la IA/Copilot como propuesta, organización y orientación; nunca como autoridad humana.
- No declarar alineamiento, evidencia canónica, ownership, aprobación o decisión por inferencia.
- No reconstruir el handoff ni alterar sus payloads, revisión, confirmación o destinos.
- No convertir registro en canonicalización de negocio.
- No mezclar early access/demo con la continuación de Portfolio Entry sin una decisión explícita.
- No eliminar `/public/start` ni sus rutas en esta slice.
- No presentar la representación del workspace como análisis real del visitante.
- No alterar la semántica de ADR-002 sobre una pregunta activa por turno.
- No tratar el código actual como autoridad si contradice el contrato aprobado.
- Toda implementación posterior debe tener guardrail check, tests primero, evidencia y cierre V2.

## Resultado de esta auditoría

La decisión es coherente con Core v0.2 y con ADR-002/ADR-003, pero **supersede parcialmente
ADR-019** y requiere un ADR nuevo o una revisión formal equivalente antes de implementar. El cambio
principal es de framing y boundary de experiencia: Landing explica y convierte; Portfolio Entry
ordena opcionalmente una situación; el handoff existente permanece intacto.
