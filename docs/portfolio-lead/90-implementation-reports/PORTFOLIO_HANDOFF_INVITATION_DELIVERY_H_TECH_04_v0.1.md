# Portfolio Handoff Invitation Delivery — H-TECH-04

**Branch:** `feat/handoff-invitation-lifecycle-delivery`
**Status:** IMPLEMENTED — bounded lifecycle and email delivery; local verification complete

## 1. Scope

Implemented only Portfolio Lead → Initiative Owner invitation lifecycle and delivery:

```text
created → sent → viewed
created/sent/viewed → revoked | expired
```

Accept, Reject, Portfolio response, Start, Initiative/Core materialization and Step behavior remain out of scope.

## 2. Authority

Implemented against `docs/STARTERIA_AUTHORITY.md`, the factual Core contract, ADR-003/004/005, the Portfolio-to-Initiative activation and handoff contracts/checklist/technical design, and the H-TECH-02/H-TECH-03 reports. `PortfolioHandoffAssignment` remains the lifecycle owner.

## 3. Current mail infrastructure audit

`backend/shared/mail/mailer.ts` is the existing Nodemailer transport. It is config-driven, disabled when SMTP is not configured, logs only safe subject metadata, and exposes a boolean delivery result. No second SMTP implementation was added.

## 4. KEEP / ADAPT / ADD

- **KEEP:** shared Nodemailer transport, SMTP configuration conventions, logger redaction, H-TECH-03 opaque access credential/hash model, assignment aggregate boundary.
- **ADAPT:** narrow `HandoffInvitationDeliveryPort`, with a production adapter around the shared mailer; public invitation entry now supplies the view signal.
- **ADD:** assignment lifecycle transitions/timestamps, transport-focused delivery attempts, idempotency key handling, send/revoke routes, and the bounded email renderer.

## 5. Files changed

Backend changes are under `backend/modules/portfolio-handoff/`, `backend/app.ts`, and `backend/config/index.ts`. Persistence changes are `front/prisma/schema.prisma` plus migration `20260928150000_add_portfolio_handoff_delivery`. Focused coverage is in `portfolio-handoff-delivery.service.test.ts`.

## 6. Lifecycle implementation

Assignment state now distinguishes `CREATED`, `SENT`, `VIEWED`, `REVOKED`, and `EXPIRED`. Assignment timestamps (`sentAt`, `viewedAt`, `revokedAt`, `expiredAt`) are written on successful canonical transitions. No Accept/Reject/Started enum command or transition was added.

## 7. Delivery adapter

`PortfolioHandoffDeliveryService` depends on `HandoffInvitationDeliveryPort`; the runtime adapter delegates to the existing shared `mailer`. The transport result is evidence only and cannot become lifecycle state without a successful delivery result.

## 8. Send semantics

Send requires an existing assignment in `CREATED`, `SENT`, or `VIEWED`, creates/uses an H-TECH-03 opaque access credential, renders the email, attempts transport, and transitions `CREATED → SENT` only after delivery returns success. Disabled SMTP and thrown transport errors leave the assignment retryable and do not expire, accept, reject, start, or create Core state.

## 9. Idempotency / retry

`PortfolioHandoffDeliveryAttempt` stores `EMAIL`, `SUCCEEDED|FAILED`, attempted time, sanitized error category, optional provider reference, and the idempotency key. The unique `(assignmentId, idempotencyKey)` boundary makes replay return `IDEMPOTENT`; a later key can retry a failed attempt. `sentAt` is never used for failed attempts.

## 10. Viewed evidence

The existing public token-bound invitation GET invokes `markHandoffInvitationViewed`. Only a valid, non-revoked, non-expired H-TECH-03 credential entering the invitation experience can move `SENT → VIEWED`. SMTP success, email rendering, and an attempt record alone do not mark viewed. Repeated view is harmless.

## 11. Revoke / expire

Portfolio-side revoke is authenticated and guarded by `portfolio:write`; it permits only `CREATED`, `SENT`, and `VIEWED`, preserves assignment/member ownership, revokes all access records, and leaves historical assignment data intact. Expiry is evaluated lazily from the authoritative access `expiresAt`, transitions the assignment to `EXPIRED`, blocks access and later delivery, and does not extend on retry. No default duration is invented; callers provide the expiry when applicable.

## 12. Email template / content

The email is deliberately minimal: Starteria, “Te han invitado a revisar una asignación”, optional safe context, and one `Revisar asignación` CTA to `/handoff/invitations/:token`. It contains no Accept, Reject, Start, internal enum, fake Initiative status, or step controls.

## 13. Security / logging

Only the SHA-256 credential hash is persisted. The raw credential exists transiently to construct the intended opaque URL and is not logged. Recipient email is passed to the transport but is not logged by the adapter. SMTP credentials, JWTs and token hashes are not written to operational logs. Errors are reduced to `TIMEOUT`, `PROVIDER_AUTH`, `PROVIDER_FAILURE`, or `MAILER_DISABLED`.

## 14. Tests / results

- H-TECH-04 focused delivery/lifecycle suite: **4 tests passed**.
- H-TECH-02 assignment regression suite: **8 tests passed**.
- H-TECH-03 access/claim regression suite: **5 tests passed**.
- Backend TypeScript check: **passed**.
- Prisma schema validation with a local placeholder `DATABASE_URL`: **passed**.
- `git diff --check`: **passed**.

## 15. BR / AC traceability

- **BR-HO-027 / AC-HO-032–035:** canonical created/sent/viewed/revoked/expired state machine and timestamps.
- **BR-HO-028/029/030 / AC-HO-036/037:** no Start command exists; revoked/expired access and non-active lifecycle are blocked; no rejected recovery path was added.
- **BR-HO-036/037/038 / AC-HO-044/045/047:** concise human email, one review CTA, no internal state copy or response controls.
- **AC-HO-046:** downstream Start/Overview/Step behavior is not implemented by this slice.

## 16. Negative Core guards

Send/view/revoke have no dependency on `ProjectService.createProject`, `createProjectFromPublicDraft`, `updateStep0`, Step creation, `InitiativePortfolioMeta`, or `TeamMember`. Focused H-TECH-02 regression remains green. No Project, TeamMember, Steps, or Step 0 is created by this slice.

## 17. Conflicts

No authority conflict was discovered. The existing H-TECH-03 access record remains access infrastructure; assignment state remains canonical. No silent product-semantic conflict was resolved.

## 18. ADR required

**No.** The delivery-attempt record and lifecycle transition adapter are the bounded implementation explicitly assigned to H-TECH-04 by ADR-005/Technical Design. No Core identity, authority, team cardinality, Step lifecycle or global permission model changed.

## 19. Next-slice dependencies

H-TECH-05 owns Accept/Reject/Portfolio response. H-TECH-06 owns Handoff Shell/Overview. H-TECH-07 owns Start. H-TECH-08 owns semantic events/projection. H-TECH-09 owns legacy-route quarantine.

## 20. Status

**IMPLEMENTED / LOCALLY VERIFIED / SAFE FOR PR REVIEW.** This checkout does not certify deployment or resolve the KAN-53 production incident.
