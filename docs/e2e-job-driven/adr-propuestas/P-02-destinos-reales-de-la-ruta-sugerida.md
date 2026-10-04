# P-02 — Destinos reales de la ruta sugerida en Portfolio Entry

**Estado:** Propuesto · 2026-10-04 · requiere decisión de producto · CONFLICT abierto

## Contexto

El doc E2E v0.2 §3/§5 pide que la entrada derive a destinos según el Job: Portfolio Setup, análisis
de portfolio, contexto de organización, iniciativa, más exploración o **no activar trabajo todavía**,
y menciona patrones context-first, challenge-first e independent.

Choca con dos contratos activos:
- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1` §10 fija los Entry States y §22.1 las rutas públicas
  (Early Access / Demo).
- `PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1` §4: ni `starteria_path` ni el intent tienen
  autoridad para elegir destino; lo fija el servidor.

## Lo implementado (PR #129)

Una **ruta sugerida de presentación** (`front/src/features/portfolio-entry/public/suggestedRoute.ts`)
derivada de campos que el handoff ya trae. No agrega destinos, entry states ni campos al handoff, no
cambia la continuidad ni el CTA, y no toca los 32 casos del AI Harness.

## Opciones

| Opción | Qué implica |
|---|---|
| A. Mantener orientación (recomendada como paso 1) | Nada más que cambiar. La ruta informa; el destino sigue siendo el del contrato. |
| B. "No activar todavía" como desenlace real | Nuevo `handoff_status` o desenlace sin continuación: cambio de schema versionado + casos nuevos del harness. |
| C. Destinos por Job decididos por el servidor | El servidor elige destino con una regla explícita y versionada (no el LLM): extensión de POST_ENTRY §4 + ADR + casos. |
| D. Nuevos Entry States (context/challenge-first, independent) | Cambia `PORTFOLIO_ENTRY_LOGIC_CONTRACT` §10 y la taxonomía del agente. |

## Decisión propuesta

Adoptar **A** ahora y evaluar **B** después de medir cuántas lecturas reales caen en `not_now`. C y
D sólo con un caso de uso que A no cubra.
