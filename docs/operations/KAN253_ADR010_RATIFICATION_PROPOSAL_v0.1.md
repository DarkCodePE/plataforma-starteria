# KAN-253 / Product ADR-010 — ratification proposal

**Status:** PROPOSED FOR HUMAN DECISION — NOT RATIFIED  
**Prepared:** 2026-11-10  
**Baseline inspected:** `main@b6c3e8a155dbd1996b8d489acf4ab92438c25716`  
**Canonical decision record:** `doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md`

This document prepares a decision. It does not approve the ADR, authorize a production
migration or replace the canonical product ADR.

## Authority finding

There are three unrelated `ADR-010` references in the repository:

1. `docs/adr/ADR-010-un-solo-runtime-y-el-estado-como-artefacto.md` belongs to the
   development harness. Its accepted status has no product or database authority.
2. `backend/docs/adr/ADR-010-auth-error-envelope.md` and
   `backend/docs/adr/ADR-010-auth-authz-6role-implementation.md` are historical backend
   records and do not govern Portfolio Bootstrap E2.
3. `doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md` is the applicable product
   decision. Its canonical index and document both say `PROPUESTO / pendiente de
   ratificación`.

The KAN-253 migration and implementation reports correctly refer to item 3. A merge, green
CI or a matching number in another ADR series cannot ratify it.

## Governance deviation observed

Migration `20261109100000_kan253_e2_goal_turn_ledger` is already reachable from `main`, even
though the canonical ADR says ratification is required before merge and production. This is
an integration fact, not implicit approval. CD must remain blocked until the decision below
is made and recorded.

## Proposed scoped decision

Ratify Product ADR-010 only for the following bounded behavior:

- persist literal E2 objective answers in `PortfolioBootstrapGoalTurn` as provisional turns;
- preserve actor, organization, Anchor/ContextReview versions, source evidence, ordering,
  idempotency and supersession;
- keep the ledger separate from `PortfolioAnchor` and from canonical business truth;
- keep `PORTFOLIO_GOAL_E2_LEDGER_ENABLED` and every semantic E2 rollout flag disabled until a
  separately authorized activation;
- permit the additive migration in a separately approved production CD after migration
  preflight and backup evidence;
- preserve legacy `sourceRefs.objectiveConversation.turns` without backfill or destructive
  reconciliation.

This ratification would not authorize live AI, automatic Objective confirmation, E3
transition, Project/Initiative creation, Step activation, changes to Step 0–4, or any new
human/AI authority.

## Core compatibility assessment

| Core rule | Compatibility |
|---|---|
| INV-03 — AI proposes, people decide | Compatible: the ledger records user input and grants no decision authority. |
| INV-04 — chat is not the official record | Compatible if the ledger remains provisional and structured confirmation remains in Anchor. |
| INV-05 — material claims require provenance | Improved by actor, source, Anchor and ContextReview version binding. |
| INV-10 / §30 — new information preserves history | Improved by monotonic versions, idempotency and supersession instead of overwrite. |
| Portfolio and Initiative remain separate | Compatible: no Initiative, Project, Step or Core object is created. |

No Core invariant changes. Ratification is still required because this is a durable product
data boundary and a production schema migration.

## Migration impact

`20261109100000_kan253_e2_goal_turn_ledger`:

- creates one table and four indexes;
- adds one foreign key to `PortfolioBootstrapSession` with `ON DELETE CASCADE`;
- performs no backfill, update, delete, rename or drop;
- does not modify existing rows or required columns;
- is ignored by old application images and by the current runtime while the feature flag is
  off;
- creates future storage cost and makes session deletion cascade to its provisional turns.

Disposable PostgreSQL, concurrency/idempotency, tenant/owner and re-entry evidence must be
green on the exact release SHA before a production authorization.

## Exact human ratification record required

The product decision owner must provide all of the following, not only “approved” in a PR:

```text
Decision: RATIFY | REJECT | RETURN_FOR_CHANGES
Canonical ADR: doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md
Approved scope: provisional E2 ledger + additive migration only
Core impact: no invariant change
Feature flags after deploy: OFF
Aprobado por: <human name/account>
Aprobado en: <ISO date>
Evidencia revisada: <PR/run/disposable DB references>
```

After a `RATIFY` decision, a separate governed change must update the canonical ADR status,
`doc/product-adr/ADR-INDEX.md` and the stale KAN-253 status in `CURRENT_STATE.md`. This proposal
must not make those edits pre-emptively.

The canonical ADR and its index row must use the exact closed status `ACCEPTED`. Negative or
compound values such as `NO APROBADO`, `NOT ACCEPTED`, `REJECTED`, or text that merely contains
the word “approved” are rejected by the CD gate. The ADR must also retain the three explicit
fields `Aprobado por`, `Aprobado en`, and `Evidencia revisada` shown above.

The prepared CD validates both canonical files before image publication or migration. With the
current `PROPUESTO` state, that gate fails deliberately; a generic GitHub environment approval
cannot substitute for this product decision.

## Production authorization remains separate

Ratifying Product ADR-010 permits consideration of the schema change. It does not authorize:

- dispatching CD;
- applying either pending migration;
- changing production environment variables/secrets;
- enabling the email pilot;
- creating production test data;
- sending an invitation.

