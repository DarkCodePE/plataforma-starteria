# Starteria — Portfolio Setup Continuity Experience Contract v0.1 (114F)

**Estado:** `ACCEPTED / FROZEN FOR IMPLEMENTATION PLANNING` — sólo 114F (KAN-132)
**Tipo:** Experience Contract; KAN-128 / KAN-131  
**Fecha:** 2026-10-11  
**IMPLEMENTATION_PLANNING_AUTHORIZED:** `YES` — incluye auditoría técnica y arquitectura.
**RUNTIME_IMPLEMENTATION_AUTHORIZED:** `NO` — requiere una slice técnica separada con autoridad explícita.
**Alcance:** experiencia desde Critical Handoff 114D confirmado y Starteria Path 114E hasta el handoff a Portfolio Home / Bootstrap o una continuación provisional segura.

## 0. Autoridad, estado y propósito

Rige la jerarquía de [Authority Map](../../STARTERIA_AUTHORITY.md): [Core v0.2 factual](../../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md) (`Base fundacional revisada / Por validar`) → [ADR-003](../../../doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md), [ADR-004](../../../doc/product-adr/ADR-004-authenticated-continuation-access-and-initiative-handoff-authority.md) y [ADR-005](../../../doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md) `ACCEPTED` → [Portfolio Entry Logic v0.1](../../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md) aprobado. El [contrato 114E](PORTFOLIO_ENTRY_STARTERIA_PATH_EXPERIENCE_CONTRACT_v0.1.md) gobierna su Path, y [Activation v0.2](../../portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md) gobierna el handoff Initiative dentro de su bounded context. KAN-132 adopta este contrato sólo para 114F y subordinado a esas autoridades.

El [paquete KAN-130](PORTFOLIO_SETUP_CONTINUITY_DECISION_PACKAGE_v0.1.md) es la base de decisiones y evidencia de shaping, subordinada a los ADRs aceptados y a este contrato para la frontera 114F; [KAN-129](../../implementation/portfolio-entry/KAN-129_ADR003_114F_AUTHORITY_RECONCILIATION_v0.1.md) reconcilia ADR-003. [Manifest](../../../STARTERIA_V2_MANIFEST.md) y [Current State](../../../CURRENT_STATE.md) registran 114E `IMPLEMENTED_VERIFIED`, 114F `NOT_IMPLEMENTED`. El readiness de KAN-130 (`114F_CONTRACT_READY = YES`, `114F_IMPLEMENTATION_READY = NO`) describía la etapa previa a esta aceptación; ahora sólo están autorizadas la auditoría técnica, la arquitectura y la planificación. ADR-003 §1 contiene una referencia factual conflictiva al Core v0.3: KAN-129 la documenta; aquí gobierna Core v0.2 y no se promueve el candidato v0.3.

**Propósito:** conservar lo que Starteria ya aprendió y establecer el contexto organizacional/Portfolio correcto mediante autoridad del servidor, sin convertir una representación provisional en verdad organizacional. 114F no reabre la entrevista de Entry ni ejecuta conversión comercial 114E.

## 1. Frontera de experiencia e input gate

```text
114D Critical Handoff actual + confirmado
→ 114E Starteria Path actual, cuando forma parte del recorrido
→ 114F identidad, fuente, perfil y scope
→ Portfolio autorizado O establecimiento provisional seguro
→ Portfolio Home / Bootstrap sólo si existe acceso de lectura scoped
```

**Inicio exacto.** 114F empieza al entrar en continuación orientada a Portfolio, únicamente con identidad autenticada, sesión Portfolio Entry `CLAIMED` y propiedad válida, fuente 114D actual y explícitamente confirmada, elegibilidad de continuación, versiones 114D/114E soportadas y perfil server-owned compatible. Si el Path 114E se presenta o se usa como fuente, su referencia/proyección debe corresponder a la misma fuente actual; ni verlo ni enviar una solicitud comercial concede destino o permiso. Una sesión puede recuperarse provisionalmente antes de superar todo este gate, pero no avanza por 114F hasta superarlo.

**Fin exacto.** 114F termina cuando se conoce el perfil y su versión, el binding de fuente es válido, el scope está validado **o** explícitamente irresuelto en estado provisional seguro, se conserva el contexto con procedencia, se separa representación de verdad organizacional, sobreviven los pendientes y el servidor conoce la siguiente superficie autorizada. Con scope de lectura, el siguiente dueño es Portfolio Home / Bootstrap; sin él, el siguiente dueño es establecimiento de contexto provisional, no Home tenant. Home / Bootstrap interpreta y organiza el Portfolio después de esta frontera.

**Gate mínimo:** identidad verificada; sesión activa y owned; revisión de contexto de fuente vigente; Critical Handoff 114D último, confirmado y compatible; versión/referencia 114E compatible cuando se usa; perfil estable server-owned y elegible; ausencia de otra continuación vigente incompatible. Un scope organizacional no es requisito para preservar contexto propio provisional. Toda lectura/escritura Portfolio tenant añade membresía validada, scope y capacidad server-derived conforme a §4.

## 2. Source binding y currentness

La continuación liga `sessionId`, `ownerUserId`, `sourceContextRevision`, `criticalHandoffId` y versión, versión de confirmación/contrato relevante, perfil y su versión/evidencia de establecimiento. Añade referencia y versión de Starteria Path 114E **si** se usa; `organizationScopeId` sólo tras validación, y referencia/versión de grant o política sólo como evidencia revalidable. La revisión de sesión y la versión de operación protegen concurrencia. El identificador de Path no reemplaza el Critical Handoff como fuente de razonamiento ni exige persistir el Path semántico completo para reconstruirla.

Fuente obsoleta significa: ya no es el último Critical Handoff de esa sesión, `sourceContextRevision` difiere de la revisión de contexto actual, confirmación falta o cambió, versión de artefacto/contrato no está soportada, Path mostrado deriva de otra revisión, sesión cambia de owner/estado, perfil/Assignment cambia o ya existe continuación incompatible. Cambiar una fuente material exige nueva revisión gobernada; un snapshot anterior queda `STALE/SUPERSEDED` para 114F y no habilita destino. Ante versión desconocida se exige revisión o recuperación explícita, nunca reinterpretación legacy.

## 3. Estados de experiencia

Los estados son de experiencia, no enums de DB. Toda transición material vuelve a evaluar el gate en servidor. Un error técnico nunca se interpreta como ausencia de autoridad.

| Estado | Entrada y presentación | Acciones permitidas; acciones prohibidas | Salida |
|---|---|---|---|
| `LOADING_CONTEXT` | Se inició resolución de identidad, fuente, perfil y scopes. Progreso breve, sin prometer acceso. | Esperar/reintentar; no mostrar datos tenant ni navegar por cache. | Gate válido → estado ready/selección; fallo → estado específico. |
| `READY_PROVISIONAL` | Fuente válida, perfil Portfolio, sin scope de lectura validado. Resumen propio, pendientes y etiqueta provisional. | Revisar contexto propio y establecer scope; no Home tenant, escritura ni creación Core. | Scope validado → `READY_AUTHORIZED_SCOPE`; falta real → `NO_AUTHORIZED_SCOPE`. |
| `READY_AUTHORIZED_SCOPE` | Un scope elegido o único y revalidado con `portfolio:read`. Nombre del espacio, contexto y límites de autoridad visibles. | Continuar a Home/Bootstrap con handoff; escritura sólo tras gate separado. No usar snapshot como grant. | Handoff actual → fin 114F; revocación → bloqueo/revalidación. |
| `SELECT_SCOPE` | Hay varios scopes de lectura autorizados. Sólo se muestran esas opciones y la lectura propia. | Elegir una opción; no inyectar ID ajeno ni combinar tenants. | Selección revalidada → `READY_AUTHORIZED_SCOPE`; rechazo/revocación → resolver de nuevo. |
| `NO_AUTHORIZED_SCOPE` | Resolución concluyó con cero scopes válidos. Avance propio guardado; se explica falta de espacio accesible. | Recuperación o solicitud gobernada externa; no autoemitir membresía/grant ni exponer datos tenant. | Nueva autoridad emitida fuera de 114F → revalidar. |
| `SCOPE_VALIDATION_FAILED` | Resolver de scopes falló técnicamente. Mensaje recuperable sin afirmar que no hay permisos. | Reintentar/soporte; no datos ni acciones tenant. | Validación exitosa → recalcular opciones. |
| `STALE_SOURCE` | Binding 114D/114E o revisión deja de ser actual. Aviso y retorno a revisión Entry. | Recargar fuente/revisar 114D; no Path cacheado, snapshot previo ni acción organizacional. | Nueva fuente confirmada y compatible → recomenzar gate. |
| `PROFILE_CONFLICT` | Perfil ausente/desconocido, versión vieja, transición no probada o destino incompatible. Explicación sin cambiar ruta. | Recuperación o transición gobernada externa; no coerción Portfolio↔Initiative. | Perfil válido/versionado → recomenzar gate. |
| `INITIATIVE_HANDOFF_AVAILABLE` | Perfil `INITIATIVE_ENTRY` y **todo** el gate de §10 pasa. Se muestra target, emisor, destinatario y estado verificados. | Revisar Handoff Shell; no aceptar ni iniciar automáticamente; no Steps. | Handoff Shell asume la experiencia; invalidación → `BLOCKED_AUTHORITY`. |
| `BLOCKED_AUTHORITY` | Falta issuer, recipient, Assignment, permiso o política requerida. Se conserva el contexto propio; causa segura y próximo paso. | Recuperación/volver a contexto provisional permitido; no Invitation/Accept/Start ni fallback legacy. | Evidencia externa válida y actual → revalidar desde gate. |
| `ERROR` | Fallo inesperado del servidor. Mensaje recuperable, sin filtrar datos tenant. | Reintentar/soporte con misma identidad y operación; no avance optimista. | Revalidación completa → estado correspondiente. |

`NO_AUTHORIZED_SCOPE` es un resultado de resolución exitosa; `SCOPE_VALIDATION_FAILED` y `ERROR` no lo son. `READY_PROVISIONAL` puede representar contexto propio sin fila `PortfolioEntryPortfolioContinuation`.

## 4. Acceso y establecimiento de scope

| Umbral | Evidencia server-owned | Permite |
|---|---|---|
| A. Provisional | Identidad autenticada + sesión activa `CLAIMED` y owned; gate de fuente/perfil para avanzar por 114F | Contexto propio y establecimiento de scope; ningún dato de otra organización. |
| B. Lectura Portfolio | A + organización existente + `OrganizationMember` vigente + `OrganizationPortfolioAccessGrant` `portfolio:read` del mismo usuario y scope | Lectura tenant y Home/Bootstrap autorizados. |
| C. Escritura Portfolio | B + `portfolio:write` explícito del mismo scope + permiso de acción/objeto, versión y autoridad humana requerida | Sólo la operación concreta. `write` no sustituye `read`. |

La primitiva [Scoped Access Authority](../../portfolio-entry/implementation/PORTFOLIO_SCOPED_ACCESS_AUTHORITY_v0.1.md) y [Context Establishment](../../portfolio-entry/implementation/PORTFOLIO_ENTRY_AUTHENTICATED_PORTFOLIO_CONTEXT_ESTABLISHMENT_v0.1.md) respaldan B/C y la resolución cero/uno/varios. Cero: conservar avance provisional y ofrecer vía gobernada de acceso, sin datos tenant. Uno: mostrar el nombre y permitir continuar tras revalidación; una confirmación visible puede aportar claridad, sin selección redundante obligatoria. Varios: selección humana explícita entre scopes autorizados, revalidada al persistir y al leer. El cliente nunca aporta un scope arbitrario como autoridad. `User.organizationId`, rol global, perfil, `portfolioScope` persistido, texto de Entry y Path no sustituyen membresía ni grant.

114F consume membresías, grants y políticas ya emitidos; no crea, eleva, renueva ni revoca ninguno. Emisor, provisión, vigencia y revocación de grants son dependencia externa. Si no existe política aceptada, la persona queda provisional. Una revocación retira Home/Bootstrap tenant y toda acción derivada aun con snapshot previo.

## 5. Perfil de continuación

El perfil es estado de routing de sesión **server-owned, versionado y ligado a currentness**; no es rol, membresía, permiso ni resultado de 114E. En v0.1 sólo se reconocen `PORTFOLIO_LEAD_ENTRY` (ruta Portfolio por defecto, provisional o autorizada) e `INITIATIVE_ENTRY` (excepción explícita con target/Assignment y gate §10). Un enum almacenado sin evidencia de establecimiento no prueba autoridad.

La creación de Entry público fija `PORTFOLIO_LEAD_ENTRY` una vez. Claim, registro, confirmación 114D, Path 114E y 114F conservan el perfil. Sólo una transición separada, gobernada, server-owned y auditable puede pasar a `INITIATIVE_ENTRY` o volver; verifica sesión owned, fuente y target actuales, issuer/recipient/política scoped, decisión consciente del usuario, CAS e idempotencia, y registra actor, razón, política y versión `from → to`. Si esa transición no existe aceptada e implementada, el perfil se mantiene estable y la excepción no se habilita. Un `INITIATIVE_ENTRY` histórico sin prueba se aísla como compatibilidad.

CTA, query, copia, estado frontend, último mensaje, sugerencia de IA, `recommended_cta` y `starteria_path` legacy no establecen ni cambian el perfil. No hay mutación silenciosa de perfil ante conflicto.

## 6. Contexto llevado y clases de verdad

114F transporta referencias y una proyección mínima presentable de: situación/lectura crítica, marco de decisión 114D confirmado, contexto conocido, correcciones y representación confirmada, unknowns que cambian la decisión, open items y later work, primer movimiento soportado como **sugerencia**, resumen de procedencia y referencia/versionado de Path 114E. Se conserva origen por campo (`USER_DECLARED`, `EXTRACTED_FROM_USER_TEXT`, `AI_INFERRED`, `AI_SUGGESTED`) y disposición de revisión. Una referencia reproducible reemplaza copias completas cuando basta. No se copia conversación cruda, `rawEntry`/`semanticState` completos, prompts, razonamiento oculto ni Path derivado íntegro como nueva fuente.

| Clase 114F | Qué significa | Mostrar / uso permitido |
|---|---|---|
| `PROVISIONAL_USER_CONTEXT` | Declaración, extracción o sugerencia con fuente; puede requerir validación. | Mostrar con procedencia y dudas; no impulsar una mutación organizacional por sí sola. |
| `CONFIRMED_REPRESENTATION` | La persona confirmó que 114D expresa su intención; Path 114E es una proyección derivada de esa fuente. | Mostrar y llevar como representación, sin presentarla como verdad objetiva u oficial. |
| `SERVER_AUTHORITY` | Identidad, ownership, fuente/revisión, perfil, scope, membresía y capacidad comprobados en servidor. | Decide acceso y routing conforme a política vigente; no aprueba claims de negocio. |
| `ORGANIZATIONAL_AUTHORITY_REQUIRED` | Claim o acción que necesita validador/política con mandato organizacional. | Mantener pendiente hasta validación separada; bloquear únicamente la acción dependiente. |

| Campo representativo | Clase al entrar 114F | Límite de acción organizacional |
|---|---|---|
| Meta de negocio declarada; KPI target; prioridad estratégica; lista de iniciativas | `PROVISIONAL_USER_CONTEXT`, aun si se repite en 114D | Requieren autoridad organizacional para ser goal/KPI/prioridad/Initiative canónica. |
| Presupuesto, capacidad, apetito de riesgo declarados | `PROVISIONAL_USER_CONTEXT` + `ORGANIZATIONAL_AUTHORITY_REQUIRED` | No se tratan como compromisos aprobados. |
| Challenge Owner y Strategic Front Owner declarados | `PROVISIONAL_USER_CONTEXT` + `ORGANIZATIONAL_AUTHORITY_REQUIRED` | Un nombre/campo no concede ownership, routing ni issuer. |
| Membresía organizacional y capacidad Portfolio | `SERVER_AUTHORITY` sólo tras verificación independiente | Conceden acceso scoped, no verdad de negocio. |
| Representación 114D confirmada | `CONFIRMED_REPRESENTATION` | No crea alineamiento, KPI aprobado ni objeto Core. |
| Starteria Path 114E | Derivada de `CONFIRMED_REPRESENTATION`, con referencia de fuente | Explica valor/posible camino; no elige perfil, destino ni permiso. |
| Unknown/open item | Conserva clase y fuente originales | No se resuelve por traslado o autenticación. |

La confirmación de una representación no valida por sí sola presupuesto, prioridad o mandato de otra persona. Un campo puede mostrar la declaración provisional **y** señalar que falta autoridad organizacional antes de usarla.

## 7. Unknowns y open items

Cada pendiente conserva ID/referencia de origen, breve descripción, clase/procedencia, impacto, evidencia o autoridad requerida, estado y siguiente dueño/superficie. La salida distingue:

| Categoría | Tratamiento |
|---|---|
| `SOURCE_CURRENTNESS_BLOCKER` | Fuente/versión/confirmación insegura: bloquea 114F hasta revisión Entry. |
| `ACCESS_SCOPE_BLOCKER` | Identidad, ownership, scope, membresía o grant no verificables: bloquea sólo la lectura/acción tenant; contexto propio puede continuar si su gate pasa. |
| `ORGANIZATIONAL_AUTHORITY_BLOCKER` | Falta mandato para aprobar claim o ejecutar una acción: bloquea esa promoción/acción, no toda orientación Portfolio. |
| `EXTERNAL_EVIDENCE_BLOCKER` | Falta evidencia externa: no impide por defecto acceso a Home; impide la afirmación/decisión que la requiera. |
| `DOWNSTREAM_NON_BLOCKING` | Later work, supuesto sin soporte o unknown de estrategia no material para este gate: se entrega a Home/Bootstrap. |

Starteria pregunta ahora sólo por elección entre scopes autorizados o por una aclaración mínima que no pueda resolver el servidor y cambie el destino seguro. Un unknown de negocio no se convierte automáticamente en pregunta de onboarding. Si exige validador organizacional o evidencia externa, se conserva con el dueño correcto; no se pide al usuario que lo autoconfirme. Si una ambigüedad impide identificar el scope sin riesgo, se mantiene provisional.

## 8. Snapshot de transferencia, idempotencia y currentness

Se **adapta** `PortfolioEntryPortfolioContinuation` como snapshot de transferencia cuando B (`portfolio:read`) pasó para un scope validado. No es fuente de verdad empresarial ni grant. Sin scope, la sesión owned, Critical Handoff y Path referenciado preservan continuidad provisional; la fila Portfolio puede faltar. `PortfolioHandoffAssignment` pertenece al lifecycle Initiative de ADR-005 y no reemplaza este snapshot.

Responsabilidades conceptuales del snapshot: identidad/sesión; source binding y perfil/versiones; scope validado y estado de acceso observado; referencias de contexto llevado y claims provisionales clasificados; requisitos de autoridad y open items; siguiente superficie permitida; estado de currentness, idempotencia y supersesión. No se congela schema, API ni migración en este contrato. Las filas históricas con handoff legacy, `rawEntry`, `semanticState` u otras copias se discriminan como `KEEP_COMPAT`; no se elevan automáticamente a 114F.

Para la misma combinación `sessionId + ownerUserId + sourceContextRevision + criticalHandoffId/version + profile/version + selected validated scope + operation`, una repetición válida devuelve el mismo resultado, sin segundo snapshot. Un payload distinto con la misma clave o destino incompatible devuelve conflicto; no sobrescribe. Cambio de revisión de fuente o de perfil supersede el resultado anterior; cambio de scope exige nueva selección/revalidación. Membresía/grant/política se revalidan **en cada lectura o acción tenant**, aunque el snapshot conserve una versión diagnóstica. Respuestas cacheadas y estado frontend no sustituyen esa validación. Supersesión preserva historial y procedencia conforme a Core INV-10.

## 9. Handoff exacto a Portfolio Home / Bootstrap

Con B actual, 114F entrega: referencia del snapshot (o identidad de sesión de recuperación), source binding/versiones, perfil, scope autorizado, capacidad/estado de acceso **revalidable**, resumen de lectura y Path con referencias/procedencia/clase, open items y `nextAuthorizedSurface = PORTFOLIO_HOME_BOOTSTRAP`. Home obtiene su read model bajo sus propios gates y se encarga de anchor, trabajo existente, atención y siguientes decisiones conforme al [Bootstrap Logic](../../portfolio-lead/03-bootstrap-home/PORTFOLIO_BOOTSTRAP_HOME_LOGIC_CONTRACT_v0.1.md) propuesto y al [Home Read Model](../../portfolio-lead/06-portfolio-home-governance/PORTFOLIO_HOME_READ_MODEL_CONTRACT_v0.1.md) target. Ningún read model hereda permiso del snapshot.

Sin B, el handoff de experiencia es `nextAuthorizedSurface = PROVISIONAL_CONTEXT_ESTABLISHMENT`, con contexto propio y pending items; no carga Home tenant. No se entregan estrategia canónica inventada, StrategicFront, Challenge, Initiative, Step state ni un mandato para crearlos. 114F termina antes de que Home interprete, organice o proponga estructura Portfolio.

## 10. Excepción explícita Initiative

No es la ruta por defecto. Una **continuación directa a Initiative/Project desde 114F** exige conjuntamente: `INITIATIVE_ENTRY` establecido mediante transición gobernada y compatible con la fuente actual; sesión owned; target Initiative/Project canónico **existente** y scope organizacional validado; `PortfolioHandoffAssignment` e invitación vigentes y versionados ligados a target, issuer autorizado por política server-owned target-scoped y recipient que coincide con la identidad autenticada; relación/permisos de lectura/acción derivados del servidor; elegibilidad, confirmación, currentness e idempotencia. Se verifica de nuevo al abrir o actuar. El handoff entrega al [Activation v0.2](../../portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md) antes de su `Start`; 114F no ejecuta Accept ni Start.

`Assigned Challenge` con `initiative_ref = null` es válido en el bounded context Activation, pero **no** satisface la excepción de ruta directa a una Initiative/Project existente desde 114F. Puede mostrarse únicamente bajo una integración de Assignment/Invitation propia y autorizada, sin inventar Initiative ni entrar a Steps. Si cualquier evidencia de la excepción falta o es incompatible, se conserva el contexto propio en estado seguro (`BLOCKED_AUTHORITY` o recuperación); Home sólo se abre si su B y perfil compatible pasan, nunca mediante cambio silencioso de perfil.

`Invitation != Accept`; abrir/claim/autenticarse no acepta. `Accept != Start`; aceptar responsabilidad no inicia trabajo. `Start != Step mutation` dentro de 114F/Activation: cualquier entrada a Steps requiere el boundary downstream y sus permisos, tras Start autorizado para una Initiative existente. La política concreta de issuer, provisión de autoridad y wiring Public Entry→Assignment siguen fuera de 114F.

## 11. Límites de actores y legacy

`Challenge Owner` no adquiere routing/issuer por etiqueta; `Strategic Front Owner` no lo adquiere por campo `ownerId`; Sponsor no es destino por defecto, issuer universal ni aprobador universal. Cualquier autoridad positiva requiere identidad, scope/target, asignación y política server-owned vigente para **esa** acción. `portfolio:write` global o incluso scoped no prueba por sí solo issuer Initiative. IA y frontend no conceden mandato.

Rutas piloto/public-draft, `consume-claim`, `createProjectFromPublicDraft`, `/continuar-piloto`, `/auth/continue/:draftId`, `/public/continuar` y callers históricos hacia Project/Steps conservan `KEEP_COMPAT` y/o `DEPRECATION_TARGET` por **caller**, según ADR-003/004/005 y KAN-130. Pueden seguir sirviendo consumidores de compatibilidad existentes. La nueva ruta 114F **nunca** hace fallback silencioso a Project, `/projects/new?challengeId=...`, conversión legacy o Step 0. Retiro exige auditoría de consumidores/tráfico, reemplazo, tests y autoridad separada; este contrato no retira rutas.

## 12. Reglas fail-closed

| Caso | Resultado obligatorio |
|---|---|
| No autenticado, sesión ausente/inactiva o ownership mismatch | Denegar lectura y continuación; no revelar contexto propio de otra persona ni datos tenant. |
| Fuente obsoleta, 114D sin confirmar, versión 114D/114E inválida | `STALE_SOURCE`/recuperación; no reutilizar Path o snapshot cacheado. |
| Perfil conflictivo o transición sin evidencia | `PROFILE_CONFLICT`; no elegir destino por copy/CTA/IA ni coerción silenciosa. |
| Cero scopes reales | `NO_AUTHORIZED_SCOPE` provisional; no Home tenant. |
| Scope revocado, membresía/grant ausente o scope inyectado | Denegar lectura/escritura tenant, invalidar destino y revalidar; nunca confiar en ID cliente. |
| Validador de scope caído | `SCOPE_VALIDATION_FAILED`; no interpretar como cero scopes ni permitir acceso optimista. |
| `portfolio:write` o permiso de acción ausente | Denegar esa escritura aunque `portfolio:read` exista. |
| Initiative sin target, issuer, recipient, Assignment, aceptación o permiso requerido | Bloquear la acción correspondiente; no crear Project ni pasar a Steps. |
| Intento de fallback legacy | Rechazar para 114F; conservar recuperación segura sin Project/Step. |
| Error inesperado o retry incompatible | `ERROR`/conflicto; conservar fuente propia, no duplicar snapshot ni confirmar éxito. |

Los errores de seguridad no se convierten en una continuación soportada. La UI no afirma permisos o membresía mientras falte prueba del servidor.

## 13. Secuencia visible para la persona

1. **«Retomamos lo que ya entendimos».** Mostrar un resumen breve de la lectura 114D confirmada y el Path 114E actual como posible camino, con fuente y límites.
2. Mostrar lo conocido, lo confirmado **como representación**, lo provisional y los pendientes que importan; permitir revisar la fuente sin repetir la entrevista Entry.
3. Resolver scopes en servidor. Con uno, mostrar dónde continuará; con varios, pedir elección entre opciones autorizadas; con cero, explicar que el avance propio está guardado y cómo solicitar/establecer autoridad fuera de 114F.
4. Antes de continuar, indicar qué acción está autorizada ahora y qué sigue pendiente de autoridad organizacional. Un error de validación ofrece reintento, no un formulario de empresa.
5. Con acceso B revalidado, continuar a Portfolio Home / Bootstrap. Con acceso pendiente, permanecer en establecimiento provisional. La excepción Initiative aparece sólo si pasa §10.

Se pregunta únicamente por una elección o dato de scope/autoridad imposible de derivar de fuentes server-owned. No se vuelve a pedir meta, KPI, presupuesto o lista de iniciativas como requisito genérico de 114F.

## 14. Output conceptual e invariantes

```text
PortfolioSetupContinuation                    // contrato de experiencia; no schema DB
├── version; continuationStatus
├── sourceBinding: sessionId, criticalHandoffId/version, sourceContextRevision,
│                  confirmationVersion, pathRef/version?
├── continuationProfile: value, version, establishmentEvidence
├── identityBinding: authenticatedOwner, ownedSessionRevision
├── scopeState; organizationScope?; portfolioAccess: checkedCapabilities/checkedAt
├── carriedContext: confirmedRepresentationRefs, pathRef?, provenanceSummary
├── provisionalContext: classifiedClaims + sourceRefs
├── organizationalAuthorityRequirements: by claim/action
├── openItems: blockers + downstream items
├── initiativeException?: verified target/assignment/recipient/issuer refs and state
├── nextAuthorizedSurface
└── currentness/idempotency state
```

En estado provisional `organizationScope` y la referencia a snapshot persistido pueden faltar. `portfolioAccess` describe una verificación actual, no es un grant durable otorgado por este output.

```text
AUTHENTICATION != ORGANIZATIONAL_AUTHORITY
CONFIRMED_REPRESENTATION != ORGANIZATIONAL_TRUTH
PROVISIONAL_CONTINUATION != PORTFOLIO_MEMBERSHIP
PROFILE != PERMISSION
INVITATION != ACCEPT
ACCEPT != START
PORTFOLIO_CONTINUATION != PROJECT_CREATION
114F != PORTFOLIO_HOME
114F != CORE_CANONICALIZATION
114F != STEPS_ACTIVATION
LEGACY_AVAILABLE != LEGACY_AUTHORITY
```

## 15. Criterios de aceptación del contrato

KAN-132 verificó estos criterios sobre la semántica escrita; las marcas no son evidencia de implementación ni de pruebas runtime.

- [x] La secuencia 114D→114E→114F preserva contexto confirmado/provisional y no repite la entrevista Entry.
- [x] Gate y binding cubren identidad, ownership, revisión actual, versiones soportadas, perfil y ausencia de continuación incompatible.
- [x] Perfil server-owned estable o transición explícita/versionada; Path/CTA/IA no eligen ruta.
- [x] Acceso A/B/C y cero/uno/varios scopes están definidos; selección y cada acción tenant se revalidan en servidor.
- [x] Contexto provisional, representación confirmada, autoridad server-owned y verdad organizacional se distinguen por claim.
- [x] Unknowns y later work sobreviven con dueño, impacto y bloqueo acotado.
- [x] Fuente obsoleta, scope revocado y errores de validación fallan cerrados; snapshot/retry son determinísticos y currentness-bound.
- [x] 114F no crea Organization, StrategicFront, Challenge, Initiative/Project, Step ni decisión Core canónica.
- [x] Excepción Initiative requiere target y Assignment/issuer/recipient/permiso, y separa Invitation, Accept y Start.
- [x] No existe fallback 114F a rutas legacy Project/Steps; consumidores antiguos permanecen clasificados.
- [x] Handoff a Home/Bootstrap define datos, autoridad revalidable, ausencia de invenciones y ownership del trabajo posterior.

## 16. Disposición del contrato Post-Entry anterior y readiness

[Portfolio Post-Entry Continuation v0.1](../../../doc/experience/portfolio-entry/PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md) conserva su estado documental `PROPOSED FOR REVIEW`; su disposición en la frontera 114F superpuesta es `SUPERSEDED_IN_PART`. La continuidad sin repetición, separación de permisos y ausencia de Project/Steps automáticos siguen siendo compatibles. Sus campos `recommended_approach`, `starteria_path`, `recommended_cta` y handoff legacy no gobiernan la fuente 114D/114E actual. Este contrato aceptado gobierna la continuación 114F; no reescribe el contenido histórico ni promueve el contrato anterior.

```text
CONTRACT_STATUS: ACCEPTED / FROZEN FOR IMPLEMENTATION PLANNING
CONTRACT_AUTHORITY_STATUS: ACCEPTED_FOR_114F
SCOPE: 114F — Portfolio Setup Continuity only
CONTRACT_SEMANTICS_COMPLETE: YES
IMPLEMENTATION_PLANNING_AUTHORIZED: YES
TECHNICAL_AUDIT_AUTHORIZED: YES
RUNTIME_IMPLEMENTATION_AUTHORIZED: NO
IMPLEMENTATION_AUTHORIZED_NOW: NO
```

La completitud semántica incluye estados seguros cuando faltan grants, transición de perfil o issuer. La habilitación real de esas capacidades requiere políticas externas aceptadas, auditoría técnica/current-state, slice Jira de implementación y guardrail check. KAN-132 revisó la frontera con Activation para Assigned Challenge y el conflicto factual ADR-003/Core v0.3 registrado por KAN-129; ninguna de esas referencias promueve Core v0.3 ni autoriza runtime. El siguiente gate es **114F Technical Current-State Audit + Architecture**: debe determinar el esquema/runtime de `PortfolioEntryPortfolioContinuation`, ownership/currentness de sesión, persistencia de perfil, acceso/grants scoped, establecimiento de contexto, cero/uno/varios scopes, ruta de entrada a Home, dependencia Bootstrap, consumidores legacy, wiring de la excepción Initiative, gaps frente a este contrato, necesidad de cambio Prisma, frontera mínima API read/write y plan E2E/security/regression. Esta aceptación no resuelve esas decisiones técnicas.
