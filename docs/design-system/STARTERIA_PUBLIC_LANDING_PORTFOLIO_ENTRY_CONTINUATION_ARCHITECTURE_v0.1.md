# Starteria — Public Landing, Portfolio Entry & Continuation UX Architecture

**Documento:** `STARTERIA_PUBLIC_LANDING_PORTFOLIO_ENTRY_CONTINUATION_ARCHITECTURE_v0.1.md`
**Versión:** v0.1
**Estado:** PROPUESTA DOCUMENTAL PARA LANDING UX / DESIGN SYSTEM REVIEW
**Tipo:** UX Architecture / Design System adaptation
**Autoridad:** subordinado a Core v0.2, ADR-006, Portfolio Entry Experience Contract y los contratos aceptados de Early Access y Demo.

Este documento adapta las anatomías existentes de `STARTERIA_E2E_VISUAL_EXPERIENCE_ARCHITECTURE_v0.1.md`,
`STARTERIA_PAGE_ANATOMY_SYSTEM_v0.1.md` y `STARTERIA_COPILOT_INTERACTION_SYSTEM_v0.1.md`.
No reemplaza sus foundations, primitives, estados semánticos, accesibilidad ni patrones reutilizables.
No autoriza frontend, backend, rutas runtime, APIs, persistencia, emails, calendar, analytics runtime,
Step 0–4 ni cambios en Core.

## 1. Boundary de experiencia

```text
Landing
├── Early Access
├── Demo Starteria
└── Portfolio Entry
      ↓
   Clarification
      ↓
   Handoff
      ↓
   Continuation
      ├── Early Access
      └── Demo Starteria
```

Landing explica la plataforma. Portfolio Entry orienta de forma opcional. Early Access y Demo son dos
formas de continuar, no dos productos separados ni dos rutas de canonicalización.

## 2. Landing pública

### Section 1 — Hero

Objetivo: explicar qué es Starteria y su beneficio principal antes de pedir conversación.

Headline conceptual:

> Convierte estrategia e iniciativas en decisiones sustentadas.

Supporting statement conceptual:

> Starteria ayuda a estructurar qué quieres mover, convertirlo en iniciativas accionables, seguir
> evidencia y bloqueos, y preparar mejores decisiones.

Acciones visibles:

- Solicitar Early Access.
- Agendar una Demo de Starteria.
- Acceder opcionalmente a Portfolio Entry.

La jerarquía primaria/secundaria queda sujeta a UX testing. No se debe presentar una caja conversacional
como única acción dominante.

### Section 2 — How Starteria works

Debe ser escaneable:

```text
ESTRATEGIA / NECESIDAD
        → INICIATIVAS
        → EVIDENCIA + AVANCE
        → DECISIONES
```

### Section 3 — Product preview

Puede mostrar una preview simple del workspace:

```text
Prioridad
├─ Iniciativa A · avanzando
├─ Iniciativa B · bloqueada
└─ Iniciativa C · lista para decisión

Alertas: bloqueo · gap de evidencia · decisión requerida
```

La preview debe estar marcada como ejemplo/ilustración y no puede presentarse como análisis real del
visitante.

### Section 4 — Optional Portfolio Entry

Framing conceptual:

> ¿Todavía no tienes claro por dónde empezar?

Debe diferenciar visualmente:

```text
Starteria product
vs
Starteria orientation / co-process
```

La orientación conserva su input, ejemplos compatibles, CTA y microcopy sin registro definidos por su
Experience Contract. Puede incluir un acceso discreto a:

```text
¿Ya sabes cómo quieres continuar?
  → Early Access
  → Demo Starteria
```

Portfolio Entry nunca debe parecer un gate para comprender Starteria.

### Section 5 — Trust / value support

Reutilizar solo bloques ya existentes que aporten claridad. No inventar social proof, clientes, métricas
ni claims sin evidencia.

## 3. Continuation pattern compartido

Early Access y Demo usan un patrón visual común de continuación, con la misma jerarquía, tokens y estados.

### Early Access card

- intención: “Quiero seguir probando”;
- beneficio: participar como early user y probar Starteria con casos reales;
- CTA semántico: “Solicitar early access”.

### Demo card

- intención: “Quiero evaluarlo para mi equipo”;
- beneficio: conocer cómo Starteria puede aplicarse a la gestión de iniciativas y decisiones;
- CTA semántico: “Agendar una demo de Starteria”.

Evitar “¿Quieres verlo con tu equipo?”, porque puede interpretarse como compartir únicamente el resultado
de Portfolio Entry.

La Demo es una demo de Starteria completo. No es un piloto ni una revisión aislada del análisis de entrada.
Pilot queda como decisión comercial posterior.

## 4. Portfolio Entry, Handoff y auth/continuation

Se conservan:

- la anatomía conversacional de Portfolio Entry;
- Clarification estructurado y no infinito;
- distinción visual entre IA sugerida y estado humano;
- Handoff estructurado en lugar de hilo completo de chat;
- continuidad con contexto y procedencia.

El Handoff debe ayudar a identificar estado, siguiente abordaje, información decisiva faltante y cómo
Starteria convierte la situación en trabajo gestionable. No se acepta una simple paráfrasis extensa del
input como sustituto.

Registro/autenticación mantiene identidad y continuidad provisional. No concede autoridad de negocio ni
crea workspace, Organization, Initiative o Step.

## 5. Responsive e information hierarchy

- La primera viewport comunica producto antes que chat.
- Las tres rutas permanecen identificables en mobile.
- Portfolio Entry aparece como alternativa, nunca como gate.
- La composición mobile mantiene una acción primaria clara sin ocultar Early Access, Demo o Portfolio Entry.
- La Landing no se convierte en dashboard operativo.
- La preview se simplifica o apila sin perder su etiqueta de ejemplo.
- Handoff puede usar dos zonas en desktop y apilarse en mobile.

## 6. UX writing principles

1. Product first.
2. Copilot as optional orientation.
3. Benefit before feature.
4. Short blocks.
5. Avoid internal taxonomy.
6. Avoid “integration” cuando se quiere decir aplicación al contexto.
7. Demo significa demo de Starteria.
8. Early Access significa manifestación de interés.
9. No claims de producto no soportados.
10. No párrafos de paráfrasis extensa en Handoff.

## 7. Conservado, adaptado y eliminado

### Conservado

- Landing editorial/premium y producto interno sobrio/estructurado.
- Copilot implícito en Landing y contextual en Portfolio Entry.
- Una acción primaria dominante por superficie.
- Distinción visual entre sugerencia IA y estado humano.
- Handoff estructurado.
- Responsive basado en jerarquía y accesibilidad, no en pixel-perfect.

### Adaptado

- Hero para explicar plataforma antes de conversación.
- Navegación para exponer Early Access, Demo y Portfolio Entry.
- Preview del workspace como ejemplo explícito.
- Continuation para diferenciar Early Access y Demo.
- Relación visual entre Landing, Portfolio Entry y Handoff.

### Deja de gobernar como framing por defecto

- Landing → Portfolio Entry como único funnel visible.
- CTA de análisis como acción general de Landing.
- Portfolio Entry presentado como producto completo.
- Demo interpretada como exposición del resultado de Portfolio Entry.

## 8. Elementos pendientes de UX testing

- Jerarquía primaria/secundaria entre Early Access y Demo.
- Ubicación y peso visual del acceso opcional a Portfolio Entry.
- Comprensión de la preview como ilustrativa.
- Comprensión de Demo como demo de Starteria completo.
- Claridad de Early Access como interés y no acceso concedido.
- Orden y densidad de secciones en mobile.
- Transición visual Landing → Portfolio Entry → Handoff → Continuation.

## 9. No-regression visual

- No convertir Landing en dashboard.
- No hacer del Copilot el producto completo.
- No ocultar estados críticos únicamente dentro de Copilot.
- No cambiar la semántica de Core, Steps, Handoff ni autoridad IA.
- No presentar datos ficticios como datos del usuario.
