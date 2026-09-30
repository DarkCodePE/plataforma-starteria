# Portfolio Entry / Public Landing Acceptance Checklist

**Documento:** `PORTFOLIO_ENTRY_ACCEPTANCE_CHECKLIST_v0.1.md`
**Versión:** v0.1
**Estado:** EXPECTATIVAS DE ACEPTACIÓN DOCUMENTALES
**Autoridad:** subordinado a Core v0.2, ADR-006, ADR-002, ADR-003 y los Experience Contracts aplicables.

Este checklist complementa, no reemplaza, `docs/ai-harness/portfolio-entry/PORTFOLIO_ENTRY_CLARIFICATION_CONVERGENCE_ACCEPTANCE_v0.1.md`.
Los criterios específicos de cardinalidad, budget, identidad de respuesta y convergencia de Clarification
se mantienen en ese documento.

No autoriza frontend, backend, rutas runtime, APIs, persistencia, emails, calendar, analytics runtime,
Step 0–4 ni cambios en Core.

## A. Landing — product understanding

- [ ] La Landing explica Starteria sin exigir interacción con Portfolio Entry.
- [ ] Starteria se presenta como plataforma/sistema de trabajo, no como chatbot.
- [ ] Comunica conceptualmente: `estrategia / necesidad → iniciativas → evidencia / avance → decisiones`.
- [ ] Incluye una representación simple del producto o workspace.
- [ ] Toda preview está marcada como ilustrativa o ejemplo.
- [ ] Ningún dato ficticio se presenta como análisis real del visitante.
- [ ] La primera viewport comunica producto y beneficio antes que conversación.

## B. Direct conversion

- [ ] La Landing ofrece solicitar Early Access.
- [ ] La Landing ofrece agendar una Demo de Starteria.
- [ ] La Landing ofrece Portfolio Entry como orientación opcional.
- [ ] Portfolio Entry no es el único camino visible para acceder, evaluar o comprender Starteria.
- [ ] Las rutas se expresan semánticamente, sin congelar nombres técnicos de rutas.

## C. Portfolio Entry positioning

- [ ] Portfolio Entry se presenta como orientación opcional para ordenar el punto de partida.
- [ ] La experiencia puede comunicar conceptualmente “¿Todavía no tienes claro por dónde empezar?”.
- [ ] El input conceptual cubre “¿Qué necesitas conseguir, resolver o entender?”.
- [ ] El CTA conceptual cubre “Ayúdame a ordenar mi situación”.
- [ ] El wording exacto sigue experimental cuando así lo permite el Experience Contract.
- [ ] Se mantiene el microcopy de orientación sin registro cuando corresponda.

## D. Portfolio Entry experience — no regression

- [ ] Se preservan interpretación, clarification, reverse alignment y provenance.
- [ ] Se preserva el Handoff vigente y sus campos contractuales.
- [ ] Se preserva la frontera pre-Core y la no canonicalización.
- [ ] No se reconstruyen aquí los criterios específicos de Clarification; se verifica el checklist específico referido arriba.

## E. Handoff

- [ ] El usuario puede identificar en qué estado se encuentra.
- [ ] Puede identificar qué parece más útil hacer a continuación.
- [ ] Puede identificar qué información aumentaría la calidad de una decisión.
- [ ] Puede entender cómo Starteria puede convertir la situación en trabajo gestionable.
- [ ] La aceptación evalúa la lectura, estructura y utilidad del Handoff; no exige una paráfrasis extensa del input.
- [ ] El Handoff termina habilitando una Continuation posible.

## F. Continuation

- [ ] La Continuation ofrece conceptualmente Early Access.
- [ ] La Continuation ofrece conceptualmente Demo Starteria.
- [ ] Demo se entiende inequívocamente como demo del producto y su aplicación potencial.
- [ ] Demo no se presenta como una sesión para enseñar únicamente el resultado de Portfolio Entry.
- [ ] Las dos opciones reutilizan el contexto existente sin crear un segundo journey.

## G. Early Access

Referencia: `docs/experience/commercial/EARLY_ACCESS_EXPERIENCE_CONTRACT_v0.1.md`.

- [ ] Expresa interés en probar Starteria.
- [ ] No promete acceso automático.
- [ ] Solicita únicamente información mínima.
- [ ] Muestra confirmación después del envío.
- [ ] Comunica qué puede ocurrir después.
- [ ] Reutiliza contexto de Portfolio Entry cuando existe.
- [ ] No crea objetos Core ni activa Step 0.

## H. Demo

Referencia: `docs/experience/commercial/DEMO_REQUEST_EXPERIENCE_CONTRACT_v0.1.md`.

- [ ] Explica que el usuario conocerá Starteria.
- [ ] Contextualiza su posible aplicación al equipo u organización.
- [ ] No equivale a un piloto.
- [ ] No equivale a revisar únicamente Portfolio Entry.
- [ ] Reutiliza contexto existente y no repite información conocida.
- [ ] No crea objetos Core ni activa Step 0.

## I. Route / funnel semantics

```text
Landing
├── Early Access
├── Demo
└── Portfolio Entry
      ↓
   Clarification
      ↓
   Handoff
      ↓
   Continuation
      ├── Early Access
      └── Demo
```

- [ ] No se afirman rutas técnicas concretas que los contratos no hayan definido.
- [ ] Early Access y Demo permanecen separados de canonicalización de negocio.

## J. No regression global

- [ ] No se crea `Organization`.
- [ ] No se crea `StrategicFront`.
- [ ] No se crea `Challenge`.
- [ ] No se crea `Initiative`.
- [ ] No se crea `Step`.
- [ ] No se crea `Decision`.
- [ ] No se activa Step 0.
- [ ] No se amplía la autoridad de IA.
- [ ] No existe canonicalización silenciosa.
- [ ] No cambia el Adaptive Core.
- [ ] No cambia la autoridad humana ni los límites de ADR-002/ADR-003.

## Evidencia requerida para una futura implementación

- [ ] Revisión visual de Landing, Portfolio Entry, Handoff y Continuation.
- [ ] Evidencia de que las tres opciones son visibles sin que Portfolio Entry sea un gate.
- [ ] Evidencia de confirmación y siguiente paso para Early Access.
- [ ] Evidencia de demo como producto, no como resultado de análisis.
- [ ] Regression de Portfolio Entry, Clarification y Handoff.
- [ ] Validación responsive y accesible.
