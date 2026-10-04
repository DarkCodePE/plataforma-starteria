# Cobertura E2E Job-Driven

Mide el producto contra `doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md` (estado del doc:
*propuesto para contraste y validación*; no figura en `doc/STARTERIA_AUTHORITY.md`). Los cinco
escenarios A–E son fixtures representativos (§2), no cinco entradas canónicas.

```bash
cd front && npm run test:e2e:job-driven
```

Un test `[Gn]` es un **gap abierto**: corre con `test.fail()` (`e2e/support/gap.ts`), así que la suite
queda verde mientras el gap exista. Cuando el producto lo cumple, Playwright lo reporta como
"Expected to fail, but passed": ahí se cambia `gapTest` por `test`, se actualiza esta tabla y el
test queda como regresión.

## Por sección del doc

| § | Qué pide | Test | Estado |
|---|---|---|---|
| §5 | Texto libre → interpretación → qué entendimos → decisión a habilitar → qué falta | `entry-a` · texto libre… | ✅ |
| §5 | Resultado posible: "todavía no activar trabajo" | `entry-a` · la ruta sugerida puede ser… | ✅ (orientación; ver CONFLICT) |
| §3, §5 | Ruta sugerida con destinos según Job (portfolio setup, análisis, explorar, no activar) | `entry-a` · la lectura muestra una ruta sugerida… | ✅ (orientación; ver CONFLICT) |
| §1, §25 | La entrada pública no pide elegir objetos de dominio | `entry-a` · texto libre… | ✅ |
| §24–§25 | `/portfolio/iniciar` empieza por el Job, no por "¿Cómo quieres iniciar?" | `entry-b` · /portfolio/iniciar… | ✅ |
| §6 | Portfolio Home da una lectura | `entry-b` · Portfolio Home… | ✅ (solo carga; la lectura completa es G7) |
| §7 | Frente con resultado, KPI, baseline, target, horizonte | `entry-b` · un Frente guarda… | ✅ |
| §7 | Frente con restricciones (Core §13) | `entry-b` · el Frente guarda restricciones… | ✅ |
| §7 | La pantalla de Frentes pregunta "¿qué resultado quiere mover?" | `entry-b` · la pantalla de Frentes… | ✅ |
| §8–§11, §26 | Copilot propone partir un Frente en Retos, explica, AI_SUGGESTED/UNREVIEWED, no crea | `entry-b` · el Copilot propone… y en la UI, el lead revisa… | ✅ |
| §10 | "No parece necesario crear otro Reto" | `entry-b` · el Copilot puede decir… | ✅ |
| §13 | Reto con estado de cobertura | `entry-b` · un Reto tiene… | ✅ |
| §13 | Lectura de cobertura del Reto como conjunto | `entry-b` · lectura de cobertura… | ✅ |
| §4, §24 | Ver y reasignar capacidad | `entry-b` · [G13] | GAP G13 |
| §14 | Reconstrucción + gating retroactivo | `entry-c` · [G11] | GAP G11 |
| §14 | "Importar iniciativas existentes" disponible | `entry-c` · [G11] | GAP G11 |
| §15 | El encargo muestra qué se quiere mover y por qué | `entry-d` · el participante ve… | ✅ |
| §15 | …y qué se sabe, qué está abierto, restricciones, decisión esperada (Core §14.1) | `entry-d` · el encargo muestra… | ✅ |
| §17 | Step 0–4 → Decision Package → la decisión sube al portfolio | `entry-d` · el ciclo completo… | ✅ |
| §18 | Mission Review; Start no abre Step 0 | `entry-d` · Mission Review… | ✅ |
| §19 | Steps como preguntas de progreso | `entry-d` · los Steps… | ✅ |
| §21 | Decision Brief: decisión, qué hicimos, qué ocurrió, aprendizajes, riesgos, qué no podemos afirmar, siguiente paso | `entry-d` · el Decision Brief trae… | ✅ |
| §21 | …y alternativas, qué podemos sostener | `entry-d` · el Decision Brief incluye… | ✅ |
| §22 | Continuidad: pivotear, buscar capacidad, benefit tracking (Core §26) | `entry-d` · la continuidad admite… | ✅ |
| §23 | La decisión vuelve al Reto, Frente y Portfolio, con aprendizaje | `entry-d` · [G8] | GAP G8 |
| §16 | Iniciativa independiente sin inventar Frente ni Reto | `entry-e` · se puede crear… | ✅ |
| §16 | Contexto de Aplicación | `entry-e` · la iniciativa independiente construye… | ✅ |
| §20 | Copilot: Orientarme / Trabajar conmigo / Desbloquearme | `entry-e` · [G12] | GAP G12 |

## Gaps abiertos

Cerrados: G1 y G2 (Ola 1); G3, G4 y G5 (Ola 2); G6 y G7 (Ola 3); G9 y G10 (Ola 5).

| GAP | Qué | Ola |
|---|---|---|
| G8 | Retorno de la decisión al portfolio | 4 |
| G11 | Reconstrucción + gating retroactivo | 6 |
| G12 | Modos del Copilot | 6 |
| G13 | Capacidad (puede requerir ADR de producto) | 6 |

## CONFLICT abierto (G9)

`doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` (contrato activo) fija los
Entry States (§10) y las rutas públicas (§22.1: Early Access / Demo), y
`PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md` §4 dice que ni `starteria_path` ni el intent
eligen destino: lo fija el servidor. El doc E2E v0.2 §3/§5 pide destinos según el Job (incluido
"no activar trabajo todavía") y patrones context-first / challenge-first / independent.

Lo implementado es compatible con ambos: una **ruta sugerida de presentación**
(`front/src/features/portfolio-entry/public/suggestedRoute.ts`) derivada de campos que el handoff ya
trae, sin agregar destinos, entry states ni campos al handoff, y sin tocar la continuidad. Agregar
destinos reales o nuevos entry states requiere decisión de producto (ADR) y actualizar los 32 casos
del AI Harness.

## Fuera de alcance de esta suite

- jev-regresion (`scripts/jev-regresion.py`) solo navega (`NO_WRITE`): no puede recorrer A–E, que
  escriben datos. Cuando una ola agregue una pantalla navegable (p. ej. Mission Review), suma su caso
  con `hu: "E2E-JOB"` en `scripts/jev-regresion.cases.json`.
- Las variantes LLM reales (`PORTFOLIO_ENTRY_RUNTIME_MODE=deterministic` en el runner).
