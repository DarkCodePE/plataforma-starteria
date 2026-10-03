# KAN-90 — Strategic Intent Confirmation Coverage v0.1

**Status:** `IMPLEMENTATION COMPLETE — VALIDATION PASSED`
**Scope:** KAN-74 D1.2 strategic intent confirmation coverage only. No D2 hydration/projection mapping.
**Baseline:** `origin/main` / HEAD `7cc9408616bc4df176475dab36d010d65b7814b4` before implementation.

## Approved product decision

Jira KAN-90 Product Decision — APPROVED (comment 10151) authorizes an explicit confirmation in the existing final review. The generic public CTAs (“Continuar con mi portafolio” / “Crear mi portafolio”) remain navigation/registration actions and do not confirm fields. A single global “Confirmar esta lectura” may confirm only visible, editable/removable strategic-reading fields. `recommended_approach` remains outside that global confirmation and requires an explicit include, edit, or omit decision. Open-question confirmation means that the user confirms these items remain unresolved or require evidence.

## Current and updated flow

```text
Portfolio Entry questions and answers
→ Copilot understanding and provisional handoff
→ existing public review and generic CTA to authentication (no confirmation)
→ authenticated provisional continuation review (same saved session)
→ edit/remove six strategic-reading fields; separately include/edit/omit approach hypothesis
→ explicit “Confirmar esta lectura y continuar” command
→ acceptedFields / correctedFields / rejectedFields persisted on confirmation
→ continue-portfolio operation after confirmation
→ KAN-89 confirmed-brief resolver exposes stored collections unchanged
```

The existing authenticated continuation screen now provides the final review; no page or second confirmation flow is added. The screen renders `understanding`, `desired_outcome`, `decision_to_enable`, `known_context`, `unresolved_context`, and `evidence_or_clarity_needed` with editable text controls. Clearing an existing value records rejection; changed values are corrected; non-empty unchanged values are accepted. Empty/nonexistent source fields remain unconfirmed. Confirmation of open-question items means they are still open, not resolved.

| Field | Visible in final review | Editable/removable | Global confirmation | Persisted / D1 state |
|---|---|---|---|---|
| `desired_outcome` | Yes | Yes | Yes | accepted/corrected/rejected; absent means unconfirmed |
| `understanding` (`understood_need`) | Yes | Yes | Yes | accepted/corrected/rejected; absent means unconfirmed |
| `decision_to_enable` | Yes | Yes | Yes | accepted/corrected/rejected; absent means unconfirmed |
| `known_context` | Yes | Yes | Yes | accepted/corrected/rejected; absent means unconfirmed |
| `unresolved_context` | Yes | Yes | Yes, as still unresolved | accepted/corrected/rejected; absent means unconfirmed |
| `evidence_or_clarity_needed` | Yes | Yes | Yes, as still needed | accepted/corrected/rejected; absent means unconfirmed |
| `recommended_approach` | Yes, separately labeled as a hypothesis, not a decided plan | Yes | No | include → accepted; edit → corrected; omit → rejected; no decision → no terminal state |

## Vocabulary, persistence, and compatibility

The backend closed allowlist now includes the four newly confirmable projection fields, while retaining the existing fields and `understood_need` alias. Rejected keys are allowlisted too. Corrected text lists for open-question fields and the known-context key/value representation are validated and normalized at the existing confirmation boundary. Simultaneous accepted+rejected and corrected+rejected states are rejected with a validation error; state is never silently reconciled.

No schema or data migration was added. Historical confirmations remain valid: missing entries in all three state collections mean `UNCONFIRMED`; no retroactive acceptance is inferred. Generic continuation and handoff presence do not produce confirmation state. Recommendation can be accepted/corrected only from its separate explicit control.

## D1 compatibility and write boundary

KAN-89 remains `GET /api/v1/public/portfolio-entry/sessions/:sessionId/confirmed-brief`, retaining auth, ownership, lifecycle, exact revision, handoff identity/version, and confirmation identity/version checks. D1 returns the persisted accepted/corrected/rejected collections without mapping content, inferring from handoff presence, or constructing `StrategicIntentProjection`. D2 can classify each projection field by collection membership; absence means `UNCONFIRMED`. No KAN-89 resolver semantics are intentionally changed.

Confirmation/continuation stays within Portfolio Entry's bounded context. No writes are introduced to StrategicFront, Challenge, Initiative, Step, Portfolio, First Value, or P3; `PORTFOLIO_CANONICAL_WRITES = 0`.

## Tests and validation

- Focused Portfolio Entry UI tests: 6 passed; the final confirmation payload keeps corrected fields out of `acceptedFields`, and omit records a separate rejection for `recommended_approach`.
- Focused backend Portfolio Entry/router + D1 resolver tests: 27 passed, including rejection of accepted+rejected, corrected+rejected, and accepted+corrected contradictions.
- Full `npm run test:backend` and `npm run test:front`: passed. Front/backend typechecks passed; lint reported `Baseline lint passed`; Vite build passed with existing dynamic-import and chunk-size warnings.
- Directed `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts`: passed (Playwright `test-results/.last-run.json` reports `status: passed`, `failedTests: []`). The helper verifies final review visibility, separate explicit hypothesis inclusion, strategic confirmation request fields, then continuation.
- `git diff --check`: passed after the final contradiction guard edit.
- V2 closure review: scope remains KAN-74 D1.2, no slice status transition or manifest/current-state edit is claimed before merge, and the diff adds no writes outside Portfolio Entry confirmation/continuation.

## Remaining limitations

- Existing build warnings concern shared dynamic imports from the API module and a >500 kB main bundle; no new warning was introduced by this change.
- D1 remains a resolver, and this work does not implement StrategicIntentProjection or D2 hydration.
- The public review's generic CTA intentionally does not persist confirmation; explicit confirmation happens only in the existing authenticated final review.
