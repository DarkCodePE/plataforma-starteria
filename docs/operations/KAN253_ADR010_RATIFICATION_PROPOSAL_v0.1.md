# KAN-253 / Product ADR-010 — ratification proposal

**Status:** PROPOSED FOR HUMAN DECISION — NOT RATIFIED  
**Prepared:** 2026-11-10  
**Baseline inspected:** `main@f5b8569091f9c5683ea12488756e93b2e14c0c4e`
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

## Formal decision-owner verification

```text
AUTHORITY_CHECK: BLOCKED
PROPOSED_PRODUCT_DECISION_OWNER: requester responsible for Product
FORMAL_IDENTITY: not recorded
FORMAL_SCOPE_DELEGATION_FOR_KAN-253: not recorded
JIRA_ASSIGNEE: none
```

`docs/STARTERIA_AUTHORITY.md` defines the order of product authority, while `AGENTS.md`
reserves product decisions and ADR approval to a person. Neither source names the requester
or delegates Product ADR-010 authority to an account. KAN-253 is still `Por hacer` and has no
assignee. Repository write access, PR approval, GitHub environment approval or requesting this
preparation do not establish product-decision authority.

Formal verification requires a durable governance record that:

1. names the human and verifiable account authorized to decide Product ADR-010/KAN-253;
2. states that the delegation covers the provisional E2 ledger and additive migration only;
3. is authored or acknowledged by the existing product authority, not by the preparing agent;
4. records one of `RATIFY`, `REJECT` or `RETURN_FOR_CHANGES` using the exact decision record
   below; and
5. remains distinct from production/CD approval.

Until that evidence exists, the proposed owner is `UNVERIFIED` and the canonical ADR must stay
`PROPUESTO / PENDIENTE DE RATIFICACION`.

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

## Proposed operational owners — acceptance requests

The following assignments are proposals, not accepted responsibilities:

| Responsibility | Proposed owner | Current state | Acceptance record required |
|---|---|---|---|
| Data/DB Owner | GitHub account `DarkCodePE` | `PENDING_ACCEPTANCE` | Named account accepts custody of backup authorization, checksum evidence, isolated restore drill, retention/destruction and restore escalation for the exact release SHA. |
| SMTP Owner | GitHub account `DarkCodePE` | `PENDING_ACCEPTANCE` | Named account accepts verification of the existing provider, organizational sender/reply-to, protected pilot configuration, singleton allowlists, kill switch and incident shutdown for the exact smoke window. |

Requested Data/DB Owner statement:

```text
I, <human name> acting through GitHub account DarkCodePE, accept Data/DB Owner
responsibility for the proposed E1-E7 -> Owner release candidate <full SHA>.
I will review the two pending additive migrations, authorize the encrypted
off-volume backup, verify its SHA-256, witness the isolated PostgreSQL 16
restore drill and record retention/destruction evidence. This does not
authorize CD, migration, production restore or cleanup.
```

Requested SMTP Owner statement:

```text
I, <human name> acting through GitHub account DarkCodePE, accept SMTP Owner
responsibility for the controlled E1-E7 -> Owner pilot on starter-ia.com.
I will verify the existing external SMTP provider, organizational sender and
reply-to, one consented recipient, org-e2e-prod and one Lead actor allowlist,
and the disabled-by-default kill switch. This does not authorize configuration
changes, pilot activation, CD or an email send.
```

## Mailbox consent candidate

```text
CONSENT_REFERENCE: GOV-2026-11-10-OWNER-PILOT-01
PURPOSE: one production Handoff invitation only
CONTROL_AND_CONSENT: confirmed by the requester for the mailbox owner
CONFIGURATION_STATE: not configured
SEND_AUTHORIZATION: not granted
```

The exact mailbox supplied to the operator must be written only to the protected
`E2E_PROD_OWNER_EMAIL` and singleton recipient allowlist after separate authorization. It must
not be committed, copied to an issue, printed in logs or exposed in screenshots. The mailbox is
not a sender or reply-to identity. Consent does not authorize account creation, invitation
creation, configuration changes or sending.

## Required evidence gates

### Encrypted off-volume backup and isolated restore

- independent Data/DB Owner acceptance and immutable authorization reference;
- exact release SHA and both pending migration names in the authorization;
- recipient certificate fingerprint (`SHA-256`) recorded without private-key material;
- successful `mvp-release01-backup-only.yml` run URL and encrypted artifact identifier;
- encrypted artifact byte size and `SHA-256`, with the checksum verified after download;
- evidence that the approved copy is outside the PostgreSQL volume/failure domain;
- PostgreSQL 16 isolated clone with a non-production database name and a different system
  identifier;
- successful checksum verification, decrypt and `pg_restore` on the clone;
- Prisma migration state, critical schema objects, bounded row-count invariants and read-only
  application probes recorded without row contents or personal data;
- clone destruction deadline and completion evidence; and
- separate escalation owner for any production restore. A drill never authorizes a restore.

### Verified SMTP pilot and singleton allowlists

- SMTP Owner acceptance and a provider-side statement that the existing transport is external
  and production-capable; Mailpit/local hosts are invalid;
- provider verification of the exact organizational sender and organizational reply-to;
- production origin exactly `https://starter-ia.com`;
- transport remains `disabled` and pilot switch `false` outside the separately approved window;
- recipient allowlist contains only consent reference `GOV-2026-11-10-OWNER-PILOT-01`'s mailbox;
- organization allowlist contains only `org-e2e-prod`;
- actor allowlist contains only the exact authorized Portfolio Lead user ID;
- maximum one send in the approved window, minimum interval at least 30 seconds and invitation
  TTL explicitly approved;
- validator output records pass/fail without host, mailbox, actor, credentials or tokens; and
- shutdown owner and procedure for returning both pilot controls to `disabled/false`.

## Governance GO / NO-GO matrix

| Gate | State | Responsible | Evidence required to become GO | Principal risk while open |
|---|---|---|---|---|
| Product decision authority | `NO-GO` | Existing Product authority | Named human/account and bounded KAN-253 delegation | An unverified requester could promote a durable product boundary. |
| Product ADR-010 decision | `NO-GO` | Verified Product Decision Owner | Exact `RATIFY`, `REJECT` or `RETURN_FOR_CHANGES` record | Merge/CI could be mistaken for approval. |
| Canonical ADR/index reconciliation | `NO-GO` | Docs/Product approver | Separate reviewed PR after a valid `RATIFY` | Proposal could be marked accepted prematurely. |
| Data/DB ownership | `NO-GO` | `DarkCodePE` proposed | Explicit acceptance statement | Backup/restore evidence has no accountable custodian. |
| Off-volume backup/checksum | `NO-GO` | Accepted Data/DB Owner | Run, encrypted artifact, size, SHA-256 and off-volume custody | Same-volume loss or unverified artifact. |
| Isolated restore drill | `NO-GO` | Accepted Data/DB Owner | PostgreSQL 16 restore and destruction evidence | Backup may be unusable when needed. |
| SMTP ownership | `NO-GO` | `DarkCodePE` proposed | Explicit acceptance statement | No accountable owner for sender or shutdown. |
| SMTP provider/sender | `NO-GO` | Accepted SMTP Owner | Existing provider and organizational identities verified | SMTP acceptance may be unavailable or misrepresented. |
| Mailbox consent | `GO_FOR_CANDIDACY_ONLY` | Mailbox owner | Consent reference above; exact value later stored protected | Consent could be confused with send authorization. |
| Singleton allowlists/pilot config | `NO-GO` | Accepted SMTP Owner + Security reviewer | Redacted validator evidence with one recipient/org/actor | Wrong-tenant or unintended delivery. |
| CD/migrations | `NO-GO` | Release Manager + production reviewer | New exact SHA, green CI and all prior gates GO | Unauthorized irreversible production effects. |
| One real invitation | `NO-GO` | Mailbox owner + SMTP Owner + smoke operator | Separate exact send authorization after healthy rollout | Duplicate send or PII/token exposure. |

## Governance result

```text
RESULT: GOVERNANCE_READY_FOR_APPROVAL
PRODUCTION_GO: NO
CD_AUTHORIZED: NO
MIGRATIONS_AUTHORIZED: NO
SMTP_CONFIGURATION_AUTHORIZED: NO
EMAIL_SEND_AUTHORIZED: NO
```

The package is complete enough for the named humans to accept or reject their roles and for a
verified Product Decision Owner to make the bounded ADR decision. It does not satisfy any
production execution gate by itself.

