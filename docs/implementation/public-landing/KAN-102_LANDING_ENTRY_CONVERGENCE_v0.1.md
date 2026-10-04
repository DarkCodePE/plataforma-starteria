# KAN-102 — Public Landing L2 + Portfolio Entry convergence

**Status:** `LANDING_ENTRY_CONVERGENCE_READY`
**Scope:** `/` Landing and public framing of the existing `/public/start` route
**Commit:** none

## A. PRECONDITION

| Check | Result |
|---|---|
| KAN-102 | En curso |
| KAN-74 | RESUELTO |
| KAN-99 | RESUELTO |
| KAN-64 | RESUELTO |
| `HEAD == origin/main` | Yes: `967ccb955fc2e667e4739288625d9aa3559e899f` |
| Working tree before changes | Clean |
| Branch | `feat/KAN-102-landing-entry-convergence` |

KAN-74/KAN-99 final closure evidence was read from `docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-99_KAN74_FINAL_ALIGNMENT_REGRESSION_CLOSURE_v0.1.md`.

### V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: PUBLIC_LANDING_L2_PORTFOLIO_ENTRY_CONVERGENCE (KAN-102)
Authority: Jira KAN-102; accepted ADR-006; Public Landing UX Spec v0.1;
           Portfolio Entry Logic Contract v0.1; Clarification/Handoff Contract v0.2.1;
           Design System Contract v0.1
Manifest status: KAN-64 was listed as partial; no KAN-102 record existed
Current route: / → LandingPage with embedded PortfolioEntryExperience;
               /public/start → existing PublicStartPage
Legacy dependencies: existing auth and Portfolio Entry routes/services; no new domain dependency
Semantic owner: Landing V2 for /; Portfolio Entry V2 for /public/start
V1 assumptions detected: none needed for this framing change
Adapter required: no; no API, DTO, persistence, lifecycle or route changes
Tests protecting current behavior: LandingPage, public routes, PortfolioEntryExperience,
                                  final action and KAN-74 continuation E2E coverage
Authority conflict: none for scoped framing; commercial destinations remain undefined
Proceed: YES for Landing and public Entry copy/presentation only
```

## B. LANDING_ENTRY_CURRENT_STATE_MATRIX

Snapshot before implementation:

| Category | Observed runtime at `/` | Classification |
|---|---|---|
| A. Already correct after KAN-64 | Public root outside auth guard; Starteria copy and a four-part product path precede Entry; existing sign-in route; Entry had `recoverExisting={false}` and kept `/public/start` as the route after first submit. | KEEP; preserve public boundary and Entry runtime |
| B. Missing L2 | No four-input/Starteria/four-output conceptual model; no “Contexto. Trabajo. Decisiones.” center; no governed value flow. | ADD presentation-only illustration |
| C. Stale Portfolio Entry framing | Entry form was embedded in the Landing; “Orientación opcional” and broad “ordenar tu objetivo…iniciativa y decisión” copy framed it as general orientation; “Analizar mi situación” appeared as the page-end CTA and only scrolled to the top. | ADAPT public presentation; route to existing `/public/start` |
| D. Stale Copilot copy | “Una lectura guiada, no una conversación suelta” and “No es solo una respuesta de IA” foregrounded conversational interaction. | ADAPT to product/value language; preserve Entry interaction sequence |
| E. Commercial CTAs | No Demo/Early Access controls or authorized destinations existed. The header sign-in went to `/auth`. | Keep real `/auth`; Demo/Early Access `RUNTIME_PENDING / BLOCKED_BY_DESTINATION` |

## C. HERO

Preserved exactly as frozen:

- “Haz que la estrategia se haga realidad.”
- “Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.”
- “Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.”

## D. L2_PRODUCT_MODEL

Added an illustrative model with the four input concepts, Starteria at the center, and the four outcomes. It is labelled conceptual and states that it does not analyze the visitor or show real organizational data. No operational workspace, Step 0–4, or visitor analysis is represented.

```text
Objetivos / Necesidades / Iniciativas / Equipos
                         ↓
                    Starteria
       Contexto. Trabajo. Decisiones.
                         ↓
Foco / Coordinación / Evidencia / Decisión
```

## E. VALUE_FLOW

Added as an unnumbered conceptual flow: `Define la meta → Alinea el trabajo → Hazlas realidad → Decide`. It is not mapped to Steps 0–4.

## F. TWO_ENTRY_PATHS

- Primary: “Ya tengo claro qué quiero mover” → existing `/auth` Starteria entry.
- Secondary and optional: “Quiero alinear mi objetivo primero” → existing `/public/start`.

The Landing no longer embeds the Entry form, so the visitor can understand the platform without interacting with Entry.

## G. PORTFOLIO_ENTRY_FRAMING

Landing and `/public/start` now say: “Aclara qué quieres conseguir antes de decidir qué hacer.” The surrounding copy describes a provisional reading of desired outcome, purpose, current situation, stakes, decision to prepare, a possible starting hypothesis, and remaining unknowns. It explicitly avoids promising a definitive plan, automatic portfolio structure, or automatic initiatives.

Portfolio Entry logic, lifecycle, clarification rules, handoff and continuation were not changed.

## H. OPTIONAL_CTA

“Quiero alinear mi objetivo primero” navigates to the real `/public/start` route. No destination was created.

## I. COPILOT_CONVERGENCE

Landing copy now explains the platform and value flow without foregrounding a chatbot. In the existing Entry runtime, synthesis precedes one active question; the existing structured clarification, handoff and next movement remain intact. No question batching or Entry logic change was introduced.

## J. REASON_TO_ASK

The backend analysis schema requires `reason_to_ask`, but `front/src/features/portfolio-entry/public/types.ts` does not expose that field on `PortfolioEntryQuestion`; the frontend runtime therefore cannot display it. This is a schema/DTO gap. No client-side reason was invented and no backend/schema change was made.

## K. FINAL_BRIEF_REGRESSION

Download, Delete and Work with Starteria remain present. Focused `PortfolioEntryExperience` tests passed (27 tests); Chromium Download and Delete E2Es passed. The KAN-96 exact identity/hydration/P1 E2E passed on retry. No changes were made to `CONFIRMED → ABANDONED`, D1, KAN-100 route, KAN-97 identity, KAN-96 hydration, or P1/P2/P3.

## L. COMMERCIAL_CTA_STATUS

`RUNTIME_PENDING / BLOCKED_BY_DESTINATION` for Demo and Early Access. No real destination was present or authorized, so neither CTA nor route was invented. This does not block the Landing model or optional Entry path.

## M. DESIGN_SYSTEM

The change reuses the existing Button and Badge primitives, neutral slate surfaces, restrained indigo accent and navy center treatment. No neon colors, separate visual system, or broad redesign was added. The model has an accessible label and the composite Chromium journey checks the Landing at a 390 px viewport for horizontal overflow.

## N. TESTS

| Check | Result |
|---|---|
| Focused Landing, PublicStart, public routes and PortfolioEntryExperience | PASS — 4 files, 34 tests |
| Full front suite | PASS — 87 files, 623 tests |
| Front typecheck | PASS |
| Lint | PASS — `Baseline lint passed` |
| Front build | PASS — existing mixed-import and large-chunk warnings remain |
| Backend tests/typecheck/build | Not run; backend, schema and DTO were not modified |

The checkout lacked the `vitest` executable shim, so Vitest was invoked directly from the installed package. Prisma Client was generated for E2E setup; it is ignored by Git.

## O. E2E

Chromium results:

- Public Landing L2 and secondary CTA → `/public/start`: PASS.
- Quick clarification one-question state: PASS.
- KAN-101 Download and Delete confirmed-Brief regressions: PASS, 2 tests.
- KAN-96 exact identity, D1/D2 hydration and explicit P1: PASS on retry. The first run hit a transient Playwright response-body protocol error; the unchanged retry passed.
- Composite KAN-102 Landing (390 px) → optional Entry → clarification → confirmed Strategic Intent continuation → final Download/Delete/Work with Starteria actions: PASS.

The E2E runner wrapper on Windows misparsed a grep containing spaces and `|`, so these focused Playwright cases were run directly against the same isolated E2E database and local services. The services and temporary database container were stopped after validation.

## P. DOC_RECONCILIATION

- Manifest now records KAN-64 as resolved/revalidated and adds the KAN-102 slice with its verified local status and unresolved destination/DTO notes.
- `CURRENT_STATE.md` records the Landing model, entry paths, commercial destination status and DTO gap.
- Historical KAN-74/KAN-99 evidence was read but not rewritten.
- No product contract, `doc/`, Core, Steps, continuation, D1/D2 or P1/P2/P3 file was changed.

## Q. FILES_CHANGED

- `front/src/app/pages/LandingPage.tsx`
- `front/src/app/pages/public/PublicStartPage.tsx`
- `front/src/app/pages/__tests__/LandingPage.test.tsx`
- `front/src/app/pages/public/__tests__/PublicStartPage.test.tsx`
- `front/src/app/routes.public-entry.test.tsx`
- `front/e2e/public-landing-l1.spec.ts`
- `front/e2e/portfolio-entry-conversion.spec.ts`
- `STARTERIA_V2_MANIFEST.md`
- `CURRENT_STATE.md`
- This report

## R. REPORT_PATH

`docs/implementation/public-landing/KAN-102_LANDING_ENTRY_CONVERGENCE_v0.1.md`

## S. FINDINGS_REMAINING

1. `reason_to_ask` is unavailable to the frontend due to the question DTO gap; resolving it requires a separate contract/schema decision.
2. Demo and Early Access remain blocked until real destinations are authorized.
3. This checkout's E2E wrapper misparses grep expressions with shell metacharacters on Windows; focused Playwright execution succeeded without changing the harness.

## T. STATUS

```text
LANDING_ENTRY_CONVERGENCE_READY
SAFE_TO_COMMIT: YES
COMMIT_CREATED: NO
```
