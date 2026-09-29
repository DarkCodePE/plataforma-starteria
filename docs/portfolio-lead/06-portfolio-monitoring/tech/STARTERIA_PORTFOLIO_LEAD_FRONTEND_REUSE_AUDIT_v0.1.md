# Starteria — Portfolio Lead Frontend Reuse Audit v0.1

**Estado:** AUDIT / no es Technical Design / no autoriza implementación

**Branch auditada:** `feat/portfolio-monitoring-product-definition`

**HEAD auditado:** `82724b2dfa76645603478e5748be5bab319f4f08`

**Scope:** `front/src/` y sus dependencias actuales, contrastados con el Prototype Spec, el E2E Testing Harness, Steps 1–5 del vertical Portfolio Lead → Initiative Portfolio Monitoring & Intervention, el Core vigente, Portfolio Entry, Design System y Handoff.

**Regla de lectura:** `REUSE` identifica una superficie conectada y compatible; `ADAPT` identifica una superficie reutilizable con cambio de composición/copy/fixture; `NEW` identifica una capacidad no encontrada; `EXISTS_BUT_CONFLICTS` identifica código existente cuya semántica o modelo mental contradice el prototipo; `LEGACY_DO_NOT_REUSE` identifica una ruta o superficie que no debe gobernar el prototipo nuevo.

## A. Executive Summary

El frontend no parte de cero. Hay seis bloques reutilizables importantes:

1. `front/src/features/portfolio-lead/bootstrap/` ya implementa un flujo de Bootstrap conectado al contexto de continuidad de Portfolio Entry: anchor/objetivo, incorporación de work items por texto/import/manual, análisis, revisión de mutaciones y publicación de una primera lectura.
2. `front/src/app/pages/PortfolioLeadHomePage.tsx` ya compone Portfolio Home, atención, siguiente acción, decisiones, actividad, lecturas de frentes y Copilot.
3. `front/src/features/portfolio-lead/domain/` y `front/src/app/hooks/usePortfolioData.ts` ya modelan Front, Challenge/Reto, Initiative, overlaps y executive outputs.
4. `front/src/features/portfolio-handoff/` y `front/src/app/pages/HandoffInvitationPage.tsx` implementan la experiencia existente de invitación, autenticación/claim, Accept, Reject y Start.
5. `front/src/features/copilot/` dispone de Drawer/Shell y cliente de Copilot.
6. `front/src/app/components/design-system/` dispone de primitives y patrones para revisión, provenance, atención, empty states, decisiones y overlays.

El principal gap no es la ausencia de UI aislada, sino la composición del journey. La ruta activa de Portfolio Lead sigue presentando primero un workspace ontológico (`Frentes estratégicos`, `Retos`, `Iniciativas`) y la pantalla `/portfolio/iniciar` ofrece acciones de creación/importación antiguas. El flujo nuevo de intención → contexto → interpretación sí existe parcialmente, pero está conectado principalmente a la llegada desde Portfolio Entry mediante `portfolioEntryContinuationId`, no a una primera visita directa de Portfolio Lead.

La recomendación es construir primero un prototipo reproducible alrededor del bloque Bootstrap existente y fixtures controlados, sin crear backend nuevo. El primer slice debe probar First Value con la ruta de continuidad y una variante directa/mock de entrada; después se debe conectar visualmente la revisión de estructura, ownership/Handoff y Home activa. No conviene comenzar por remodelar la Home ni por reutilizar `InitiativeOverviewPage`.

## B. Current Portfolio Lead frontend map

### B.1. Routing y layouts activos

La autoridad de routing está en `front/src/app/routes.ts`:

```text
/portfolio                         PortfolioLeadLayout
/portfolio/inicio                  PortfolioLeadHomePage
/portfolio/iniciar                  PortfolioLeadStartPage
/portfolio/frentes-estrategicos     PortfolioLeadStrategicFrontsPage
/portfolio/retos                    PortfolioLeadChallengesPage
/portfolio/iniciativas              PortfolioLeadInitiativesPage
/portfolio/decisiones               PortfolioLeadDecisionsPage
/portfolio/salida-ejecutiva         PortfolioLeadExecutiveOutputPage
/portfolio/sponsors                 PortfolioLeadSectionPage
/portfolio/reportes                 PortfolioLeadSectionPage
/portfolio/empresa                  CompaniesPage
/portfolio/framing/:stateId         StrategicFramingWorkspacePage
/handoff/invitations/:token         HandoffInvitationPage
/initiatives/:projectId/overview    InitiativeOverviewPage
/projects/:projectId/step/0..4      Step 0–4 operativo
/public/start                       PublicStartPage / PortfolioEntryExperience
/public/provisional-continuation    AuthenticatedProvisionalContinuationPage
```

`front/src/app/layout/PortfolioLeadLayout.tsx` protege el área con `portfolio:read`, monta `WorkspaceSwitcher` y presenta la navegación de `Inicio`, `Frentes estratégicos`, `Retos`, `Iniciativas`, `Actores clave` y `Reportes y decisiones`. También existe el camino de entrada scoped desde Portfolio Entry mediante `portfolioEntryContinuationId` y `usePortfolioHomeEntryContext`.

`front/src/app/layout/AppLayout.tsx` mantiene el workspace de iniciativas separado y ofrece un `WorkspaceSwitcher` hacia Portafolio. Esto protege la frontera de rol, pero deja dos modelos mentales visibles: el operativo de iniciativas/Steps y el ejecutivo de Portfolio Lead.

### B.2. Portfolio Entry → Portfolio Bootstrap

`front/src/features/portfolio-entry/public/PortfolioEntryExperience.tsx` y `front/src/features/portfolio-entry/public/portfolioEntryPublicService.ts` implementan la entrada pública, sesión, handoff de contexto y continuación. `front/src/app/pages/public/AuthenticatedProvisionalContinuationPage.tsx` selecciona/continúa un contexto y consume `continuePortfolioEntryToPortfolio`.

El backend de continuación construye la ruta `/portfolio/inicio?portfolioEntryContinuationId=...` en `backend/modules/portfolio-entry-continuation/portfolio-entry-continuation.service.ts`. En Home, `PortfolioLeadHomePage` lee ese query param, carga `usePortfolioHomeEntryContext` y, cuando está listo, monta `PortfolioBootstrapHome` con `usePortfolioBootstrap`.

Este es el camino activo más cercano al nuevo vertical. No debe duplicarse con otra implementación de entrada pública.

### B.3. Bootstrap / work intake / first reading

`front/src/features/portfolio-lead/bootstrap/components/PortfolioBootstrapHome.tsx` distingue estados de proyección `HOME_A`, `HOME_B`, `HOME_C`, `HOME_D` y `HOME_E` mediante `projectBootstrapHome`.

Capacidades observadas:

- anchor/resultado deseado y contexto faltante;
- edición y confirmación del punto de partida;
- pegar work items;
- subir/confirmar importación;
- añadir work item manual;
- declarar que no existe trabajo previo;
- editar/eliminar work items;
- analizar trabajo;
- revisar, confirmar, corregir, rechazar o dejar pendiente una mutación propuesta;
- publicar una primera lectura.

El estado y las transiciones están repartidos entre:

- `front/src/features/portfolio-lead/bootstrap/state/usePortfolioBootstrap.ts`;
- `front/src/features/portfolio-lead/bootstrap/projection/bootstrapHomeProjection.ts`;
- `front/src/features/portfolio-lead/bootstrap/domain/homeState.ts`;
- `front/src/features/portfolio-lead/bootstrap/domain/anchor.ts`;
- `front/src/features/portfolio-lead/bootstrap/domain/canonicalization.ts`;
- `front/src/features/portfolio-lead/bootstrap/services/portfolioBootstrapClient.ts`.

El backend correspondiente está montado en `/api/v1/portfolio-bootstrap` por `backend/app.ts`, con router/servicio en `backend/modules/portfolio-bootstrap/`. Esto permite probar gran parte de P1–P3 con estado real; el caso NovaGrowth completo y las variantes de segunda visita todavía requieren fixtures o datos de prueba controlados.

### B.4. Portfolio Home actual

`front/src/app/pages/PortfolioLeadHomePage.tsx` compone una Home mixta:

- `PageHeader` con “¿Qué requiere atención hoy?”;
- metadata de frentes, bloqueos y decisiones;
- `ContextSummary` de Frentes, Retos, Iniciativas y Decisiones;
- `EmptyState` de arranque;
- `PortfolioAttentionList`;
- `NextAction`;
- decisiones pendientes;
- `StrategicObjectivesOverview`;
- `PortfolioSummaryCards`;
- actividad reciente;
- `InlineInsight`;
- `PortfolioCopilotDrawer`/`PortfolioCopilotLauncher`.

El modelo se obtiene de `getHomeCommandCenterModel` y `getPortfolioHomeExperienceModel` en `front/src/features/portfolio-lead/domain/selectors.ts` y se alimenta de `PortfolioLeadContext`/`usePortfolioData`.

Conclusión: hoy es una mezcla de dashboard/inventario, centro de atención, navegación ejecutiva y contexto secundario. La dirección objetivo necesita una composición más estrecha: Frentes compactos + Lecturas Starteria + Necesita de ti + Copilot contextual.

### B.5. Strategic Front / Challenge / Initiative / Results

- `front/src/app/pages/PortfolioLeadStrategicFrontsPage.tsx`: lista, filtros, creación/edición y cambios de estado de Frentes; usa `portfolioService` y componentes locales de cards/drawers.
- `front/src/app/pages/PortfolioLeadChallengesPage.tsx`: lista filtrable de Retos, activation/readiness, owner/sponsor, invitaciones/equipo, solapamientos y drawers de edición; es una superficie rica pero ontología-first.
- `front/src/app/pages/PortfolioLeadInitiativesPage.tsx`: lista de iniciativas, progreso por Step, owner, sponsor, blockers, acciones y drawer ejecutivo/operativo.
- `front/src/app/pages/PortfolioLeadDecisionsPage.tsx`: delega en `PortfolioLeadReportsDecisionsExperience` con `basePath="/portfolio/decisiones"`.
- `front/src/app/pages/PortfolioLeadExecutiveOutputPage.tsx`: muestra un executive output concreto, iniciativa, Reto, Frente, Step alcanzado, equipo, señales, recomendación y salida descargable.
- `front/src/app/components/portfolio/InitiativeExecutiveDetailDrawer.tsx` y `InitiativeExecutiveComponents.tsx`: reúnen detalle ejecutivo, status, timeline, deliverables y recommendation panel.

Los datos de estas superficies vienen de `front/src/app/hooks/usePortfolioData.ts` y `front/src/app/services/portfolioService.ts`, que llaman `/portfolio/strategic-fronts`, `/portfolio/challenges/:id/initiatives`, `/portfolio/challenges/:id/overlaps` y `/portfolio/challenges/:id/executive-outputs`.

### B.6. Copilot

`front/src/features/copilot/components/PortfolioCopilotDrawer.tsx`, `PortfolioCopilotShell.tsx`, `CopilotConversation.tsx`, `CopilotComposer.tsx`, `useCopilotConversation.ts`, `useCopilotExecution.ts` y `http-copilot-client.ts` son reutilizables.

La integración de Home ya ofrece Copilot contextual de Portfolio, pero la auditoría no encontró un modo implementado explícito para cada estado `SETUP`, `STRUCTURE REVIEW`, `ACTIVE`, `FRONT`, `CHALLENGE`, `INITIATIVE` y `RESULTS` del Prototype Spec. Esa distinción debe tratarse como `ADAPT`, no como contrato nuevo en esta fase.

## C. P0–P13 reuse matrix

| Surface | Existing | Classification | Main files | Gap | Risk |
|---|---|---|---|---|---|
| P0 Primera visita | `/portfolio/iniciar` ofrece Crear frente, Preparar importación, Crear reto e Ir a iniciativas; `PortfolioLeadIntroPage` existe pero no está registrado en `routes.ts` | `EXISTS_BUT_CONFLICTS` | `routes.ts`; `PortfolioLeadStartPage.tsx`; `PortfolioLeadStartExperience.tsx`; `PortfolioLeadIntroPage.tsx` | Falta el CTA dominante `Preparar mi espacio` y el modelo intención-first; importación compite como job independiente | Alto: perpetúa Frente/Reto/Initiative-first y duplica entry mental |
| P1 Definir objetivo | Bootstrap tiene anchor/outcome statement, editor, contexto faltante y confirmación | `ADAPT` | `PortfolioBootstrapHome.tsx`; `anchor.ts`; `usePortfolioBootstrap.ts`; `portfolioBootstrapClient.ts` | Solo aparece por continuidad a `/portfolio/inicio`; falta entrada directa reproducible desde P0 | Medio: se puede crear una segunda ruta si no se reutiliza query/Bootstrap |
| P2 Añadir trabajo existente | Bootstrap HOME_B/HOME_C permite paste, upload/import, manual, no-existing-work y edición | `REUSE` | `PortfolioBootstrapHome.tsx`; `portfolioBootstrapClient.ts`; `portfolio-bootstrap` backend | Copy/prototipo debe alinearse con “no necesitas ordenar la información”; intake actual tiene más opciones técnicas | Medio: upload/import puede dominar sobre la intención |
| P3 First Analytical Value | HOME_D/HOME_E, analyzer determinista, proposed mutations, first reading publish | `ADAPT` | `bootstrapHomeProjection.ts`; `PortfolioBootstrapHome.tsx`; `portfolio-bootstrap.analyzer.ts`; `PortfolioBootstrapReadingPublish...` | Verificar que la lectura priorice insight/relación y no solo inventario; NovaGrowth y máximo 2–3 señales no están fijados como fixture de prototipo | Alto: primera lectura puede parecer resumen de datos |
| P4 Revisar relaciones | Revisión de mutaciones propuesta/corregir/rechazar; Challenge page permite editar estructura canónica | `EXISTS_BUT_CONFLICTS` | `canonicalization.ts`; `ProposedMutationCard.tsx`; `PortfolioLeadChallengesPage.tsx`; `PortfolioLeadStrategicFrontsPage.tsx` | Falta vista relation-first objetivo → grupos → iniciativas con mover/renombrar/dividir/fusionar antes de canonicalizar | Alto: reutilizar Challenge CRUD publicaría ontología demasiado pronto |
| P5 Confirmar responsables | Initiative drawer y Challenge activation tienen owner/status/team controls | `EXISTS_BUT_CONFLICTS` | `PortfolioLeadInitiativesPage.tsx`; `PortfolioLeadChallengesPage.tsx`; `portfolioService.ts`; `ChallengeActivationOwnerStatus.tsx` | No se verificó una vista de ownership del setup con `OWNER_MENTIONED/DETECTED/CONFIRMED`, pendientes y readiness parcial | Alto: confundir dato detectado, asignación y ownership formal |
| P6 Handoff transition | Handoff real implementa invitation, auth/claim, Accept, Reject/reason y Start | `REUSE` para frontera, `ADAPT` para bridge | `HandoffInvitationPage.tsx`; `HandoffShell.tsx`; `handoffInvitationService.ts`; `routes.ts` | Falta el puente visible P5 → “Preparar asignaciones”; no duplicar el flujo token-scoped | Alto: duplicar Accept/Reject/Start o convertir owner confirmado en Start |
| P7 First Active Home | `/portfolio/inicio` y Home command center; Bootstrap first reading | `ADAPT` | `PortfolioLeadHomePage.tsx`; `PortfolioLeadHomeExperience.tsx`; `selectors.ts`; `PortfolioBootstrapHome.tsx` | No hay guide completion/first-active-home milestone explícito; Home actual mezcla inventario y atención | Alto: presentar setup incompleto como monitoring activo |
| P8 Second Visit / Monitoring | Attention list, next action, pending decisions, recent activity, selectors y estados de iniciativas | `ADAPT` | `PortfolioLeadHomePage.tsx`; `PortfolioLeadHomeExperience.tsx`; `selectors.ts`; `usePortfolioData.ts` | Debe simular paso de tiempo, cambios materiales, blocker/decision/attention relevance y distinguir WAITING de ATTENTION | Alto: datos actuales no garantizan historial/delta o relevancia temporal |
| P9 Front Detail | `/portfolio/frentes-estrategicos` con cards, stats, edit drawer y actions | `ADAPT` | `PortfolioLeadStrategicFrontsPage.tsx`; `StrategicFrontCard`; `portfolioService.ts` | Falta detalle orientado a “cómo movemos el objetivo” con lectura agregada, señales y navegación de monitoring | Medio/alto: reutilizar CRUD como detail puede mezclar comandos y lectura |
| P10 Challenge Detail | `/portfolio/retos` y cards/drawers; `/retos/:challengeId` es detalle de participante, no de Portfolio Lead | `EXISTS_BUT_CONFLICTS` | `PortfolioLeadChallengesPage.tsx`; `ChallengeCard.tsx`; `ParticipantChallengeDetailPage.tsx` | No hay route dedicada de Challenge Detail para Portfolio Lead con gaps/overlap/evidence/decisions sin activation CRUD | Alto: usar ParticipantChallengeDetailPage cruza roles y modelo operativo |
| P11 Initiative Executive Overview | `/portfolio/iniciativas`, `InitiativeExecutiveDetailDrawer`, `PortfolioLeadExecutiveOutputPage` | `REUSE` con adaptación | `PortfolioLeadInitiativesPage.tsx`; `InitiativeExecutiveDetailDrawer.tsx`; `InitiativeExecutiveComponents.tsx`; `PortfolioLeadExecutiveOutputPage.tsx` | Falta route/fixture explícita para overview ejecutivo del prototipo; no usar `/initiatives/:projectId/overview` como Portfolio Lead | Alto: `InitiativeOverviewPage` introduce Step 0–4 y está fuera del boundary visual V2 auditado |
| P12 Results / Decision | `/portfolio/decisiones`, `/portfolio/salida-ejecutiva`, executive outputs y reports experience | `ADAPT` | `PortfolioLeadDecisionsPage.tsx`; `PortfolioLeadReportsDecisionsExperience.tsx`; `PortfolioLeadExecutiveOutputPage.tsx`; `portfolioService.ts` | Falta separar claramente evidence/result/impact, tabs y no-data temprano del Prototype Spec | Medio: actuales outputs pueden parecer resultado definitivo |
| P13 Copilot Drawer | Drawer/Shell/client, launcher en Home, Copilot backend | `REUSE` de primitives, `ADAPT` de contexto | `PortfolioCopilotDrawer.tsx`; `PortfolioCopilotShell.tsx`; `useCopilotConversation.ts`; `http-copilot-client.ts`; `copilot.router.ts` | Falta mapping explícito del contexto P0–P12 y fixture determinista para el prototipo | Medio/alto: chat genérico o recomendaciones sin provenance |

## D. Navigation assessment

La navegación actual es:

```text
Portfolio Lead
├── Inicio
├── Frentes estratégicos
├── Retos
├── Iniciativas
├── Actores clave
└── Reportes y decisiones
```

El workspace switcher añade el salto a `Mis iniciativas`/`/dashboard`. El routing público mantiene `/public/start`, `/public/provisional-continuation` y `/public/start/initiative`.

Comparación con el objetivo:

```text
Objetivo de prototipo:
Inicio · Portafolio · Resultados · + Crear/importar · Copilot transversal

Actual:
Inicio · Frentes · Retos · Iniciativas · Actores · Reportes/decisiones
```

Hallazgos:

- `Inicio` existe y es reutilizable.
- No hay una ruta separada `/portfolio/resultados`; `Reportes y decisiones` resuelve parte de esa necesidad mediante `/portfolio/decisiones` y `/portfolio/salida-ejecutiva`.
- `+ Crear/importar` no existe como acción transversal única. `/portfolio/iniciar` es una pantalla antigua de opciones.
- `Copilot` aparece en Home, no como navegación transversal global.
- `PortfolioLeadIntroPage` no está en `appRoutes`, aunque `AppLayout.tsx` contiene una navegación hacia `/portfolio-lead/intro`; esto es una ruta huérfana/legacy que no debe reutilizarse para el prototipo.
- `/initiatives/:projectId/overview` y `/projects/:projectId/step/*` siguen accesibles desde el workspace operativo. No deben convertirse en la continuación natural del journey Portfolio Lead.

No se elimina ninguna ruta en este audit. El prototipo debe usar una navegación controlada/fixture o una entrada acotada, manteniendo las rutas existentes intactas.

## E. Home assessment

### E.1. Clasificación actual

La Home actual es **D. mezcla**:

- **dashboard/inventario:** `ContextSummary`, `PortfolioSummaryCards`, counts de Frentes/Retos/Iniciativas/Decisiones;
- **centro de atención:** `PortfolioAttentionList`, `NextAction`, pending decisions;
- **navegación ejecutiva:** `StrategicObjectivesOverview`, links a Front/Challenge/Import/Report;
- **lectura contextual:** `InlineInsight`, recent activity;
- **Copilot:** launcher/drawer contextual.

### E.2. Reutilizar

- `PortfolioAttentionList` para `Necesita de ti`, sujeto a filtrado de acciones reales del Portfolio Lead.
- `NextAction` como patrón de siguiente intervención, no como wizard permanente.
- `InlineInsight` para Lecturas Starteria.
- `StrategicObjectivesOverview`/`StrategicFrontExecutiveCard` como fuente de Frentes compactos, reduciendo su densidad.
- `PortfolioCopilotDrawer` y `PortfolioCopilotLauncher`.
- `EmptyState`, `PageHeader`, `ContextSummary`, `Badge` y `DomainStatusBadge`.

### E.3. Simplificar o mover

- `PortfolioSummaryCards`: mover a detalle o conservar solo las métricas que tengan fuente defendible.
- `RecentActivitySection`: usar solo en segunda visita/Monitoring, no dominar First Active Home.
- `Decisiones pendientes`: mantener cuando exista acción humana, pero no como inventario genérico.
- metadata global de counts: reducir para que el primer valor sea insight > estructura > inventario.

### E.4. No usar como modelo del prototipo

- El `PageHeader` actual con primary action `Crear nuevo frente` como CTA de primera visita.
- La rail `PortfolioPrimaryActionRail` que ofrece crear Frente/importar/decisiones/revisar Retos como entry hierarchy.
- cualquier Home vacía que comunique “0 iniciativas” en lugar de posibilidad de valor.

## F. Design System reuse

### Primitives disponibles

En `front/src/app/components/ui/` están disponibles `button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `dialog.tsx`, `drawer.tsx`, `popover.tsx`, `accordion.tsx`, `progress.tsx`, `tabs.tsx`, `alert.tsx`, `skeleton.tsx`, `tooltip.tsx`, `select.tsx` y `form.tsx`.

### Patrones disponibles

En `front/src/app/components/design-system/patterns/` están disponibles:

- `PageHeader.tsx`;
- `ContextSummary.tsx`;
- `InlineInsight.tsx`;
- `NextAction.tsx`;
- `AttentionItem.tsx`;
- `EmptyState.tsx`;
- `AISuggestionPanel.tsx`;
- `ProposedMutationCard.tsx`;
- `ReviewActions.tsx`;
- `ReviewDisposition.tsx`;
- `ReviewSummary.tsx`;
- `HumanReviewBlock.tsx`;
- `DecisionSupportSummary.tsx`.

`front/src/app/components/design-system/status/DomainStatusBadge.tsx` ya contiene estados de workflow/review como `unreviewed`, `requires_review`, `confirmed`, `rejected` y `superseded`, útiles para provenance y revisión humana.

`front/src/app/components/portfolio/PortfolioLeadPageElements.tsx` aporta `PortfolioLeadBreadcrumbs`, `PortfolioLeadContextStrip` y `PortfolioLeadEmptyState`.

Recomendación: construir el prototipo con estos primitives/patrones, especialmente `AISuggestionPanel` + `ReviewActions` + `DomainStatusBadge` para P3/P4/P5, y `Drawer`/`Dialog` para rationale, owner review y Copilot. No crear un nuevo Design System component en esta fase.

## G. Handoff integration boundary

El límite correcto comienza después de ownership confirmado y se alcanza mediante una transición explícita:

```text
P5 Confirmar responsables
        ↓
Preparar asignaciones  [bridge futuro del prototipo]
        ↓
Handoff existente
        ↓
/handoff/invitations/:token
        ↓
claim/auth continuation si aplica
        ↓
Accept / Reject + reason
        ↓
Portfolio Lead response
        ↓
Activation Overview
        ↓
Start explícito
```

La UI existente está en:

- `front/src/app/pages/HandoffInvitationPage.tsx`;
- `front/src/features/portfolio-handoff/components/HandoffShell.tsx`;
- `front/src/features/portfolio-handoff/services/handoffInvitationService.ts`.

El servicio ya expone `readHandoffInvitation`, `claimHandoffInvitation`, `acceptHandoffAssignment`, `rejectHandoffAssignment`, `startAssignedWork` y persistencia del token pendiente. El backend monta los routers de Handoff en `backend/app.ts` y conserva eventos/projection en `backend/modules/portfolio-handoff/`.

**Boundary no negociable:** `owner confirmado != assignment accepted != initiative started`. No reutilizar `InitiativeOverviewPage` como atajo para P6: esa página es la transición del Initiative Owner hacia Step 0–4 y su CTA es `Empezar Step 0`.

## H. Mock vs real-data recommendation

| Capability | Recommendation for E2E prototype | Evidence |
|---|---|---|
| Auth/route shell | Real only where needed | `PortfolioLeadLayout`, `AppLayout`, `routes.ts` |
| Portfolio Entry context | Real for one happy path; mock fallback for reproducibility | `usePortfolioHomeEntryContext`, `portfolioEntryPublicService.ts` |
| Anchor / objective | Real Bootstrap state or deterministic fixture | `usePortfolioBootstrap`, `portfolioBootstrapClient.ts`, `anchor.ts` |
| NovaGrowth work pack | Fixture/mock initially | `bootstrap/testing/bootstrapFixtures.ts`; no NovaGrowth-specific product fixture found |
| Paste/upload UI | Reuse real Bootstrap controls; mock upload/extraction result | `PortfolioBootstrapHome.tsx`; `portfolioBootstrapClient.ts` |
| First reading | Deterministic analyzer/fixture | `portfolio-bootstrap.analyzer.ts`; `projectBootstrapHome` |
| Relationship editing | Mock controlled state first | No single active Portfolio Lead relation-review surface matches P4 |
| Ownership confirmation | Mock controlled state first | Existing owner controls are distributed across Initiative/Challenge UI |
| Handoff | Reuse real Handoff boundary or fixture its token states | `HandoffShell.tsx`; `handoffInvitationService.ts` |
| First Active Home | Reuse selectors/components with fixture data | `PortfolioLeadHomePage.tsx`; `domain/mockData.ts`; selectors |
| Second Visit deltas | Fixture/mock history | No dedicated frontend historical-delta model found |
| Results/Decision | Existing executive output data where available; mock early no-impact state | `PortfolioLeadReportsDecisionsExperience.tsx`; `PortfolioLeadExecutiveOutputPage.tsx` |
| Copilot | Fixture responses or mocked client | `http-copilot-client.ts`; `PortfolioCopilotDrawer.tsx` |

No backend, schema, event or migration is necessary to prove the first prototype slices if route-level fixture injection is kept explicit and disposable.

## I. Legacy / conflicting surfaces

### I.1. Ontology-first entry

`PortfolioLeadStartExperience.tsx` currently tells the user to choose a priority/front, import initiatives, create a challenge or go to initiatives. Its context strip explicitly describes `Frente → Reto → Activación → Iniciativas → Decisiones`. This conflicts with the Prototype Spec entry of “Preparar mi espacio” → “¿Qué quieres conseguir o tener bajo control?”. Classify as `EXISTS_BUT_CONFLICTS`; do not use its copy or action hierarchy as authority for the prototype.

### I.2. Existing Portfolio CRUD

`PortfolioLeadStrategicFrontsPage.tsx`, `PortfolioLeadChallengesPage.tsx` and `PortfolioLeadInitiativesPage.tsx` are connected active surfaces, but they assume that Front, Challenge and Initiative entities already exist. They are useful for later detail/CRUD reuse, not as the first-value setup sequence.

### I.3. Participant Challenge detail

`front/src/app/pages/ParticipantChallengeDetailPage.tsx` is routed at `/retos/:challengeId` outside the PortfolioLeadLayout. It is not a Portfolio Lead monitoring detail and must not be treated as P10 reuse.

### I.4. Initiative/Steps path

`front/src/app/pages/InitiativeOverviewPage.tsx`, `ProjectHomePage.tsx`, `Step0Page.tsx`–`Step4Page.tsx` and `EvidenciasPage.tsx` are the operational Initiative Owner surface. The current state explicitly says Initiative Overview/Steps are outside the migrated V2 visual boundary. They are `LEGACY_DO_NOT_REUSE` for the Portfolio Lead prototype except as a read-only external boundary reached through existing Handoff/overview semantics.

### I.5. Home inventory density

The current Home has both the desired attention patterns and legacy inventory/creation patterns. Reusing it wholesale would make the prototype inherit the wrong hierarchy. Reuse components/selectors selectively, not the complete composition.

## J. Missing capabilities

The following were **NOT FOUND** as a coherent active frontend surface:

- direct Portfolio Lead first visit whose primary CTA is `Preparar mi espacio`;
- a temporary five-step guide shared across P1–P5 and removed after first active Home;
- direct relation-first review surface objective → proposed groups → initiatives;
- explicit ownership review surface distinguishing mentioned/detected/proposed/confirmed;
- P5 → `Preparar asignaciones` bridge that hands off a partial-ready set without reimplementing Handoff;
- explicit first-active-home completion state and second-visit mode switch;
- frontend historical delta model for `Qué cambió`;
- a dedicated Portfolio Lead Challenge Detail route with monitoring facts rather than Challenge activation CRUD;
- a unified `/portfolio/resultados` route matching the Prototype Spec tabs;
- explicit Copilot mode/context mapping for all P0–P13 states;
- NovaGrowth fixture wired to the production route without changing backend semantics.

## K. Recommended prototype build sequence

The P0–P13 labels should not be implemented as thirteen independent product pages. The dependency-aware sequence is:

### Slice A — First Value

Use the existing Portfolio Entry → Bootstrap path, with a deterministic NovaGrowth fixture and a controlled direct-entry harness variant.

Reuse:

- `PortfolioBootstrapHome` anchor and work intake;
- `PortfolioBootstrapHome` first reading states;
- existing Design System review/provenance patterns;
- existing Copilot Drawer as a contextual mock.

Prove first: intention comprehension, paste/import without taxonomy, first analytical value and provenance.

### Slice B — Structure

Add only a prototype-level controlled relation review surface around the Bootstrap proposed reading. Reuse `ProposedMutationCard`, `ReviewActions`, `DomainStatusBadge` and existing data types where possible. Do not publish new canonical Challenge semantics and do not alter `PortfolioLeadChallengesPage` yet.

Prove: objective → group → initiative comprehension, editing, rationale, simple-case no-Reto path and human confirmation.

### Slice C — Ownership / Handoff bridge

Use a controlled owner-review fixture for detected/confirmed/pending states. Then link `Preparar asignaciones` to the existing Handoff route/service boundary. Do not copy `HandoffShell` logic into the setup surface.

Prove: owner vs assignment vs Start, partial readiness, and correct Handoff handoff.

### Slice D — Active Home

Compose a prototype Home variant from existing attention, insight, front-card, decision and Copilot components. Keep the existing `/portfolio/inicio` route untouched until the experiment proves the target hierarchy.

Prove: first active Home gives value without invented results and guide disappears at the correct point.

### Slice E — Monitoring

Run a second fixture/time state through the same Home composition. Reuse `PortfolioAttentionList`, `InlineInsight`, `NextAction`, activity and decision patterns; add only disposable fixture mapping for material changes, attention and waiting.

Prove: user identifies intervention without opening every Initiative and distinguishes WAITING from ATTENTION.

### Slice F — Results / Decision

Reuse executive output and decision components with early/no-impact fixtures. Keep evidence, result and impact separated. Do not introduce a new read model or event for the prototype.

Prove: decision context, evidence comprehension and authority clarity.

This sequence lets Slice A generate the earliest meaningful learning and postpones the highest-risk Home and domain-boundary decisions.

## L. Files likely to be touched in future implementation

These are candidates only; this audit does not edit them:

- `front/src/app/routes.ts` — only if a disposable prototype route is approved;
- `front/src/app/pages/PortfolioLeadHomePage.tsx` — only after the prototype composition is validated;
- `front/src/app/pages/PortfolioLeadStartPage.tsx` and `front/src/app/components/portfolio/PortfolioLeadStartExperience.tsx` — to adapt entry copy/action hierarchy;
- `front/src/features/portfolio-lead/bootstrap/components/PortfolioBootstrapHome.tsx`;
- `front/src/features/portfolio-lead/bootstrap/projection/bootstrapHomeProjection.ts`;
- `front/src/features/portfolio-lead/bootstrap/testing/bootstrapFixtures.ts`;
- `front/src/features/portfolio-lead/domain/mockData.ts`, `types.ts`, `selectors.ts`;
- `front/src/features/copilot/components/PortfolioCopilotDrawer.tsx` and context mapping hooks;
- `front/src/app/components/design-system/patterns/*` only if an existing pattern cannot express a proven need;
- a future prototype-only fixture/adapter location under `front/src/features/portfolio-lead/`.

Backend files are not candidates for the prototype-first slice unless a later authority decision shows that existing Bootstrap/Handoff APIs cannot support the experiment.

## M. Files that MUST NOT be touched

For this prototype definition/audit boundary, do not touch:

- `front/prisma/schema.prisma` or migrations;
- `backend/modules/portfolio-handoff/`;
- `front/src/features/portfolio-handoff/` except a read-only integration point explicitly approved later;
- `front/src/app/pages/HandoffInvitationPage.tsx` and `front/src/features/portfolio-handoff/components/HandoffShell.tsx`;
- `front/src/app/pages/InitiativeOverviewPage.tsx`;
- `front/src/app/pages/Step0Page.tsx` through `Step4Page.tsx`;
- `front/src/app/components/layout/StepWorkspaceShell.tsx`;
- Core/authority documents;
- `front/src/app/routes.ts` until a prototype route is explicitly approved;
- backend schemas, semantic event projectors, read models and persistence;
- existing legacy pages for opportunistic refactor or deletion.

## N. Risks / open questions

1. The Bootstrap path is continuation-scoped. Can a prototype enter it directly with a controlled fixture without changing production route semantics?
2. Does the existing analyzer produce a sufficiently useful relationship reading, or only work-item normalization? This must be tested with NovaGrowth before reusing its output as P3.
3. Which fields can represent detected/mmentioned/confirmed owners in a fixture without implying a new domain state?
4. Can partial readiness be shown entirely in prototype state while Handoff remains the authority for actual assignment lifecycle?
5. How should `first_active_home_rendered` be represented in a prototype without adding `workspace_experience` persistence?
6. Which current Home selectors represent deltas versus current snapshots? Current evidence shows snapshots, not a dedicated historical model.
7. The current frontend contains both `Challenge` activation concepts and the proposed progressive “group → Reto” experience. The prototype must not silently promote one into the other.
8. Results/executive output currently exists, but the distinction between evidence, observed result and impact must be checked against the active contract before reuse.
9. Copilot backend availability and deterministic response fixtures need to be separated; a live AI dependency would make the E2E prototype non-reproducible.
10. Existing route/layout tests cover Portfolio Lead access and some DS/Handoff behavior, but no test was found for the complete P0–P13 journey. This audit does not add one.

## O. Audit conclusion

The repository has enough reusable frontend and backend-adjacent surfaces to prototype the journey without a product rewrite. The safe reuse boundary is:

```text
Portfolio Entry continuation
  → Portfolio Bootstrap / work intake / first reading
  → prototype-only relation and ownership review state
  → existing Handoff boundary
  → selected Portfolio Home attention/insight components
  → fixture-driven second visit / Results
```

The current Portfolio CRUD pages and Initiative/Steps pages should remain separate. The first implementation slice should be **Slice A — First Value**, using existing Bootstrap and a reproducible NovaGrowth fixture. No new contract, event, schema, migration, read model or product code is authorized by this audit.

