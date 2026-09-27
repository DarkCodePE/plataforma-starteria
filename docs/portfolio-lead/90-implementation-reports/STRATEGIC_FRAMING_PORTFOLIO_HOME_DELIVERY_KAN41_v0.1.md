# STRATEGIC FRAMING PORTFOLIO HOME DELIVERY — KAN-41

## 1. Base SHA

`f602904d64e70827c93213cd8a77113d5480c297`

## 2. Branch

`design/KAN-41-sf7b2-home-authority-composition`

## 3. Authority documents

- `docs/STARTERIA_AUTHORITY.md`
- `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` — actual Core authority.
- `backend/docs/adr/ADR-032-session-scoped-portfolio-context-selection-persistence.md`
- `backend/docs/adr/ADR-033-stable-auth-session-identity-for-protected-requests.md`
- `docs/portfolio-lead/07-strategic-framing/STRATEGIC_FRAMING_PORTFOLIO_HOME_AUTHORITY_COMPOSITION_SF7B2_v0.1.md`
- `docs/portfolio-lead/07-strategic-framing/PORTFOLIO_CONTEXT_AUTHORITY_CONTRACT_SF7B2B_v0.1.md`
- `docs/portfolio-lead/07-strategic-framing/PORTFOLIO_CONTEXT_RUNTIME_DESIGN_SF7B2C_v0.1.md`
- `docs/portfolio-lead/90-implementation-reports/PORTFOLIO_CONTEXT_AUTHORITY_RUNTIME_SF7B2D_v0.1.md`

The requested `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` is not present. It was not copied or invented.

## 4. Portfolio Context integration

The authenticated Home controller builds the actor from the verified request identity, including `authSessionId` from the verified token `sid` and effective permissions, then invokes `PortfolioContextAuthorityService.resolve(actor)`. The Home read service receives the explicit resolution and never derives Strategic Framing scope from user id, `User.organizationId`, browser metadata, bootstrap data, or continuation scope.

## 5. Home boundary before/after

Before: `PortfolioHomeReadService.getHome(userId)` composed only canonical Home reads.

After: `getHome(actor, contextResolution)` preserves the canonical read and adds `strategicFraming` as a semantic response state. The string user-id form remains compatible for existing direct callers and defaults to `no_context`; the runtime route uses the governed actor/resolution form.

## 6. Strategic Framing response states

- `available`: authorized projection with one or more Strategic Framing states.
- `empty`: authorized projection completed with zero states.
- `no_context`: authority found no usable context, including legacy sid-less requests.
- `context_selection_required`: multiple authorized organizations have no selected context.
- `not_authorized`: stored/selected context failed current authority or session validation.
- `unavailable`: only a genuine authorized Strategic Framing technical read failure.

## 7. Available behavior

Only `AuthorizedPortfolioContext.organizationId` is passed to the existing SF-7B.1 projection service. The projection is invoked once per Home composition and retains its batched related reads.

## 8. Empty behavior

An available projection with `totalStateCount === 0` returns `strategicFraming.status = empty`, never `unavailable`.

## 9. No-context behavior

Canonical Home remains successful and no Strategic Framing projection query is made.

## 10. Context-selection-required behavior

Canonical Home remains successful and returns the explicit selection-required state. The server does not choose an organization and no SF query is made.

## 11. Not-authorized behavior

The state is preserved in the successful Home DTO. It is not converted to `empty` or `unavailable`; authority service errors are not swallowed by Home composition.

## 12. Technical-unavailable behavior

An authorized projection result of `availability = unavailable`, or a non-security technical projection failure, becomes `strategicFraming.status = unavailable` while canonical Home remains successful.

## 13. Canonical Home failure behavior

Canonical reads execute as the primary Home read. If they fail, the existing error propagates and no synthetic successful Home is returned.

## 14. Global permission

The context authority resolves the authorized organization and the projection reads only that organization. Global permission behavior is covered by the existing context authority and SF projection tests.

## 15. Scoped permission

The same governed context path supports scoped authority. The projection accepts the validated `AuthorizedPortfolioContext` as the authorization proof, so a scoped grant is not mistaken for a global platform permission.

## 16. Revocation behavior

Membership, grant, global-authority, and auth-session revocation remain request-time context-authority concerns. They return `not_authorized` and do not expose stale organization data.

## 17. Cross-org protection

The projection organization is sourced only from the returned authorized context. Explicit Home organization query parameters are rejected with the existing 403-style error path; they cannot select or override context.

## 18. Browser org behavior

Browser organization metadata is not read by Home composition or the projection. It has no authority.

## 19. Legacy token behavior

Requests without a verified `sid` remain compatible for canonical Home and return Strategic Framing `no_context`; no user-id or fallback session scope is created.

## 20. Two-session behavior

Session ownership and isolation remain provided by `PortfolioContextAuthorityService` and its SF-7B.2D tests. Home consumes the session-specific resolution and therefore projects only the organization returned for that session.

## 21. Projection invocation/query behavior

The Home composition invokes the existing `StrategicFramingHomeProjectionService` once when context is available. No per-state or per-challenge loops were added. The projection's existing batched query behavior remains covered by its focused test.

## 22. Files changed

- `backend/modules/portfolio/portfolio.controller.ts`
- `backend/modules/portfolio/portfolio.router.ts`
- `backend/modules/portfolio/portfolio-home.read-service.ts`
- `backend/modules/portfolio/__tests__/portfolio-home.read-service.test.ts`
- `backend/modules/portfolio/__tests__/portfolio.router.authz.test.ts`
- `backend/modules/strategic-framing/strategic-framing.home-projection.service.ts`
- this implementation report

## 23. Tests

Focused KAN-41 set: PASS — 40 tests across Portfolio Home, Home router authorization, Strategic Framing Home Projection, and Portfolio Context Authority.

Auth regression set: PASS — 24 tests across auth middleware, auth-session validation, and Portfolio Context Authority.

Broader backend: 1159 passed, 84 skipped, 1 pre-existing shared-database failure in `strategic-framing.promotion.integration.test.ts` caused by a unique `(userId, organizationId, capability)` grant. No KAN-41 test failed.

Coverage includes authorized available/empty composition, no-context, selection-required, not-authorized preservation, technical failure localization, organization scoping, batched projection reads, revocation, sid-less requests, scoped/global authority, and two-session isolation through the existing authority suite.

## 24. Typecheck

`npm.cmd run typecheck:backend`: PASS.

## 25. Diff check

`git diff --check`: PASS.

Baseline lint: PASS.

## 26. Prisma changed

NO. KAN-41 consumes the existing SF-7B.2D `PortfolioContextSelection` runtime.

## 27. Core changed

NO. No Core, Step 0–4, Adaptive Cycle, relationship, or authority semantics were changed.

## 28. Remaining gaps

- Full backend regression and clean disposable-database validation remain environment-level checks; no new Prisma migration was introduced.
- The existing `AuthenticatedRequest` type has a legacy mismatch with the enriched middleware request user; KAN-41 uses a local boundary cast and does not broaden that unrelated refactor.
- No frontend context selector was implemented.

## 29. Frontend readiness

YES for consuming the semantic `strategicFraming.status` DTO in a later slice. No frontend files or selector behavior were changed here.
