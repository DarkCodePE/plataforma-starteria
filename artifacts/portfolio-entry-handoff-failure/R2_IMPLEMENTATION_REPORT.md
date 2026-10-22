# KAN-167 — Portfolio Entry Critical Handoff R2 Frontend

Fecha: 2026-10-22  
Estado: implementación verificada; cierre mediante commit local autorizado en Jira KAN-167, comentario 10442. Integración/publicación pendiente de aprobación humana posterior.

## 1. Baseline y autorización

- Jira: KAN-167, autorización de implementación local R2 condicionada al cierre verificable de KAN-164.
- Cierre local: comentario Jira 10442, `APROBADO — commit local R2` del 22/10/2026; autoriza un único commit local y no autoriza push, PR, merge ni despliegue.
- Worktree R2: `C:\Users\User\proyect-starteria\starteria-KAN-167-critical-handoff-r2`.
- Rama R2: `fix/KAN-167-critical-handoff-r2`.
- Base exacta: commit R1 `1edde556a139147780f98f03ff5f3d09519f4253`.
- Commit R1: `fix(back): asegura recuperación de Critical Handoff [KAN-164]`.
- El worktree R1 quedó limpio después del commit. No hubo push, PR, merge ni despliegue.
- Baseline frontend focal antes de R2: 76/76 tests verdes (`PortfolioEntryExperience` y servicio público).

## 2. Problema anterior

Tras un 503, timeout o conflicto al materializar Critical Handoff, la pantalla conservaba el DTO anterior y podía mostrar simultáneamente un estado de aclaración sin pregunta activa y una acción genérica `Reintentar análisis`. La recuperación no comprobaba siempre el estado vigente del servidor. Una recarga posterior podía volver a ejecutar automáticamente el POST de materialización.

## 3. Arquitectura corregida

El frontend separa ahora los estados de presentación de conclusión:

1. `awaiting_answer` — hay aclaración semántica pendiente.
2. `conclusion_pending` — el contexto ya es suficiente y aún no comenzó una petición local.
3. `conclusion_generating` — existe una única materialización en vuelo.
4. `conclusion_failed_recoverable` — un GET confirmó que la conclusión sigue pendiente en una revisión vigente.
5. `conclusion_ready` — el DTO vigente indica revisión/confirmación de Critical Handoff.

Flujo de fallo corregido:

```text
POST Critical Handoff falla
  -> no se reenvían respuestas
  -> GET de sesión con la credencial vigente
     -> review_handoff: cargar el artefacto actual, sin nuevo POST
     -> generate_handoff: habilitar solo “Reintentar conclusión” con la revisión actual
     -> GET falla: mostrar estado no verificable y exigir “Comprobar estado”
```

Se añade un marcador de presentación en `sessionStorage` con solo `{ sessionId, revision }`. Se escribe antes del POST; si el GET mantiene la misma sesión pendiente, se actualiza a la revisión autoritativa, y se elimina cuando la publicación queda confirmada, deja de estar pendiente o termina la sesión. Su propósito es impedir que una recarga durante/después de una petición incierta dispare otro POST automático. No guarda credenciales, respuestas, prompts, conclusión ni metadata privada.

Un ref síncrono de petición en vuelo complementa el estado React y bloquea doble clic/concurrencia antes del siguiente render.

## 4. Matriz de aceptación KAN-167

| Criterio | Resultado | Evidencia |
|---|---|---|
| R2-01 — estados de conclusión separados | CUMPLE | `ConclusionState`, `ConclusionStatus` y tests de transición |
| R2-02 — 503/timeout recuperan mediante GET | CUMPLE | tests unitarios de 503, timeout y Playwright 503 |
| R2-03 — retry específico conclusion-only | CUMPLE | CTA `Reintentar conclusión`; el test afirma cero replay de `submitPortfolioEntryMessage` |
| R2-04 — conflicto y drift usan revisión vigente | CUMPLE | tests 409 y recarga con marcador rev2/GET rev3: retry manual revisión 3 |
| R2-05 — GET fallido muestra estado honesto | CUMPLE | estado no verificable + `Comprobar estado`, sin retry semántico |
| R2-06 — doble clic, recarga, drift y respuesta perdida no duplican | CUMPLE | guard síncrono, marcador por sesión, tests DOM y navegador |
| R2-07 — sin pregunta activa no muestra falso error | CUMPLE | `generate_handoff` renderiza estado de conclusión; no aparece `portfolio-entry-inconsistent-state` |
| R2-08 — Critical actual y checkpoint humano, sin fallback legacy | CUMPLE | recuperación a `critical-handoff-review`; CURRENT_114D y LEGACY_COMPAT verdes |
| R2-09 — accesibilidad y copy causal acotado | CUMPLE | región `aria-live`, CTA explícita y estado desconocido sin causa inventada |

## 5. Archivos modificados

- `front/src/features/portfolio-entry/public/PortfolioEntryExperience.tsx`
- `front/src/features/portfolio-entry/public/storage.ts`
- `front/src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx`
- `front/src/features/portfolio-entry/public/__tests__/storage.test.ts`
- `front/e2e/critical-handoff-review.spec.ts`
- `artifacts/portfolio-entry-handoff-failure/R2_IMPLEMENTATION_REPORT.md`

No se modificaron backend, Prisma, AI service, contratos, Core, Steps, Skills, Question Planner, Adaptive Core ni PL-04/05/06.

## 6. Evidencia de pruebas

| Comprobación | Resultado |
|---|---|
| Baseline focal previo | PASS — 76/76 |
| Focal R2 (`PortfolioEntryExperience` + storage) | PASS — 72/72 |
| Suite frontend completa | PASS — exit 0; avisos heredados de `act`, refs y MSW sin fallos |
| `npm run typecheck:front` | PASS |
| `npm run lint` | PASS — `Baseline lint passed` |
| `npm run build` | PASS — 2681 módulos transformados; warnings de chunks/dynamic import ya existentes |
| Playwright R2: 503 → GET → reload → retry conclusión | PASS — 1/1 |
| Full-stack CURRENT_114D | PASS — 6/6 |
| Full-stack LEGACY_COMPAT | PASS — 7/7 |
| `git diff --check` | PASS |
| Revisión independiente | APPROVED — ronda 2; el hallazgo rev2→rev3 de ronda 1 fue reproducido, corregido y cubierto en DOM + Playwright |

Los E2E finales usaron una composición PostgreSQL aislada en `55435`, backend `4102` y frontend `5178`, porque `55433` estaba ocupado por un proceso de otro worktree que no se alteró. Antes del E2E se ejecutó `npx prisma generate`; no produjo cambios versionados.

## 7. Invariantes demostradas

- Un fallo de conclusión nunca llama al endpoint de mensajes ni reconstruye respuestas.
- Si el POST respondió 503 pero el GET devuelve `review_handoff`, la UI carga el Critical Handoff y mantiene un solo POST.
- Si el GET devuelve `generate_handoff` con una revisión nueva, el retry usa esa revisión, no la obsoleta.
- Si una recarga encuentra un intento incierto de la misma sesión y el contexto avanzó de revisión, bloquea el auto-POST y exige retry manual con la revisión autoritativa.
- Si el GET falla, no se ofrece un retry potencialmente duplicador hasta verificar el estado.
- Una recarga con intento incierto mantiene el retry manual y no auto-publica.
- Cada retry válido crea una nueva Idempotency-Key, compatible con la protección R1 para claves iguales o distintas.
- No se materializa ni presenta legacy como fallback de Critical Handoff.
- No se crea Initiative, Assignment ni Step desde este flujo.

## 8. Riesgos residuales

- El marcador es por navegador/pestaña (`sessionStorage`). Otro dispositivo no comparte ese estado, pero R1 mantiene la idempotencia y atomicidad en servidor.
- El usuario puede cerrar la pestaña antes de que JavaScript procese una respuesta exitosa; al volver, el GET autoritativo resuelve `review_handoff` y limpia el marcador.
- Los avisos heredados de la suite frontend (`act`, refs y handlers MSW) permanecen fuera del alcance R2; la suite terminó con exit 0.
- No se ejecutó contra un proveedor IA real: los recorridos full-stack usan el adaptador determinístico autorizado para 114D.

## 9. Conflictos contractuales

No se detectaron incompatibilidades materiales con el contrato Portfolio Entry, Core v0.2, ADR-002, ADR-007 ni autoridad 114D. `KEEP_COMPAT` se conserva como ruta explícita para sesiones históricas y nunca como fallback visible.

## 10. V2_CHANGE_CLOSURE_CHECK

```text
V2_CHANGE_CLOSURE_CHECK
Slice: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_114D / KAN-167 R2 frontend recovery
Authority: KAN-167 + Portfolio Entry Logic Contract + Critical Reasoning Contract + Core v0.2 + ADR-002/ADR-007
Implementation scope: frontend recovery and presentation only
Canonical schemas changed: NO
Backend/Prisma/AI changed: NO
Core/Steps/Skills/PL-04/05/06 changed: NO
Human confirmation authority preserved: YES
Legacy policy: KEEP_COMPAT, explicit historical route only; no Critical fallback
Semantic replay after technical failure: NO
Tests: focal 72/72, full frontend, typecheck, lint, build, browser R2, CURRENT_114D and LEGACY_COMPAT PASS
Documentation: R2_IMPLEMENTATION_REPORT.md
Conflicts: none
Residual risks: documented in section 8
Proceed to authorized local commit: YES
Proceed to integration/publication: NO — requires later human approval
```

## 11. Recomendación

**GO para el commit local autorizado de R2.** Este cierre no constituye aprobación de integración o publicación; no autoriza push, PR, merge ni despliegue.
