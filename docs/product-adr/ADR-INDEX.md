# Índice de ADRs de producto

**Estado:** índice operativo del checkout mixto, 2026-09-20.

La serie histórica del backend se conserva en `backend/docs/adr/` para no duplicar ni
romper sus referencias. Este índice registra la autoridad de producto aprobada que
gobierna la slice `AI_HARNESS_INTERPRET_ADR031`.

| ADR canónico | Estado | Alcance |
|---|---|---|
| [ADR-027 — Harness diagnóstico](../../backend/docs/adr/ADR-027-methodology-agent-harness.md) | Accepted, 2026-07-24 | Pipeline, hard gates y confirmación humana |
| [ADR-031 — Jev y gate de confianza](../../backend/docs/adr/ADR-031-confidence-threshold-for-human-escalation.md) | Accepted, 2026-09-20 | Jev en INTERPRET del harness; corte operativo provisional 0.50 |
| [ADR-032 — Session-Scoped Portfolio Context Selection Persistence](../../backend/docs/adr/ADR-032-session-scoped-portfolio-context-selection-persistence.md) | Accepted, 2026-09-27 | Persistencia server-owned de selección de contexto Portfolio por sesión/dispositivo; no autoriza KAN-41 |
| [ADR-033 — Stable Auth Session Identity for Protected Requests](../../backend/docs/adr/ADR-033-stable-auth-session-identity-for-protected-requests.md) | Accepted, 2026-09-27 | `RefreshToken.family` como `sid` firmado para binding de sesión; autoriza solo AUTH-SID-1 |

La aprobación de ADR-031 fue instruida expresamente por el responsable y se implementa
en el [reporte de activación](../analisis-jev/13-adr-031-activation.md). El índice no
resuelve por sí mismo la ausencia del Core Contract referenciado por Authority.
