# P9 — Support + Portfolio Signals Evidence

**Status:** PASS  
**Cut:** 2026-10-20

## Authority

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`, §24.
- **Exact quote:** “Owner retains Step state.”
- **Interpretation:** a support signal must not mutate the Initiative cycle or Step state.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_TECH_SPEC_v0.1.md`, §8.
- **Exact quote:** “P9 | support/attention adapter | Project signal → existing HelpRequest/AttentionItem-compatible reading | Portfolio cannot mutate Step state”.
- **Interpretation:** P9 reuses existing `AttentionItem`; it does not introduce the candidate `SupportRequest` aggregate.

## Implementation

The Initiative Owner command `POST /projects/:id/adaptive-core/support-signals` creates an existing `AttentionItem` with `objectType: initiative_support` and a durable `support_signaled` receipt. It accepts category, reason, severity, source reference, exit condition and next action. It verifies Initiative team write access and SourceRef ownership.

The Portfolio Home already reads open `AttentionItem` rows into a bounded attention projection. It receives the signal as an Initiative attention item and has no command to mutate Step state. Existing `AttentionItem` statuses provide open/acknowledged/resolved/cancelled identity and lifecycle; P9 does not promote a new canonical SupportRequest.

## Verification

| Verification | Result |
|---|---|
| Owner signal persistence and replay | PASS: `support-signal.persistence.e2e.test.ts`, 1/1 on isolated PostgreSQL |
| No direct Step mutation | PASS: before/after `Project.currentStep` assertion in the persistence test |
| Durable identity/state/event | PASS: one `AttentionItem` in `open` state and one `support_signaled` event after retry |
| Portfolio bounded reading | PASS: `portfolio-home.read-service.test.ts`, 13/13; open attention maps to Initiative attention without mutation |

No new entity, Core/cardinality change, Step-function change, AI authority, human decision authority or ADR blocker was introduced.
