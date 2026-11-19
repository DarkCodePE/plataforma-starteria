# KAN-255 — Visual architecture and UX/UI evidence

## Approved visual architecture

Direction: **editorial-technical, calm and enterprise-focused**. The page treats Startería as one connected operating system for initiatives, not as a collection of feature cards. Its memorable detail is the continuous transformation thread: dispersed inputs enter Startería, pass through one four-stage product demonstration, bifurcate into Team/Fab during execution and return as evidence and reusable learning.

1. **Hero / transformation:** category, approved value proposition, commercial CTA and a connected input → Startería → output composition.
2. **Startería in action:** the only product demonstration, with four keyboard-navigable stages: Clarify, Connect, Execute and Learn.
3. **Execution choice:** Team and Fab appear only inside Execute; both converge on evidence, result and continuity. Fab is explicitly described as complementary, without claiming certified automatic integration.
4. **Business impact:** four compact outcomes in a single rail, without invented metrics.
5. **Friction comparison:** compact today/with Startería rows after the product has been explained.
6. **Commercial conversion:** one first-conversation promise, keeping the configured booking destination and avoiding automatic pilot claims.

Target viewports: 390×844, 768×900, 1024×900 and 1440×900.

## Component disposition

| Classification | Element | Decision |
| --- | --- | --- |
| KEEP | `StarteriaMark`, shared `Button`, configured commercial destination | Preserve brand, design-system interaction and current commercial routing. |
| ADAPT | Header, hero, interactive story, impact, pain comparison, final CTA, footer | Reframe all sections around a single initiative-development narrative and reduce text. |
| REMOVE | `StarteriaProductPreview`, repeated process/use-case/trust sections, large pain cards, Portfolio Entry access | Remove duplicate demonstrations, card repetition and the unauthorized public-entry path from `/`. |
| NEW | `TransformationFlow`, four-stage roving tabs, Team/Fab execution split | Make transformation, choice of execution capacity and learning continuity visible. |

Unused legacy `HeroTunnel` and `ConceptMap` files were left untouched because they are outside the active landing composition and deleting them is not required by KAN-255.

## Before / after review

| Before | After |
| --- | --- |
| Three-stage story plus a second repeated product preview | One protagonist demonstration with four navigable stages |
| Independent feature/impact/pain/process cards | One connected transformation and compact rails/rows |
| Platform and Fab described as separate cards | Team/Fab choice occurs at the execution moment and reconverges on evidence |
| Portfolio Entry still part of the public landing's historic authority | No `/public/start` access or lead-capture form on `/`; legacy route remains untouched |
| Copy repeated the same journey and included an invented percentage in a mock preview | Shorter narrative, conceptual fictitious example and no percentage/ROI claims |

## Skill application

- `frontend-design-direction`: explicit editorial-technical direction, one memorable transformation thread, no ornamental gradients/blobs, purposeful motion only, and rendered evidence at every contracted viewport.
- `design-system`: reused Startería semantic tokens, focus treatment, shared button and mark; limited custom styling to the public narrative surface.
- `frontend-patterns`: semantic sections, stable data-driven lists, isolated interactive story, controlled roving-tab state and no new dependency.
- `verification-loop`: not installed in the available skill catalog. Its intended role was covered by tests-first, focused/full regression checks, Playwright, Lighthouse and manual rendered review; this is recorded rather than claiming the skill was used.

## Artifacts

- `after-390x844.png` — mobile full-page composition.
- `after-768x900.png` — tablet/narrow full-page composition.
- `after-1024x900.png` — compact desktop full-page composition.
- `after-1440x900.png` — wide desktop full-page composition.
- `before-390x844.png` and `before-1440x900.png` — pre-redesign reference captures.
- `design-evidence.json` — machine-checkable rendered-finish record.

The after captures intentionally open `#fab`, so the unique product demonstration shows the approved Team/Fab execution split rather than fabricating live product data.
