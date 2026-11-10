# Production Portfolio Lead → Owner CD recovery and smoke plan

**Status:** PREPARED / NOT EXECUTED  
**Prepared:** 2026-11-10  
**Target baseline:** `b6c3e8a155dbd1996b8d489acf4ab92438c25716`  
**Production origin:** `https://starter-ia.com`

This runbook contains no production authorization. Every mutation remains behind the protected
`production` environment and a separate explicit human approval.

## Current preflight result

`NO-GO` until Product ADR-010 is ratified and a controlled external Owner identity is securely
provisioned. An off-volume encrypted backup and isolated restore drill are also missing.
Production currently advertises deployment
`1e2dfa874c72f16bc2d0d78b9d92f99408834f94`; health alone does not prove the target journey.

## Declarative Handoff email gate

The CD preparation introduces a pre-publication validation job. Safe defaults are:

```text
HANDOFF_EMAIL_TRANSPORT_MODE=disabled
HANDOFF_EMAIL_PILOT_ENABLED=false
```

`pilot` requires all of the following. Values belong in the GitHub `production` environment or
repository secret store and must never be copied into issues, logs, screenshots or this file.

| Kind | Name | Requirement |
|---|---|---|
| variable | `HANDOFF_EMAIL_TRANSPORT_MODE` | `pilot` only for the approved window; otherwise `disabled` |
| variable | `HANDOFF_EMAIL_PILOT_ENABLED` | independent kill switch, `true` only for the approved window |
| variable | `HANDOFF_INVITATION_PUBLIC_BASE_URL` | exactly `https://starter-ia.com` |
| variables | `HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW`, `...WINDOW_SECONDS`, `...MIN_INTERVAL_SECONDS` | at most 2 sends, bounded window, at least 30 seconds separation |
| variable | `HANDOFF_INVITATION_TTL_HOURS` | 1–168; proposed smoke value 24 |
| existing secrets | `STARTERIA_SMTP_HOST`, `STARTERIA_SMTP_USER`, `STARTERIA_SMTP_PASS` | external SMTP; provider remains undisclosed |
| existing secret | `STARTERIA_PILOT_LEAD_NOTIFY_FROM` | organizational sender |
| new secret | `STARTERIA_HANDOFF_EMAIL_PILOT_VERIFIED_FROM` | exact mailbox match with sender |
| new secret | `STARTERIA_HANDOFF_EMAIL_REPLY_TO` | organizational mailbox |
| new secret | `STARTERIA_HANDOFF_EMAIL_RECIPIENT_ALLOWLIST` | exact controlled Owner mailbox only |
| new secret | `STARTERIA_HANDOFF_EMAIL_ORGANIZATION_ALLOWLIST` | must contain `org-e2e-prod` |
| new secret | `STARTERIA_HANDOFF_EMAIL_ACTOR_ALLOWLIST` | exact Lead user ID, not email |
| new secret | `E2E_PROD_OWNER_EMAIL` | external, deliverable and explicitly authorized Owner mailbox |
| new secret | `E2E_PROD_LEAD_ACTOR_ID` | exact actor ID used by the runtime gate |

The validator prints only mode/result. It does not print host, mailbox, actor, allowlists or
credentials. Missing pilot values fail before image publication and before migrations. A deploy
with absent configuration remains `disabled` and explicitly overwrites any hidden old pilot mode
in the managed Kubernetes secret.

## Owner mailbox finding

The production environment currently exposes only the names of three account password secrets:
Lead, Participant and shared Member. No `E2E_PROD_OWNER_EMAIL` or authorized external mailbox is
declared. The documented Participant defaults to `e2e-participante@starteria.test`, which cannot
prove real delivery.

Therefore an external Owner account does **not** have sufficient evidence of existence or
authorization. Do not create or rename an identity until a human supplies the controlled mailbox
through the protected secret surface and separately authorizes tenant setup/update.

The prepared tenant script refuses to reuse an existing identity unless its primary organization
and every membership already belong exclusively to `org-e2e-prod`; operator logs use a hash
reference instead of the mailbox. Cleanup repeats that tenant guard and aborts if any owned Project
lacks the exact `[E2E-PROD] ` or `[E2E-SWARM] ` synthetic prefix. The current workflow still does
not inject an external Owner email, so no creation/update path is armed by this preparation.

## Pending migrations and recovery

### 20261109100000_kan253_e2_goal_turn_ledger

- expand-only table/index/FK migration; no backfill;
- runtime flags remain off;
- older images ignore the new table;
- recovery preference: leave schema in place and disable the feature, never drop the table as an
  incident reaction;
- production application remains blocked until Product ADR-010 ratification.

### 20261109222000_g04_attention_event_history

- adds `AttentionItem.version` with default `0`;
- creates `PortfolioAttentionEvent` plus indexes/FK;
- older images ignore the additive column/table;
- preserve rows on application rollback; do not delete event history.

### Recovery sequence

1. Before migration: run read-only status, record pending names and verify the exact release SHA.
2. CD rejects destructive SQL and currently creates a PostgreSQL custom-format backup inside the
   PostgreSQL volume. That protects against a bad migration but not loss/corruption of the volume.
   It is not sufficient disaster-recovery evidence.
3. Before authorizing migration, copy the dump through an approved encrypted channel outside the
   PostgreSQL failure domain, record a checksum without exposing dump contents, and restore it into
   isolated PostgreSQL. Verify schema, row-count invariants and application reads. This mechanism
   and drill are **pending**; do not describe rollback as certified until they exist.
4. If migration fails: stop before rollout, retain logs/backup, inspect Prisma migration state and
   do not retry blindly.
5. If rollout or post-rollout verification fails: stop the smoke and all further sends. Images
   remain pinned because automatic rollback is disabled.
6. Prefer forward repair or an explicitly authorized previous image whose compatibility with the
   additive schema is demonstrated. Do not revert schema.
7. Restore is a disaster-recovery decision: first restore the off-volume dump into isolated PostgreSQL,
   verify schema/data and obtain separate approval before any production restore.
8. For email incidents, set the two pilot controls back to `disabled/false` through a separately
   authorized environment change and deploy/restart deliberately; SMTP acceptance is not human
   acceptance and must not be rewritten as such.

## Controlled smoke — prepared, not executed

Use two controlled assignments because acceptance and rejection are terminal alternatives. The
send window therefore permits at most two messages.

### Preconditions

- exact release SHA and postmerge CI recorded;
- Product ADR-010 ratified and migration approval recorded;
- protected environment reviewer present;
- off-volume encrypted backup destination, checksum procedure, isolated restore drill and recovery
  owner confirmed;
- external Owner mailbox and Lead actor ID stored in protected secrets;
- SMTP sender verified by the provider and allowlists validated;
- synthetic tenant dry-run reviewed, then any setup separately authorized;
- browser trace/screenshot directory prepared with redaction rules;
- no production customer data selected or displayed.

### Scenario A — accept

1. Lead logs in through the browser and starts at Overview.
2. Traverse E1–E7 using `[E2E-PROD] HANDOFF <UTC timestamp>` synthetic content.
3. Confirm the Brief and record its immutable ID/version, Challenge, Front and organization.
4. Prepare Assignment A for the exact controlled Owner; verify `CREATED` and no delivery attempt.
5. Send once; capture `requested`, then `smtp_accepted` or `failed`. Never label SMTP acceptance as
   inbox delivery or human acceptance.
6. Owner verifies the message in the real mailbox, opens the production-origin link, authenticates
   with the invited identity and reviews canonical Brief/context/provenance.
7. Owner accepts explicitly. Verify `ACCEPTED`, actor/time/version and `startedAt = null`.
8. Reload Owner, then re-enter Lead Overview and verify the same Assignment/version/history with no
   duplicate invitation, attempt or response.

### Scenario B — reject

1. Create Assignment B under the same synthetic scope with a distinct idempotency key.
2. Send once and repeat mailbox/identity verification.
3. Owner rejects with a synthetic reason. Verify `REJECTED`, actor/time/version/reason and
   `startedAt = null`.
4. Reload Owner and Lead; verify reason and ordered transport/human events remain distinct.

### Negative/read-only checks

- wrong account sees no canonical Brief and cannot answer;
- another tenant receives `404`/non-disclosure for the synthetic assignment;
- replay uses the same idempotency key and creates no duplicate;
- expired/revoked invitation cannot answer;
- E1–E7 and Owner/Lead re-entry preserve exact Brief version and provenance;
- no Project/Initiative/Step is created or activated by Accept/Reject;
- mobile 375 px, keyboard, focus, labels and WCAG A/AA checks run on pending and terminal states.

### Evidence package

- CD run URL, exact SHA/tag and migration names;
- health plus authenticated DB-backed smoke result;
- redacted screenshots for Lead created/sent/returned and Owner pending/accepted/rejected;
- Playwright trace/video without mailbox address, token or PII;
- redacted mail evidence showing sender, received timestamp and production origin only;
- persisted IDs/versions/statuses and duplicate counts, with no access token or invitation token;
- incident/rollback record if any step fails.

Stop on the first material failure. Do not create a compensating assignment or resend without a
new explicit authorization.

## Prepared validation evidence

- full frontend/backend TypeScript typecheck: pass;
- baseline lint and Prisma schema validation: pass;
- GitHub Actions syntax validation: pass;
- ShellCheck on the changed shell surface (CRLF-normalized copies): pass;
- Handoff transport/config, production startup/config and tenant safety tests: pass;
- migration authority tests, including ambiguous negative statuses, empty decision metadata,
  invalid ISO date and a pre-KAN-253 rollback target: pass;
- current canonical Product ADR-010 checked through the gate: rejected as expected;
- independent review round 3 found empty approval metadata and one stale cleanup paragraph; both
  were corrected and regression-tested. A final independent review of that correction set returned
  `approve`, with no blocking or security findings.

All validation was local/read-only with respect to production. No workflow was dispatched, no
environment or secret was modified, no migration ran, no identity/data was created and no email
was sent.

## Exact remaining approvals

1. Human ratification of canonical Product ADR-010.
2. Approval to create/update the external Owner identity in `org-e2e-prod`.
3. Approval to add the named production secrets/variables and arm `pilot`.
4. Approval to dispatch CD for one exact SHA and apply the two named migrations.
5. Approval to send at most two real invitations to the controlled mailbox.
6. Environment reviewer approval in GitHub.
7. Separate approval for any rollback, restore, cleanup or resend.

