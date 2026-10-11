# KAN-133 — 114F Technical Current-State Audit + Architecture v0.1

**Estado:** auditoría técnica y propuesta de arquitectura; sin implementación runtime.  
**Baseline:** `origin/main` = `19cc91b9b0ef6237070565df24bc66f041b37ded` (KAN-132).  
**Tickets:** KAN-128 (parent), KAN-133 (subtarea técnica).  
**Fecha:** 2026-10-11.  
**TECHNICAL_AUDIT_AUTHORIZED:** YES. **RUNTIME_IMPLEMENTATION_AUTHORIZED:** NO.

## 1. Autoridad y precondición

La jerarquía es `docs/STARTERIA_AUTHORITY.md`: Core factual v0.2 (`Base fundacional revisada / Por validar`), ADR de producto aceptados 003/004/005, Portfolio Entry Logic Contract v0.1 aprobado, semántica gobernada 114D/114E en sus propios alcances y Portfolio Setup Continuity Experience Contract v0.1 `ACCEPTED / FROZEN FOR IMPLEMENTATION PLANNING` sólo para 114F. `CURRENT_STATE.md` y `STARTERIA_V2_MANIFEST.md` registran 114E `IMPLEMENTED_VERIFIED` y 114F `NOT_IMPLEMENTED`. KAN-128/133 confirman auditoría y arquitectura, no código. KAN-129 reconcilió ADR-003 `ACCEPTED` y documentó su referencia factual conflictiva a Core v0.3: **gobierna v0.2**. El Decision Package KAN-130 es shaping subordinado. El Post-Entry Contract anterior sigue `PROPOSED FOR REVIEW`, `SUPERSEDED_IN_PART` en la frontera superpuesta. Bootstrap Logic/Tech son propuestas; Activation v0.2 es `ACTIVE / FROZEN FOR IMPLEMENTATION PLANNING` en su propio contexto.

Fuentes inspeccionadas: los contratos anteriores; `docs/portfolio-entry/implementation/PORTFOLIO_SCOPED_ACCESS_AUTHORITY_v0.1.md` y `PORTFOLIO_ENTRY_AUTHENTICATED_PORTFOLIO_CONTEXT_ESTABLISHMENT_v0.1.md`; `docs/portfolio-lead/03-bootstrap-home/PORTFOLIO_BOOTSTRAP_HOME_{LOGIC_CONTRACT,TECH_SPEC}_v0.1.md`; `docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md`; esquema, rutas, servicios, clientes y tests citados abajo. La presencia de código o un informe histórico no promueve autoridad. Los estados de esta auditoría describen **el checkout**, no tráfico de producción.

## 2. Runtime truth map

| Pieza y evidencia | Clasificación | Verdad observable |
|---|---|---|
| 114D `PortfolioEntryCriticalHandoff` y confirmación (`front/prisma/schema.prisma:3320`, `backend/modules/portfolio-entry-sessions/infrastructure/prisma-portfolio-entry-session.repository.ts:240`) | IMPLEMENTED_ACTIVE | Artefacto versionado, `sourceContextRevision`, confirmación del owner y CAS/lock de sesión. |
| 114E `StarteriaPathService` (`backend/modules/portfolio-entry-starteria-path/application/starteria-path.service.ts:82`) | IMPLEMENTED_ACTIVE | Proyección derivada, source binding a 114D actual y versiones soportadas; Path semántico no persistido. |
| Sesión provisional owned (`backend/modules/portfolio-entry/application/portfolio-entry-experimental-session.service.ts:135`) | IMPLEMENTED_ACTIVE | Reanuda contexto propio tras claim; no resuelve el gate completo 114F. |
| Resolver `ScopedPortfolioAccessService` (`backend/shared/authz/scoped-portfolio-access.service.ts:25`) | IMPLEMENTED_ACTIVE | User + Organization + OrganizationMember + grant exacto de capacidad y scope. |
| `portfolio-contexts` y `continue-portfolio` (`backend/modules/portfolio-entry/portfolio-entry.router.ts:162`, `:175`) | IMPLEMENTED_PARTIAL / CONFLICTING_WITH_114F | Cero/uno/varios scopes funciona para la continuación anterior; escritura toma handoff/confirmación legacy, no 114D. |
| `PortfolioEntryPortfolioContinuation` (`front/prisma/schema.prisma:2849`) | IMPLEMENTED_COMPAT | Snapshot único por sesión, consumido por Home arrival y Bootstrap; formato v0.1 legacy. |
| Perfil `PortfolioEntrySession.continuationProfile` (`front/prisma/schema.prisma:2758`) | IMPLEMENTED_PARTIAL | Enum persistido, default server-owned al crear; sin versión/evidencia de transición. |
| `PortfolioLeadLayout`, Home y Bootstrap (`front/src/app/layout/PortfolioLeadLayout.tsx:43`, `backend/modules/portfolio/portfolio-scope.ts:30`, `backend/modules/portfolio-bootstrap/portfolio-bootstrap.service.ts:266`) | IMPLEMENTED_PARTIAL / CONFLICTING_WITH_114F | Home global puede cargar sin snapshot; criterios globales no equivalen al umbral B de 114F. |
| `PortfolioHandoffAssignment` e Invitation/Accept/Start (`front/prisma/schema.prisma:1615`, `backend/modules/portfolio-handoff/`) | IMPLEMENTED_PARTIAL | Persistencia/lifecycle y endpoints de invitación/respuesta existen; no hay wiring productivo Public Entry → Assignment ni política issuer target-scoped. |
| `PortfolioHandoffAssignmentService.create` (`backend/modules/portfolio-handoff/application/portfolio-handoff-assignment.service.ts:10`) | IMPLEMENTED_UNUSED | Servicio y tests existen; la búsqueda de callers productivos no encontró un comando que lo invoque. |
| Emisor de grant, transición gobernada de perfil e issuer Initiative target-scoped (114F §§4-5, 10) | DOCUMENTED_ONLY | Políticas exigidas por contrato; no se halló provisión/transition command productivo. |
| 114F como gate, snapshot y handoff gobernado | MISSING | No existe read/write boundary 114F ni UI 114F. |

## 3. Snapshot: `PortfolioEntryPortfolioContinuation`

**Decisión: ADAPT; aislar filas actuales como KEEP_COMPAT.** El modelo tiene `id`, `sessionId @unique`, `handoffId`, `confirmationId`, `continuedByUserId`, `portfolioScope Json`, `sourceSnapshot Json`, `pendingItems Json`, `mappingVersion`, `status` default `CONTINUED`, `destinationRoute`, `continuedAt` y timestamps (`schema.prisma:2849-2871`). FK a sesión y usuario; `PortfolioBootstrapSession.sourceContinuationId` apunta al snapshot (`:2874-2899`). No hay relación tipada a 114D, Organization o grant, ni columnas de `sourceContextRevision`, versión 114D/114E, versión/evidencia de perfil, versión de operación, supersesión, lifecycle validado o idempotency key. Los índices adicionales son usuario, fecha y status. `sessionId @unique` impide guardar dos generaciones independientes de la misma sesión.

La escritura (`portfolio-entry-continuation.service.ts:203-323`) exige sesión claimed/owned, `expectedRevision`, perfil Portfolio, lifecycle confirmado, ausencia de `PortfolioEntryConversion` y grant scoped. Selecciona `PortfolioEntryHandoff` y `PortfolioEntryConfirmation`, devuelve cualquier fila previa por sesión antes de comprobar la fuente, guarda `rawEntry` y `semanticState` completos dentro de `sourceSnapshot` (`:429-456`) y devuelve `/portfolio/setup`. El catcher de `P2002/P2003` también devuelve cualquier fila existente por sesión (`:310-319`). Eso no demuestra currentness ni equivalencia de request. `readContinuation` y `readPortfolioHomeEntryContext` revalidan owner y grant, pero no source revision, confirmación 114D, perfil o `status` (`:120-201`). `withIdempotency` conserva un DTO completado por 24 h y puede devolverlo sin revalidar revocación/currentness (`:350-382`). El DTO genérico expone campos del handoff legacy; el Home DTO hace una proyección más pequeña de ese JSON.

Consumidores reales: `GET /continuations/:id`, `GET /continuations/:id/home-context`, `POST /continuations/scoped-first-value-access`, `PortfolioLeadHomePage`, `PortfolioLeadLayout`, `PortfolioBootstrapService`, `derivePortfolioAnchorFromContinuation` y sus tests. Un snapshot 114F no debe cambiar su significado por accidente. El nuevo boundary debe discriminar versión/formato, adaptar la misma identidad de transferencia, conservar historial y negar lecturas legacy como 114F. No copiar conversación cruda, `rawEntry`, `semanticState`, prompt ni razonamiento oculto.

## 4. Sesión, fuente y currentness

`PortfolioEntrySession` tiene owner nullable, `ownershipState`, `revision` CAS, `contextRevision` independiente, lifecycle, expiración y perfil (`schema.prisma:2744-2786`). Creación fija `PORTFOLIO_LEAD_ENTRY` en servidor (`portfolio-entry-session.service.ts:152`); claim cambia owner una vez bajo CAS (`prisma-portfolio-entry-session.repository.ts:368-390`). El acceso provisional owned exige principal, `CLAIMED`, owner y vigencia (`portfolio-entry-experimental-session.service.ts:135-143`). Mensajes/correcciones usan `contextRevision`; artefactos 114D se guardan con revisión de origen y versión única; la confirmación bloquea la fila de sesión `FOR UPDATE`, verifica último artefacto, owner y revisión y usa CAS serializable (`prisma-portfolio-entry-session.repository.ts:240-307`). `StarteriaPathService` rechaza 114D no actual, no confirmado, versión inválida y proyección cuyo source binding no coincide (`starteria-path.service.ts:87-129`, `:253-300`). `PortfolioEntryConversionSubmission` vuelve a comprobar source binding en transacción (`conversion-submission.service.ts:110-140`). Estas primitivas son reutilizables.

La continuación actual usa `PortfolioEntryHandoff` y `PortfolioEntryConfirmation` legacy, no `PortfolioEntryCriticalHandoff`; `revision` se comprueba al crear pero no se incrementa por la continuación ni se vuelve a comprobar al leer. `handoffId` de la fila es legacy. El 114F futuro debe obtener el último 114D y reconstruir/verificar Path 114E cuando se use, dentro de una operación serializada por sesión, con comprobación final antes de persistir. No confundir `session.revision` (CAS general), `contextRevision` (fuente) y `artifactVersion` (114D).

## 5. Perfil de continuación

`PortfolioEntryProfile` enum Prisma reconoce `PORTFOLIO_LEAD_ENTRY` e `INITIATIVE_ENTRY` (`schema.prisma:2577`). La creación fija Portfolio; claim, 114D y 114E no establecen otro perfil. Sólo se hallaron lecturas del perfil en `portfolio-entry-continuation.service.ts:234` y `portfolio-entry-conversion.service.ts:115`, además del mapper/DTO; **no se halló comando productivo de transición a `INITIATIVE_ENTRY`**. El campo es nullable para filas históricas, mutable técnicamente vía Prisma y carece de versión, actor, razón, política, fuente y CAS propios. Los tests de conversión siembran `INITIATIVE_ENTRY` directamente; eso no prueba autoridad en runtime. No se observó input de cliente que modifique el perfil en las rutas Entry actuales. El `starteria_path` legacy y `suggestedRoute.ts` producen presentación/sugerencia, nunca establecimiento de perfil.

Tratamiento: default Portfolio con evidencia de creación gobernada; valor ausente/desconocido o `INITIATIVE_ENTRY` sin prueba → `PROFILE_CONFLICT`/compatibilidad aislada. Una transición auditable y versionada es una dependencia separada de la excepción Initiative. No inferirla de un enum, CTA, query, Path, IA ni rol.

## 6. Organización y grants

`OrganizationMember` guarda `userId`, `organizationId`, rol y creación, con índices pero sin unicidad compuesta ni estado de vigencia (`schema.prisma:2442-2452`). `OrganizationPortfolioAccessGrant` guarda usuario, organización, `capability`, issuer opcional y timestamps; `@@unique([userId, organizationId, capability])` (`:2457-2473`). No guarda expiración, revocación, versión ni política issuer. Revocación efectiva requiere retirar la fila o membresía; no se halló comando productivo de emisión/revocación de grant. El resolver verifica existencia de user, organization, membership y grant exacto; `portfolio:write` no implica `portfolio:read` (`scoped-portfolio-access.service.ts:25-86`). Errores de DB se propagan; no se deben convertir en cero scopes. El informe Scoped Access documenta provisión externa/fixtures, no una interfaz issuer actual.

## 7. Resolución cero/uno/varios

`GET /sessions/:id/portfolio-contexts` exige auth y owned/claimed activo, enumera membresías y filtra cada organización por `portfolio:read`; responde sólo `{sessionId, revision, contexts:[{organizationId,name}]}` (`portfolio-entry-continuation.service.ts:105-118`). **Cero:** lista vacía, no crea fila; UI muestra avance guardado pero deshabilita confirmación/continuación. **Uno:** UI lo preselecciona; POST sin ID puede resolverlo de nuevo. **Varios:** UI muestra radio, POST exige ID; el servidor revalida antes de crear, por lo que un ID arbitrario no concede acceso. La selección sólo persiste al escribir `portfolioScope`, no como paso provisional autónomo. Revocación entre listado y POST se deniega. Lecturas del snapshot revalidan grant. Fallo de resolver va a error genérico de UI; no hay estado `SCOPE_VALIDATION_FAILED` distinguible ni retry dedicado (`AuthenticatedProvisionalContinuationPage.tsx:64-105`, `:117-169`, `:180-194`). Los tests `portfolio-entry-context-establishment.test.ts`, `AuthenticatedProvisionalContinuationPage.test.tsx` y `scoped-portfolio-access.service.test.ts` cubren la slice anterior, no el gate 114F.

Las escrituras generales del router Portfolio usan `requirePermission('portfolio:write')` global (`backend/modules/portfolio/portfolio.router.ts:58-62` y siguientes), mientras Bootstrap acepta permiso global **o** grant scoped (`portfolio-bootstrap.service.ts:1281-1305`). Esos gates no demuestran por sí mismos permiso de acción/objeto para el scope seleccionado por 114F. Su alcance debe auditarse por acción en 133F; el presente informe no declara que todos los servicios de Portfolio carezcan de checks propios.

## 8. API actual de continuación

Prefijo real: `/api/v1/public/portfolio-entry` (`portfolio-entry.router.ts:157-178`). Todas las rutas siguientes exigen `authenticate` salvo lectura/creación Entry marcada `optionalAuth`.

| Método/ruta | Checks y efecto | DTO/consumidor | Clasificación |
|---|---|---|---|
| `GET /sessions/:id/provisional-continuation` | Owned/claimed/vigente; read-only | DTO provisional; `AuthenticatedProvisionalContinuationPage` | IMPLEMENTED_COMPAT; recuperar contexto propio |
| `POST /sessions/:id/claim` | Auth, token público/estado y CAS; vincula owner una vez, no crea grants | sesión claimed; UI de registro/Entry | IMPLEMENTED_ACTIVE; ownership reutilizable |
| `POST /sessions/:id/handoff/confirmation`, `GET /sessions/:id/confirmed-brief` | Auth/owner y revisión; confirman/leen handoff legacy | provisional y First Value | KEEP_COMPAT; no son confirmación 114D |
| `GET /sessions/:id/critical-handoff`, `POST /sessions/:id/critical-handoff/:artifactId/confirmation` | Token/owner según sesión; source currentness y CAS en confirmación | 114D UI | IMPLEMENTED_ACTIVE; fuente reutilizable |
| `GET /sessions/:id/starteria-path` | Auth, owner, último 114D confirmado, versiones; sin escritura | Path DTO; `StarteriaPathExperience` | IMPLEMENTED_ACTIVE; proyección reutilizable |
| `GET /sessions/:id/portfolio-contexts` | Auth, owned/claimed; enumera scopes read | Contextos; página provisional | IMPLEMENTED_PARTIAL; adaptar gate |
| `POST /sessions/:id/continue-portfolio` | Auth, owner/perfil/revisión, handoff legacy, scoped read; crea una fila; `Idempotency-Key` | DTO `CONTINUED`, ruta `/portfolio/setup`; UI Entry/provisional | KEEP_COMPAT + ISOLATE para 114F |
| `GET /continuations/:id` | Auth, owner y scoped read; lee JSON legacy | DTO de continuación; cliente público | KEEP_COMPAT |
| `GET /continuations/:id/home-context` | Auth, owner y scoped read; proyección parcial | Home arrival hook | KEEP_COMPAT; adaptar consumidor 114F |
| `POST /continuations/scoped-first-value-access` | Auth, identidad de sesión/handoff legacy + scoped read; sin persistencia | Guard de `/portfolio/setup` | KEEP_COMPAT |
| `POST /sessions/:id/convert` | Auth, perfil `INITIATIVE_ENTRY`, handoff legacy y confirmación; crea `Project`, team, Steps y Adaptive Core (`portfolio-entry-conversion.service.ts:98-244`) | Initiative overview | ISOLATE / DEPRECATION_TARGET para continuación 114F; nunca fallback |
| `POST /sessions/:id/conversion-submissions` | Auth, owner y source 114D/114E actual; persiste solicitud comercial/consentimiento | formulario 114E | IMPLEMENTED_ACTIVE en 114E; ISOLATE de 114F |
| `POST /api/v1/portfolio-bootstrap/sessions/from-continuation` | Auth, owner de snapshot, permiso global o grant scoped; crea/reusa Bootstrap y anchor | `usePortfolioBootstrap` desde Home arrival | IMPLEMENTED_PARTIAL; adaptar gate 114F |

La solicitud comercial 114E no concede permiso ni destino Portfolio. El `confirmed-brief` sirve el First Value anterior con identidad de handoff legacy. No convertirlo en source binding 114F.

## 9. Frontera Home / Bootstrap

Ruta UI: `/portfolio/inicio`, bajo `PortfolioLeadLayout` (`front/src/app/routes.ts:119-130`). Con query `portfolioEntryContinuationId`, Home lee `home-context` y luego `POST /api/v1/portfolio-bootstrap/sessions/from-continuation`; Bootstrap conserva `sourceContinuationId`, deriva anchor desde `sourceSnapshot` legacy y tiene state/read/write propios (`PortfolioLeadHomePage.tsx:37-100`, `portfolio-bootstrap.service.ts:266-339`, `portfolio-anchor-derivation.ts:16-80`). `/portfolio/setup` usa `PortfolioLeadFirstValuePage` y `confirmed-brief`/sessionStorage; no es la frontera 114F (`PortfolioLeadFirstValuePage.tsx:48-103`). El Bootstrap Tech Spec propuesto separa snapshot de estado mutable.

Sin query, Home renderiza su dashboard general y el `PortfolioLeadContext` carga frentes, retos e iniciativas por APIs existentes (`PortfolioLeadHomePage.tsx:102`, `PortfolioLeadContext.tsx:176-184`). `PortfolioLeadLayout` permite permiso global `portfolio:read` sin snapshot (`:43-105`). `/api/v1/portfolio/home` exige autenticación pero usa `resolvePortfolioScope`, que reúne `User.organizationId`, membresías y cualquier grant, incluye frentes `organizationId=null`, permite admin all y tiene una rama `all:true` para usuario sin permiso global (`portfolio.router.ts:41-49`, `portfolio-scope.ts:30-64`). Eso **no equivale** a membership + grant `portfolio:read` para el scope elegido. Bootstrap acepta permiso global como alternativa al resolver scoped al crear y en cada capability (`portfolio-bootstrap.service.ts:285-295`, `:1281-1305`) y no verifica currentness de 114D al consumir snapshot. Es una colisión de seguridad/semántica para una llegada 114F, no evidencia de que la ruta general Home deba retirarse en esta tarea.

Primera acción funcional actual: sin query, el CTA del Home general es «Crear nuevo frente» (`PortfolioLeadHomePage.tsx:108-117`); con continuation ID, Bootstrap inicia revisión de anchor B1 o intake de trabajo B2 según `derivePortfolioAnchorFromContinuation` (`portfolio-bootstrap.service.ts:305-313`). `/portfolio/setup` tiene su propio First Value con análisis P3, separado de Bootstrap. Ninguna de estas superficies define el gate 114F.

**Handoff técnico exacto:** 114F entrega ID de snapshot 114F actual, `organizationId` validado, source/profile binding y `nextAuthorizedSurface=PORTFOLIO_HOME_BOOTSTRAP`; Home/Bootstrap reciben la identidad, revalidan B en servidor y sólo entonces crean/leen Bootstrap y sus read models para ese scope. La carga general de Home sin snapshot debe quedar separada de la llegada 114F. El consumidor no debe tratar `portfolioScope` JSON ni un query param como grant. Sin B: sólo contexto provisional propio, sin `PortfolioLeadContext` tenant ni Home. Bootstrap asume anchor/trabajo/lectura después de ese punto; 114F no crea Project/Steps.

## 10. Mapa legacy y consumidores

| Ruta/artefacto | Caller, efecto y evidencia | Tratamiento / colisión |
|---|---|---|
| `/auth/continue/:draftId` | `PublicProposalEditor` y `PublicProposalResultPage` navegan a `ProgressiveSignupPage`; `AuthPage` toma draft pendiente y `AppContext.createProjectFromPublicDraft` llama `projectService.create`, luego prefill Step 0 (`routes.ts:69`, `AppContext.tsx:870-930`). Tests de Auth y API existen. | KEEP_COMPAT + DEPRECATION_TARGET por caller; jamás desde 114F. |
| `/public/continuar` | `pilot-lead.notifier.ts:113` envía URL; `PublicResumeWithCodePage` canjea código y deja pending claim. | KEEP_COMPAT; entrada piloto externa. |
| `/continuar-piloto`, `consume-claim` | `AuthPage` redirige; `ContinuePilotPage` consume token, `PilotClaimService` crea Project y retorna el mismo en retry (`pilot-claim.service.ts:130-178`); router tests. | KEEP_COMPAT + ISOLATE; no source 114F. |
| `/projects/new?challengeId=...` | `PortfolioLeadChallengesPage` usa `buildLegacyChallengeProjectPath`; `CreateProjectPage` usa query para prefill/crear Project, independiente de 114F; tests de challenge/activation. | DEPRECATION_TARGET sólo para caller de handoff legacy según ADR-005; DO_NOT_TOUCH creación no relacionada. |
| `/sessions/:id/convert` | Cliente Entry conserva llamada; servicio crea Project/Steps para perfil Initiative sembrado, sin target/Assignment/issuer aceptados; tests de integración. | ISOLATE; no satisface excepción 114F. |
| `/sessions/:id/continue-portfolio` y `/portfolio/setup` | Llamado por `PortfolioEntryExperience` y página provisional; snapshot desde handoff legacy, First Value lee brief legacy; tests unitarios/E2E anteriores. | KEEP_COMPAT + ISOLATE; no reutilizar como 114F sin discriminador. |
| `starteria_path` legacy, `recommended_approach`, `recommended_cta`, `suggestedRoute.ts` | Handoff/mapper/UI históricos aún contienen lectura o sugerencias; 114E Path actual se proyecta por otra ruta y tests negativos impiden que herede esos campos. | KEEP_COMPAT para presentación; DO_NOT_TOUCH como autoridad de routing. |

El código muestra callers y tests, **no** medición de tráfico o uso productivo. Retiro exige inventario de tráfico, reemplazo y autoridad separada. Las expectativas de algunos tests E2E anteriores hacia `/portfolio/inicio?portfolioEntryContinuationId=...` contrastan con el `destinationRoute='/portfolio/setup'` actual (`portfolio-entry-conversion.integration.test.ts:219`, `portfolio-entry-conversion.spec.ts:226`, `portfolio-entry-continuation.service.ts:281`); verificar al planificar regresión, sin reinterpretar el contrato.

## 11. Excepción Initiative

`Project` sigue siendo identidad Initiative canónica (ADR-005). `PortfolioHandoffAssignment` persiste target kind, `challengeId`, `initiativeId?`, organización/scope opcionales, issuer actor, invitado, versión, estados y timestamps (`schema.prisma:1615-1658`); Invitation tiene token hash/claim/expiración/revocación (`:1742-1756`) y Member puede ligar recipient/Owner (`:1778-1793`). Hay servicio de creación/validación de assignment y pruebas, pero la búsqueda de callers productivos sólo encuentra su repositorio: **no hay comando/ruta productiva que conecte Public Entry a Assignment**. El delivery router permite `portfolio:write` global; no demuestra issuer target-scoped (`portfolio-handoff-invitation.router.ts:61-78`). Invitation read/claim y Accept/Reject/Start tienen rutas separadas; response service verifica Owner/recipient, estado, versión e idempotencia (`portfolio-handoff-response.service.ts:14-44`). Claim no es Accept; Accept no es Start. Los tests de lifecycle no prueban el gate 114F.

El runtime **no puede** satisfacer la excepción directa aceptada: falta transición `INITIATIVE_ENTRY` versionada con evidencia; enlace Entry→Assignment; issuer policy target-scoped; comprobación conjunta de Project existente, scope, recipient, Assignment/invitation y permiso de acción dentro de un read boundary 114F. Un Assignment `CHALLENGE` con `initiativeId=null` es legítimo en Activation, pero no permite ruta directa a Project desde 114F. Bloquear como `BLOCKED_AUTHORITY`/`PROFILE_CONFLICT` y conservar contexto propio; no invocar `/convert`, crear Project, Accept, Start ni Steps.

## 12. Matriz contrato → runtime

| Requisito 114F | Evidencia actual | Estado / brecha | Tratamiento |
|---|---|---|---|
| Input gate identidad/owned/activo | sesión y auth guards | IMPLEMENTED_PARTIAL: no gate 114D+perfil unificado | ADAPT |
| Binding 114D + 114E | 114D persistido, Path derivado | IMPLEMENTED_PARTIAL: snapshot toma handoff legacy | ADD |
| Currentness/versión | CAS 114D/Path | IMPLEMENTED_PARTIAL: continuación/read no lo aplica | ADAPT |
| Perfil estable/versionado | enum al crear | IMPLEMENTED_PARTIAL: sin versión/evidencia/transición | ADD |
| Cero/uno/varios scopes | resolver y UI anteriores | IMPLEMENTED_PARTIAL: no gate fuente 114F ni estado de error distinto | ADAPT |
| Provisional propio sin scope | provisional read | IMPLEMENTED_PARTIAL: UI bloquea avance; no output 114F | ADAPT |
| Snapshot scoped con procedencia | fila única JSON | CONFLICTING_WITH_114F: raw copiado; sin historia/versiones | ADAPT |
| Home handoff | query + Home/Bootstrap | CONFLICTING_WITH_114F: global bypass y source stale | ADAPT |
| Initiative exception | Assignment/Invitation parcial | MISSING: issuer/transition/wiring | BLOCKED_BY_EXTERNAL_POLICY |
| Legacy sin fallback | rutas separadas | IMPLEMENTED_PARTIAL: `convert` y CTA antiguos siguen accesibles | ISOLATE |
| Fail-closed | resolver scoped propaga error | IMPLEMENTED_PARTIAL: DTO/cache y Home no revalidan todo | ADAPT |
| Idempotencia | tabla idempotency + key 24 h | CONFLICTING_WITH_114F: replay DTO sin revalidar; existing por sesión | ADAPT |
| Tenant isolation | resolver scoped exacto | CONFLICTING_WITH_114F: Home usa unión/global/null | ADAPT |
| No Project/Steps en ruta Portfolio | continuación actual no los crea | IMPLEMENTED_PARTIAL: rutas legacy paralelas sí los crean | KEEP + ISOLATE |

`CONFLICT` — Contract: 114F §§4, 8-9, 12. Requirement: B vigente en cada lectura/acción tenant, source actual y sin fallback. Current document/code: `portfolio-scope.ts:30-64`, `portfolio-bootstrap.service.ts:285-295`, `portfolio-entry-continuation.service.ts:203-319`. Observed mismatch: Home/global scope puede saltarse grant exacto; snapshot legacy persiste raw y se devuelve sin currentness. Risk: lectura entre tenants, uso de fuente obsoleta y promoción de contexto provisional. Recommended treatment: **ADAPT** llegada 114F y gates del consumidor; **ISOLATE** legacy. Requires ADR: **no** para cumplir el contrato aceptado; **sí** si se pretende alterar la política general Home fuera de esa llegada.

## 13. Decisión Prisma

```text
PRISMA_CHANGE: REQUIRED
```

El schema no puede representar **como filas durables y consultables** varias generaciones de snapshot 114F de una sesión preservando historial (`sessionId @unique`), ni el perfil con versión/evidencia de establecimiento y transición, ni binding/currentness/supersesión e idempotencia de operación con restricciones independientes del JSON. Los JSON actuales pueden transportar una proyección, pero no corrigen unicidad ni convierten el enum nullable en transición auditada. La adaptación debe preservar referencias existentes de Bootstrap y discriminar filas KEEP_COMPAT. Esta auditoría fija la incapacidad; **no diseña migración** ni autoriza modificar Prisma. Grant version/lifecycle/issuer es política externa: 114F revalida filas vigentes sin inventarla.

## 14. Opciones de arquitectura

| Criterio | A. Extender servicio/fila legacy in situ | B. Boundary 114F propio sobre modelo adaptado | C. Aggregate 114F totalmente nuevo |
|---|---|---|---|
| Semántica y legacy | Baja: `handoffId`/DTO legacy se mezclan | Alta: source 114D y discriminador explícito | Alta, pero rompe el mandato de adaptar la fila existente |
| Migración/costo | Medio; unicidad e historia siguen obligando cambio | Medio; requiere cambio Prisma acotado y adaptación consumidor | Alto; nuevo FK, doble snapshot y cutover |
| Currentness/idempotencia | Riesgo alto por retornos `existing` y DTO cacheado | Gate único, CAS y replay revalidado | Gate nuevo, más duplicación |
| Seguridad/Home | Reutiliza bypass global accidentalmente | Handoff explícito a Home/Bootstrap con B revalidado | Integración nueva completa |
| Rollback/duplicación | Rollback simple, riesgo semántico alto | Legacy aislado; rollback por formato/caller | Doble fuente, rollback complejo |
| Complejidad | Baja aparente, alta por compatibilidad implícita | Media, responsabilidades claras | Alta |

**Seleccionada: B.** Implementar en una slice posterior un servicio/read-write boundary 114F separado, con `PortfolioEntryPortfolioContinuation` **adaptado** como snapshot de transferencia y formato 114F distinto del v0.1 legacy. No convertir la ruta legacy en alias ni crear otro aggregate de negocio. La extensión de schema necesaria se decide y revisa en su propia subtarea de contrato/persistencia antes de los consumidores.

## 15. Arquitectura seleccionada

```text
owned PortfolioEntrySession + último 114D confirmado
        + 114E derivado/compatible si se muestra
        + perfil server-owned versionado
        -> 114F read boundary (estado seguro + scopes exactos)
        -> 114F write boundary (CAS + grant revalidado)
        -> snapshot 114F versionado en PortfolioEntryPortfolioContinuation
        -> Home/Bootstrap read boundary (B revalidado por scope y currentness)
```

Fuente de verdad de comprensión: 114D actual, no snapshot ni 114E. Fuente de permiso: user + membership + grant exacto y política de acción; snapshot guarda evidencia diagnóstica, nunca concede acceso. Fuente de perfil: sesión con versión/evidencia server-owned; el default nace en creación y la transición Initiative necesita otro comando autorizado. Lectura 114F recalcula source/currentness/profile/scopes y proyecta sólo campos mínimos con procedencia y open items; cero scope mantiene contexto propio sin fila tenant. Escritura usa operación atómica serializada por sesión, comprueba revision/source/perfil/scope antes y durante commit, persiste una generación de snapshot, conserva anterior como stale/superseded y rechaza conflictos. Retry idéntico puede recuperar ID, **tras revalidación**; misma key con payload distinto es 409. Home/Bootstrap sólo recibe snapshot 114F actual y scope B validado; vuelve a comprobar fuente y grant en cada lectura/acción. `portfolio:write` y permiso de acción se verifican aparte. La excepción Initiative es read-only desde 114F y delega a Activation Shell sólo con gate completo; issuer y transición no se emiten aquí. Errores se tipan: auth/ownership, source stale/version, profile conflict, no scope, resolver failed, revoked scope, idempotency conflict/concurrency, authority blocked, unexpected. Ningún error cae en conversión legacy.

## 16. API mínima propuesta (no implementada)

Prefijo propuesto bajo router existente `/api/v1/public/portfolio-entry`; no se requiere endpoint separado de selección, porque la selección se persiste junto con la continuación. Los nombres son propuesta técnica, no contrato congelado.

| Endpoint | Auth/input | Checks server-owned | Output/efecto/idempotencia/errores |
|---|---|---|---|
| `GET /sessions/:sessionId/portfolio-setup-continuity` | Auth; sólo `sessionId` | Owner/CLAIMED/vigencia; último 114D confirmado/versionado; 114E compatible si se incluye; perfil/evidencia; resolver scopes. Sin leer datos tenant antes de B. | DTO allowlist con estado `READY_PROVISIONAL`, `NO_AUTHORIZED_SCOPE`, `SELECT_SCOPE`, `READY_AUTHORIZED_SCOPE`, `STALE_SOURCE`, `PROFILE_CONFLICT`, `SCOPE_VALIDATION_FAILED`, `INITIATIVE_HANDOFF_AVAILABLE` o `BLOCKED_AUTHORITY`; referencias/versiones y pending items. Sin escritura; `401/403/404/409/410/422/503` tipados. |
| `POST /sessions/:sessionId/portfolio-setup-continuity/continue` | Auth; `expectedSessionRevision`, source binding devuelto, `organizationId` autorizado o omitido sólo si hay uno, `Idempotency-Key` | Repetir gate completo; revalidar B, perfil Portfolio, ausencia de conversión incompatible; serializar y CAS; comparar key+fingerprint; no aceptar payload de contexto/perfil/capacidad del cliente. | Snapshot 114F ID, binding, scope, `nextAuthorizedSurface=PORTFOLIO_HOME_BOOTSTRAP`, ruta segura; crea/reusa una generación, supersede anterior si fuente cambió; no grants/Project/Steps. Retry idéntico revalida; errores `401/403/404/409/410/422/503`. |

Con cero scope, el GET devuelve estado provisional y el POST no crea snapshot. El read de Home debe ser endpoint scoped propio o adaptación explícita de `home-context` que rechace formato legacy para 114F; no exponer JSON persistido. El endpoint existente `portfolio-contexts` puede quedar compat y reutilizar internamente el resolver. Initiative no necesita endpoint 114F de Accept/Start: retorna un handoff verificable hacia rutas Activation existentes sólo cuando la política externa y el wiring estén implementados.

## 17. Composición frontend

Punto de inserción: después de `CriticalHandoffReview` confirmado y la presentación 114E dentro de `PortfolioEntryExperience`, y también al reanudar la sesión owned; ruta dedicada auth de 114F o estado explícito dentro del recorrido público autenticado. `AuthenticatedProvisionalContinuationPage` ya sabe recuperar sesión y listar scopes, pero mezcla confirmación de handoff legacy con continuación; adaptar composición, no reciclar su confirmación como 114D. Un hook/state machine 114F posee loading, provisional, select, ready, stale, profile conflict, validation failed, blocked/error; el backend posee el estado autoritativo. GET muestra resumen 114D/Path referenciado y pendientes con clase; radio sólo enumera scopes devueltos; POST lleva ID de opción y binding, conserva key en retries. Cero scopes muestra recuperación gobernada; fallo técnico ofrece retry; stale vuelve a revisión 114D; revocación limpia Home arrival. Navegar a `/portfolio/inicio?portfolioEntryContinuationId=<114F-id>` únicamente tras respuesta server-owned y revalidación Home; el layout no debe activar `PortfolioLeadContext` tenant antes de esa validación. Initiative válida entrega a Handoff Shell/invitación existente sin ejecutar Accept/Start. Browser tests deben cubrir móvil y desktop y estados de recuperación.

## 18. Seguridad y privacidad

- Autorizar cada lectura propia por principal + sesión claimed/owned/vigente; ocultar existencia ajena y no confiar en sessionStorage, URL ni `portfolioScope` JSON.
- Resolver un scope sólo desde membership y `portfolio:read` exactos; validar elección al POST y **otra vez** en Home/Bootstrap. `portfolio:write` y permiso de objeto/acción son gates adicionales. Revocación o error de DB bloquean tenant; error no significa cero grants.
- Comparar último 114D, `contextRevision`, confirmación/versión y Path derivado; serializar contra mutaciones concurrentes; invalidar snapshot stale sin borrar historial. Revalidar antes de replay de idempotencia.
- Rechazar perfil sin evidencia/versionado y cualquier scope/profile enviado para elevar autoridad; no deducir issuer desde `portfolio:write`, rol, Sponsor, Challenge Owner o texto de Entry.
- Evitar fallback a `/convert`, pilot claim, Project/Steps y `suggestedRoute`. 114F no inicia Accept ni Start.
- Persistir referencias y proyección mínima, no `rawEntry`, `semanticState`, conversación completa, metadata de proveedor, prompt ni razonamiento oculto. DTO allowlist, logs sin PII/raw payload; clasificar claims provisionales, representación confirmada y autoridad organizacional pendiente.

## 19. Plan E2E / regresión ejecutable para slices futuras

Sin LIVE LLM: usar adaptador determinístico KAN-114 en el modo E2E documentado por `TESTING.md` §6, PostgreSQL desechable, Playwright y fixtures de grants/Assignment sólo de test. Separar assertions API/DB/browser; incluir sin Project/Steps en cada camino 114F.

| Caso | Fixture y assertion principal |
|---|---|
| 1. Owned + fuente válida + 0 scopes | GET `NO_AUTHORIZED_SCOPE`, contexto propio, ninguna fila tenant. |
| 2. Un scope | opción única, POST sin ID sólo si aún única, snapshot del scope. |
| 3. Varios scopes | selección humana explícita; ID no listado 403. |
| 4. Scope revocado | tras GET/POST/antes de Home: lectura tenant denegada. |
| 5. Wrong owner | GET/POST/Home no filtran contexto ni existencia. |
| 6. Fuente stale | nuevo contextRevision/último 114D invalida GET, POST y snapshot previo. |
| 7. Versión no soportada | 114D o Path incompatible → recuperación, sin legacy fallback. |
| 8. Profile conflict | null/Initiative sin evidencia → bloqueo, sin coerción. |
| 9. Portfolio válido | un snapshot, binding y handoff a Home. |
| 10. Sin Project/Steps | conteos DB idénticos en todos los casos Portfolio. |
| 11. Legacy compat | callers antiguos siguen funcionando en su namespace/formato. |
| 12. Sin fallback | fallos 114F nunca llaman `/convert`, pilot claim ni Step. |
| 13. Initiative sin autoridad | no issuer/target/Assignment/transición → `BLOCKED_AUTHORITY`. |
| 14. Initiative completa | fixture externa válida → Shell, no Accept/Start automático. |
| 15. Home scope/context | sólo scope revalidado, proyección allowlist; no union global. |
| 16. Retry idempotente | misma key/fingerprint devuelve mismo ID tras revalidar; payload distinto 409. |
| 17. Concurrencia | corrección/confirmación y POST simultáneos: una gana, stale 409. |
| 18. Tenant isolation | user org A con ID org B; denegar aun con rol global o snapshot ajeno. |
| 19. Browser recovery | cero/uno/varios, 503, stale, revoked, móvil/desktop, retry. |
| 20. 114D/114E regression | currentness, confirmación y Path/comercial separados; specs existentes. |

Conservar suite de `portfolio-entry-conversion.integration.test.ts`, `portfolio-entry-context-establishment.test.ts`, `portfolio-home-entry-context.integration.test.ts`, `portfolio-bootstrap.integration.test.ts`, `portfolio-bootstrap.scoped-authority.test.ts`, `front/e2e/portfolio-entry-conversion.spec.ts`, `front/e2e/critical-handoff-review.spec.ts`, `front/e2e/starteria-path-125f.spec.ts` y `legacy-route-quarantine.test.ts`. Corregir expectativas obsoletas **sólo** en la slice autorizada y con evidencia; no cambiar código/tests en KAN-133.

## 20. Slices de implementación propuestas, ordenadas

Cada slice requiere Jira [Técnica] explícita, autoridad por frente, `V2_CHANGE_GUARDRAIL_CHECK`, test CA primero y verificación completa. Un contrato backend/Prisma ↔ frontend nuevo es subtarea previa y bloquea consumidores. KAN-133 no da ese permiso.

| Orden | Alcance / archivos previstos | Autoridad y prerrequisito | Gate de aceptación | Prisma |
|---|---|---|---|---|
| 133A — contrato de datos y compatibilidad | `front/prisma/schema.prisma`, modelo continuación/perfil, mapper/repository Entry, tests DB; documento de contrato zod/DTO | 114F §2/5/8 + ADR-003/004; autoridad backend/Prisma explícita | generaciones versionadas y evidencia de perfil, filas legacy intactas, no grants/Project | **Sí**; migración sólo tras autorización |
| 133B — read boundary 114F | `backend/modules/portfolio-entry-*` 114D/114E/continuation, router/schema, tests unit/integration | 133A; 114D/114E aceptados | gate, DTO allowlist, stale/unsupported/profile, provisional | No |
| 133C — scope resolution | `backend/shared/authz/`, continuación, tests 0/1/N/503 | 133B; Scoped Access Authority | selección enumerada, revalidación, tenant isolation | No; issuer externo |
| 133D — write/snapshot boundary | continuación repository/service/router, idempotency, tests PostgreSQL | 133A-C | CAS, snapshot mínimo, supersesión, retry/revocation, cero Project/Steps | Modelo de 133A |
| 133E — UI 114F | `front/src/features/portfolio-entry/`, ruta/página, servicio, pruebas RTL | contrato zod/DTO y 133B-D | estados 114F y recuperación sin legacy routing | No |
| 133F — Home/Bootstrap handoff | `PortfolioLeadLayout`, `PortfolioLeadHomePage`, `PortfolioLeadContext`, `backend/modules/portfolio/` y `portfolio-bootstrap/` | 133D-E; Home/Bootstrap authority | llegada 114F sólo B exacto, source actual, sin leakage/global bypass | No previsto |
| 133G — excepción Initiative | perfil transition boundary, `portfolio-handoff/`, Activation UI/API | **Bloqueada** por política issuer target-scoped y autoridad/provisión de transición y Assignment; 133A-F | target existente, recipient/issuer/Assignment/version, Shell sin Accept/Start | Posible contrato separado; no autorizado ahora |
| 133H — E2E/security/regression | `front/e2e/`, integración backend, `scripts/jev-regresion.cases.json`, docs de evidencia | 133E-F; 133G sólo para caso positivo Initiative | matriz §19 y regresión 114D/114E/legacy sin LIVE LLM | No |

133F modifica acceso Home compartido: antes de autorizarlo, delimitar en la HU si el gate B se aplica sólo a llegada 114F o también a rutas Home generales. La primera opción cumple 114F sin redefinir la política general; cualquier cambio general necesita decisión de producto separada. 133G no debe bloquear el recorrido Portfolio provisional/autorizado.

## 21. Readiness y límite

```text
TECHNICAL_ARCHITECTURE_READY: YES
IMPLEMENTATION_SLICE_READY: YES — 133A como primera slice candidata para autorización explícita
RUNTIME_IMPLEMENTATION_AUTHORIZED: NO
```

La arquitectura y el orden son suficientemente concretos para redactar/aprobar 133A. **No** equivalen a autorización de backend, Prisma o migración. Bloqueos para capacidades posteriores: política externa de grant issuer/vigencia; transición auditable `INITIATIVE_ENTRY`; issuer Initiative target-scoped y wiring Entry→Assignment; alcance de la política Home general si se quisiera cambiar. Se permite continuar 114F provisional y Portfolio bajo B sin esas capacidades externas. No se modificó código, schema, migration, Core, Steps, grants ni lifecycle legacy en esta auditoría.
