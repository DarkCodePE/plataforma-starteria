# ADR-025: Revisión inicial guiada como capa pre-Project (reconciliar `InitialReview` con `Project`/`Step`)

## Status

Proposed — 2026-07-05
Updated — 2026-10-04: el Overview ya no abre Step 0 directamente; pasa por Mission Review (ver "Actualización 2026-10-04").

## Date

2026-07-05

## Context

El PRD *"Revisión inicial guiada de iniciativa + Overview post-confirmación"* introduce
una experiencia **pre-Step-0**: el usuario escribe una idea → la IA genera una revisión
en cards (entendimiento, tipo de reto, crítica, ≤3 preguntas, propuesta mejorada, ruta
Step 0–4) → al confirmar la ruta se crea una iniciativa en Draft + snapshot → **Overview**
→ Step 0 precargado.

El PRD (§18) propone un modelo de datos propio: `InitialReview`, `InitialReviewSnapshot`,
`RouteConfirmation`, **`Initiative`**, **`StepProgress`** y `Step0PrefillFromInitialReview`.

**El problema arquitectónico:** los modelos `Initiative` y `StepProgress` del PRD **se
solapan y renombran** el modelo que ya existe y está en producción:

| PRD (§18) | Ya existe (schema.prisma) |
| --- | --- |
| `Initiative` (id, name, ownerId, challengeType, currentStep, status, challengeId, strategicFrontId) | **`Project`** (id, name, ownerId, status, currentStep, step0Status) + **`InitiativePortfolioMeta`** (challengeId, strategicFrontId, status `en_step_0`, tracking) |
| `StepProgress` (step, contentStatus, validationStatus, isLocked) | **`Step`** (number, name, status `BLOCKED/NOT_STARTED/...`, progress, stepData) |
| Crear Initiative Draft + StepProgress 0–4 | **`ProjectService.createProject`** ya materializa `DEFAULT_STEPS` (Step 1 `NOT_STARTED`, 2–4 `BLOCKED`, `currentStep`, `step0Status=NOT_STARTED`) + `InitiativePortfolioMeta(status=en_step_0)` — **milestone #7, ya en prod** |

Crear un modelo `Initiative`/`StepProgress` paralelo duplicaría el dominio central,
partiría el flujo de Steps del participante (Step 0–4, e2e de referencia) y rompería la
integración portfolio-lead (ADR-023/024, milestone #7). El estado actual: en `main` **no
existe** nada del dominio `InitialReview`; el PR #122 aporta solo el **scaffold frontend
mock** (`front/src/features/initial-review/`, `mockGenerator.ts`, `initialReviewStorage.ts`
en localStorage), sin backend.

Fuerzas en tensión:

- **No duplicar el dominio central.** `Project`/`Step`/`InitiativePortfolioMeta` es la
  fuente de verdad y ya alimenta Steps, portfolio-lead, billing y e2e.
- **La revisión inicial es genuinamente nueva** y pre-oficial: no debe crear un `Project`
  hasta que el usuario confirme la ruta (RB-IR-001/002), debe versionarse y poder quedar
  abandonada sin contaminar el workspace (RB-IR-020).
- **Idempotencia** (RB-IR-017/018): confirmar ruta dos veces no debe crear dos proyectos.
- **Reuso**: `createProject` ya hace exactamente la creación Draft + Steps + meta que el
  PRD pide en los pasos §9.10–§9.13.

---

## Decision

Implementar la revisión inicial como una **capa pre-Project** que, al confirmar la ruta,
**delega en `ProjectService.createProject`** (reusando la materialización del milestone #7).
**No** se crea un modelo `Initiative`/`StepProgress` paralelo: el PRD `Initiative` **es**
`Project`, y el PRD `StepProgress` **es** `Step`.

*(A continuación el razonamiento se estructura con SPARC: Specification → Pseudocode →
Architecture → Refinement → Completion.)*

### S — Specification (qué debe cumplir)

1. **Modelos nuevos, acotados al pre-Project** (no tocan el dominio central):
   - `InitialReview` — la sesión conversacional (status: `draft|processing|generated|updated|route_confirmed|converted_to_initiative|abandoned|failed`), `ownerId`, `originalInput`, `addedContext`.
   - `InitialReviewSnapshot` — versión congelada de la revisión (understanding, `challengeType`, critique, strategicQuestions, improvedProposal, routePreview), `version`, `reviewId`.
   - `RouteConfirmation` — el acto idempotente de aceptar la ruta; produce **como máximo un** `Project`.
2. **Mapeo sobre lo existente** (no renombrar):
   - PRD `Initiative` → `Project` (+ `InitiativePortfolioMeta` para el tracking/portfolio).
   - PRD `StepProgress` → `Step`; `contentStatus`/`validationStatus` se proyectan sobre `Step.status` + `Step.progress` (no columnas nuevas en Step para el MVP).
   - PRD `Initiative.status` (`draft`, `in_step_0`, …) es un **view-model derivado** de `Project.status` + `InitiativePortfolioMeta.status`, **no** una columna nueva.
3. **Campos net-new mínimos en `Project`**: `origin` (`from_initial_review|from_scratch|…`) y `initialReviewSnapshotId` (FK nullable) para trazar la procedencia (RB-IR-019, AC-S0-005).
4. **`challengeType`** (`correction|growth|exploration`) vive en `InitialReviewSnapshot` y se
   arrastra al prefill de Step 0; **no altera** la estructura Step 0–4 (PRD §8, RB-IR-013).
5. **Idempotencia** de `confirm-route` (RB-IR-017/018).
6. **IA** vía el bridge existente (ADR-011/013) con los guardrails del PRD §25 (no validar,
   no inventar evidencia, no aprobar Step 0).

### P — Pseudocode (flujo de confirmación de ruta)

```
POST /api/initial-reviews/:id/confirm-route  { snapshotId }
  → RouteConfirmationService.confirm(reviewId, snapshotId, userId):
      # idempotente: unique(reviewId) — segundo clic devuelve el mismo resultado
      existing = findConfirmation(reviewId)
      if existing?.projectId: return { projectId: existing.projectId, overviewUrl }

      tx:
        snapshot = getSnapshot(snapshotId)                       # congelado
        project = ProjectService.createProject(userId, {         # REUSA milestone #7
           name: snapshot.improvedProposal.suggestedName,
           description: snapshot.improvedProposal.improvedDescription,
           challengeId: review.challengeId ?? undefined,         # opcional (portfolio)
           origin: 'from_initial_review',
           initialReviewSnapshotId: snapshot.id,
           step0Prefill: buildStep0Prefill(snapshot),            # → project.step0Data
        })
        # createProject ya crea Steps 1..4 (1 NOT_STARTED, 2..4 BLOCKED) + meta en_step_0
        upsertConfirmation(reviewId, snapshot.id, project.id, status='initiative_created')
        review.status = 'converted_to_initiative'
      return { projectId: project.id, overviewUrl: `/initiatives/${project.id}/overview` }
```

`buildStep0Prefill(snapshot)` implementa la tabla §13 del PRD (`Step0PrefillFromInitialReview`)
serializada en `Project.step0Data` (Json ya existente) + `pendingQuestions` sin responder.

### A — Architecture (dónde vive cada cosa)

- **Backend, módulo nuevo `backend/modules/initial-review/`**: `initial-review.service.ts`
  (CRUD + versionado), `route-confirmation.service.ts` (idempotente, delega en
  `ProjectService`), `ai-initial-critique.service.ts` (usa el `AiBridge` existente),
  router `/api/v1/initial-reviews/*` (PRD §21).
- **Reuso directo**: `ProjectService.createProject` (extendido con `origin`,
  `initialReviewSnapshotId`, `step0Prefill`), la materialización de Steps y de
  `InitiativePortfolioMeta` (milestone #7), el `AiBridge` (ADR-011/013), storage de
  archivos (ADR-007/012).
- **Prisma**: +3 modelos (`InitialReview`, `InitialReviewSnapshot`, `RouteConfirmation`),
  +2 columnas en `Project` (`origin`, `initialReviewSnapshotId`). Sin cambios en `Step`.
- **Frontend**: la feature `front/src/features/initial-review/` (scaffold del PR #122) se
  conserva; se sustituye `initialReviewStorage.ts` (localStorage) y `mockGenerator.ts` por
  clientes reales contra las APIs. Se añade la pantalla **Overview** (no está en #122).
- **Overview** (`/initiatives/:id/overview`) lee `Project` + `InitiativePortfolioMeta` +
  `InitialReviewSnapshot` — sin modelo nuevo.

### R — Refinement (aristas y compatibilidad)

- **Idempotencia**: `RouteConfirmation @@unique([reviewId])` + transacción; el doble clic
  (RB-IR-017) y el reintento tras fallo (edge §26) devuelven el mismo `projectId`.
- **Abandono sin contaminar** (RB-IR-020): `InitialReview` vive sin `Project` hasta la
  confirmación; una revisión abandonada nunca produce un `Project` huérfano.
- **Reconciliación de estados**: se mantiene `ProjectStatus` + `InitiativePortfolioStatus`
  (ya en prod, ya usados por portfolio/billing). El enum `InitiativeStatus` del PRD se
  implementa como selector derivado en el frontend, no como migración destructiva.
- **`Step` sin cambios**: `contentStatus`/`validationStatus` del PRD se derivan de
  `Step.status`/`Step.progress`. Si más adelante se requiere `validationStatus` explícito,
  será un ADR aparte (no bloquea el MVP).
- **Back-compat**: las 2 columnas nuevas en `Project` son nullable → `prisma db push` sin
  romper datos existentes (consistente con el mecanismo de deploy tag-triggered).
- **Guardrails IA** (§25): el `ai-initial-critique.service` valida el shape
  `AIInitialReviewOutput`, prohíbe marcadores de validación/aprobación y no inventa
  evidencia; rate-limit y cost-cap como en el bridge de Steps (ADR-011).
- **Camino público**: `origin` distingue `from_initial_review` de `from_public_draft`
  (flujo anónimo `/public/start` ya existente), evitando colisión entre ambos onboardings.

### C — Completion (criterios de aceptación del ADR)

El ADR se considera implementado cuando:

1. Confirmar ruta crea **un** `Project` en Draft con Steps 1–4 materializados y
   `InitiativePortfolioMeta.status = en_step_0` (reusando `createProject`), verificado por
   test de integración.
2. `confirm-route` es idempotente (doble llamada → mismo `projectId`), con test dedicado.
3. `Project.origin = from_initial_review` y `initialReviewSnapshotId` apunta al snapshot
   usado (AC-S0-005, RB-IR-019).
4. Step 0 abre precargado desde el snapshot (`step0Data`), sin quedar aprobado
   (`step0Status = NOT_STARTED`, AC-S0-002).
5. No se introduce ningún modelo `Initiative`/`StepProgress` paralelo (revisión de schema).

---

## Consequences

**Positivas**

- Cero duplicación del dominio central; Steps, portfolio-lead (ADR-023/024), billing y el
  e2e de referencia siguen operando sobre `Project`/`Step` sin fork.
- Reuso máximo: el 80 % de la creación (Draft + Steps + meta) ya existe (milestone #7); el
  trabajo real nuevo se concentra en `InitialReview*` + IA + Overview.
- El PR #122 (scaffold FE) encaja como capa de presentación sobre este backend, sustituyendo
  el mock por clientes reales.

**Negativas / costos**

- El frontend debe mapear el vocabulario del PRD (`Initiative`, `StepProgress`,
  `InitiativeStatus`) al del backend (`Project`, `Step`, `ProjectStatus`) vía un adaptador
  — se paga una capa de traducción para no romper el modelo en producción.
- `+3` modelos y `+2` columnas requieren migración (`prisma db push`) y un deploy con tag.

## Alternatives considered

1. **Implementar el modelo `Initiative`/`StepProgress` del PRD tal cual (modelo paralelo).**
   Rechazado: duplica el dominio central, obliga a migrar/duplicar Steps, portfolio y
   billing, y rompe el e2e de referencia. Alto riesgo, alto costo, sin beneficio.
2. **Renombrar `Project`→`Initiative` en todo el repo.** Rechazado: refactor masivo y
   destructivo sobre código en producción (v2.14.x) por una ganancia cosmética de naming.
3. **No crear modelos nuevos; guardar la revisión como Json en `Project`.** Rechazado:
   viola RB-IR-001/002 (la revisión no debe crear iniciativa) y RB-IR-020 (abandono sin
   contaminar), e impide el versionado de snapshots (RB-IR-016).

## Follow-up (WIP derivado — se registra en `feature_list.json` tras landear PR #122)

- **IR-B1** Prisma: `InitialReview` + `InitialReviewSnapshot` + `RouteConfirmation` + `Project.{origin,initialReviewSnapshotId}`.
- **IR-B2** `InitialReviewService` + router `/api/v1/initial-reviews/*` (§21).
- **IR-B3** `AIInitialCritiqueService` (bridge IA + guardrails §25).
- **IR-B4** `RouteConfirmationService` idempotente → `createProject` extendido + `buildStep0Prefill`.
- **IR-F1** Cards faltantes (UnderstandingSummary, ChallengeTypeSuggestion) en Result.
- **IR-F2** Pantalla **Overview** (`/initiatives/:id/overview`).
- **IR-F3** Cablear la feature FE del mock (#122) a las APIs reales.

## Actualización 2026-10-04 — Overview → Mission Review → Step 0

`doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md` §18 (estado: propuesto) pide que `Start` no abra
directamente un formulario de Step 0. Desde el PR #124 (E2E Job-Driven, G1):

- el CTA del Overview es "Revisar mi misión y empezar" y lleva a `/initiatives/:id/mission`
  (Mission Review: qué se quiere mover, contexto heredado, restricciones, capacidad,
  dependencias, quién puede ayudar, qué decisión habilitar);
- Step 0 se abre desde Mission Review, sin cambios en lo que este ADR fija: sigue precargado desde
  el snapshot (`step0Data`) y sin quedar aprobado (punto 4 de Verificación).

Esto reemplaza **AC-OV-006** ("el CTA navega a Step 0"); el test unitario del Overview se actualizó.
El resto del ADR no cambia. **Pendiente:** este ADR sigue *Proposed*; quien lo apruebe debe
confirmar también el reemplazo de AC-OV-006, que deriva de un doc todavía propuesto.

## Related

- Milestone #7 — `ProjectService.createProject` materializa Steps + `InitiativePortfolioMeta` (reuso central).
- ADR-023 / ADR-024 — modelo de equipo unificado y persistencia de mutaciones portfolio-lead.
- ADR-011 / ADR-013 — bridge front↔ai-service (reuso para la crítica IA).
- ADR-019 — landing pública absorbida (`origin=from_public_draft`).
- PR #122 (`feat/public-proposal-editor-ux`) — scaffold FE mock de la revisión inicial.
