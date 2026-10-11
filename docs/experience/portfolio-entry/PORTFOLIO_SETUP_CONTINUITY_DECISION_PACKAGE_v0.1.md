# Portfolio Setup Continuity 114F — decision package v0.1

**Estado:** `PROPOSED_FOR_114F_CONTRACT_SHAPING`
**Fecha:** 2026-10-11
**HU:** KAN-128; **subtarea:** KAN-130
**Base examinada:** `origin/main` `55cfccd4784db36c283a2c495eb64d192b2b3127`
**Tipo:** decisión de producto y experiencia; no es el Experience Contract 114F ni autoriza implementación.

## 1. Autoridad y precondición

Orden aplicado: [Authority Map](../../STARTERIA_AUTHORITY.md) → [Core v0.2 factual](../../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md) (`Base fundacional revisada / Por validar`) → [ADR-003](../../../doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md), [ADR-004](../../../doc/product-adr/ADR-004-authenticated-continuation-access-and-initiative-handoff-authority.md) y [ADR-005](../../../doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md), aceptados dentro de sus límites → [Portfolio Entry Logic v0.1](../../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md) aprobado → [Activation v0.2](../../portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md) para su bounded context. [Post-Entry v0.1](../../../doc/experience/portfolio-entry/PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md) sigue `PROPOSED FOR REVIEW`: es insumo de revisión, no autoridad aprobada. El Core v0.3 en `docs/core/` sigue candidato.

El [informe KAN-129](../../implementation/portfolio-entry/KAN-129_ADR003_114F_AUTHORITY_RECONCILIATION_v0.1.md), [CURRENT_STATE](../../../CURRENT_STATE.md), [Manifest](../../../STARTERIA_V2_MANIFEST.md) y Jira KAN-128/KAN-130 fijan la precondición factual:

```text
ADR003_STATUS: ACCEPTED
114F_SHAPING_READY: YES
114F_IMPLEMENTATION_READY: NO
ADR001_DISPOSITION: SUPERSEDED_IN_PART (sin cambiar su estado documental PROPOSED)
POST_ENTRY_CONTRACT_READINESS: READY_FOR_REVISION (estado documental aún PROPOSED FOR REVIEW)
114E_IMPLEMENTATION_STATUS: IMPLEMENTED_VERIFIED (slice acotado, no activación comercial)
114F_IMPLEMENTATION_STATUS: NOT_IMPLEMENTED
```

ADR-003 §§3–4 separa identidad, confirmación y verdad organizacional. ADR-004 §§4–9 separa continuación provisional de acceso Portfolio y de autoridad Portfolio Lead. ADR-005 §§6–14 separa Assignment, Invitation, Accept y Start. Core v0.2 INV-01/02/03/05 y §§5, 7 preserva separación Portfolio/Initiative, autoridad humana y procedencia. Este paquete mantiene esas fronteras; no cambia Core, Steps, jerarquía de autoridad ni estados de contratos o índices.

## 2. Frontera de experiencia

```text
114D: lectura crítica actual y confirmada (representación de intención)
  → 114E: Starteria Path / valor derivado, si está actual y disponible
  → 114F: restaurar contexto, verificar identidad/perfil/scope y conservar pendientes
  → contexto Portfolio autorizado O establecimiento provisional seguro
  → Portfolio Home / Bootstrap sólo con el acceso que corresponda
```

La pregunta de 114F es cómo conservar la lectura y el Path al pasar a un contexto de trabajo autorizado, sin pedir otra vez lo ya declarado. La ruta por defecto es Portfolio. 114F no crea Organization, StrategicFront, Challenge, Initiative/Project, Step, decisión empresarial, KPI aprobado, ni asignación de Initiative Owner. Tampoco aprueba estrategia ni activa ejecución. 114E no gobierna routing: el Path semántico es derivado, y una CTA comercial no concede acceso al producto.

## 3. Decisión de acceso y scope — `CLOSED` para 114F v0.1

**Decisión preferida:** adoptar tres umbrales distintos. La autoridad se comprueba en servidor en cada operación material; un snapshot o una pantalla nunca actúan como grant.

| Umbral | Evidencia mínima server-owned | Habilita |
|---|---|---|
| A. Provisional autenticado | identidad verificada; sesión Entry activa, `CLAIMED` y propiedad del usuario; fuente 114D última, actual, explícitamente confirmada y vinculada a la revisión vigente; perfil conocido y compatible | ver su propio contexto llevado, resolver scope y recuperar la sesión; no datos de otra organización |
| B. Lectura organizacional | A + organización existente + `OrganizationMember` vigente de ese usuario/organización + `OrganizationPortfolioAccessGrant` vigente `portfolio:read` para la misma organización | leer el Portfolio de ese scope y pasar a Home/Bootstrap autorizado |
| C. Escritura organizacional | B + grant `portfolio:write` explícito para ese mismo scope + permiso de la operación/objeto y validación de versión/autoridad humana que esa operación exija | sólo la acción concreta autorizada; `write` no sustituye `read` |

El modelo scoped existente está documentado en [Scoped Access Authority](../../portfolio-entry/implementation/PORTFOLIO_SCOPED_ACCESS_AUTHORITY_v0.1.md). `OrganizationMember`, grant `portfolio:read` y grant `portfolio:write` son hechos distintos; rol global, `User.organizationId`, perfil Entry, `portfolioScope` JSON y texto del usuario no sustituyen ninguno. `PORTFOLIO_LEAD_ENTRY` significa orientación de ruta, no autoridad Portfolio Lead. Autoridad Portfolio Lead para aprobar, estructurar o emitir un handoff requiere capacidad/política de acción y target comprobada aparte.

Identidad verificada + sesión owned bastan para **recuperar** una continuación provisional anterior a 114F (ADR-004). Para **avanzar por 114F desde 114D/114E** se añade el gate de fuente actual y confirmada de la fila A. Si falla, la persona puede volver a revisar su Entry sin recibir acceso organizacional.

La resolución de contextos usa sólo organizaciones para las que B pasa en ese momento, según [Context Establishment](../../portfolio-entry/implementation/PORTFOLIO_ENTRY_AUTHENTICATED_PORTFOLIO_CONTEXT_ESTABLISHMENT_v0.1.md):

| Scopes de lectura válidos | Decisión v0.1 |
|---|---|
| Cero | conservar sesión y contexto propio en estado provisional; mostrar que falta un espacio autorizado y la vía de recuperación/solicitud gobernada; no crear membresía, organización ni grant |
| Uno | mostrar el nombre del espacio y continuarlo tras revalidación del servidor; no exigir una selección redundante |
| Varios | mostrar sólo opciones autorizadas; selección explícita de la persona y revalidación del ID en servidor antes de persistir o leer |

Un fallo técnico al validar scope no se interpreta como cero grants: se muestra recuperación/reintento sin datos tenant. Una revocación invalida la lectura y los destinos derivados, aunque exista continuación previa. 114F puede **establecer contexto** provisional sin conceder membresía Portfolio. Consume identidad, propiedad de sesión, membresías, grants y políticas ya emitidos por autoridades externas; **no** emite, eleva, renueva ni revoca membresía/grants. El emisor, aprobación, duración y revocación de grants siguen como dependencia externa. Hasta que una política aceptada los gobierne, el usuario sin scope sólo tiene el estado provisional. No hay autoaprovisionamiento por registro, confirmación o elección de organización.

## 4. Perfil de continuación server-owned — `CLOSED` para 114F v0.1

El enum persistido actual ofrece `PORTFOLIO_LEAD_ENTRY` e `INITIATIVE_ENTRY` (`front/prisma/schema.prisma`, `PortfolioEntrySession.continuationProfile`). La creación de sesión pública fija `PORTFOLIO_LEAD_ENTRY` en el servicio de sesiones; el servicio `continue-portfolio` exige ese valor y `convert` exige `INITIATIVE_ENTRY`. La búsqueda de código productivo no mostró un transition command gobernado que cambie al segundo perfil; la capacidad de almacenar el enum no prueba autoridad para elegirlo.

| Perfil v0.1 | Significado | Destino permitido |
|---|---|---|
| `PORTFOLIO_LEAD_ENTRY` | orientación server-owned de esa sesión hacia continuidad Portfolio; puede seguir provisional si no hay scope | establecimiento 114F; Home/Bootstrap sólo tras B |
| `INITIATIVE_ENTRY` | excepción ligada a un Assignment/target y una transición explícita gobernada anterior a la conversión | Handoff Shell/Overview del target, sólo al pasar §9; nunca por el valor del enum solo |

El perfil es **estado de routing provisional de la sesión**, no rol canónico, membresía ni permiso. Regla v0.1: la creación de Entry público establece el default Portfolio una sola vez; claim, registro, confirmación, 114E y 114F lo conservan. Sólo un comando server-owned separado, auditable y aprobado para transición explícita puede cambiarlo. Debe verificar sesión owned, fuente actual, target/Assignment existente, destinatario, issuer y política scoped, confirmar la elección consciente del usuario cuando cambia la ruta, registrar `from/to`, actor, razón, policy/version, fuente/revisión y versión de perfil; usar CAS e idempotencia. Antes de que exista tal transición aceptada e implementada, el perfil permanece estable. Un `INITIATIVE_ENTRY` antiguo sin prueba de esa transición se aísla como compatibilidad y no abre la excepción 114F.

La confirmación 114D prueba representatividad de la lectura; puede informar la transición, pero no selecciona el perfil ni convalida la autoridad del target. Cambios de fuente, perfil o Assignment invalidan destinos/snapshots anteriores. El servidor rechaza perfil nulo o desconocido para cualquier destino material, transición sin evidencia/versionado, conversión desde `PORTFOLIO_LEAD_ENTRY`, y retorno a Portfolio por coerción silenciosa desde `INITIATIVE_ENTRY`. CTA, query param, último mensaje, sugerencia de IA, `recommended_cta`, `starteria_path` legacy o estado frontend no eligen perfil.

## 5. Persistencia de continuidad Portfolio — `CLOSED`: `ADAPT`

**Decisión preferida:** adaptar `PortfolioEntryPortfolioContinuation` como snapshot de transferencia **sólo cuando existe scope de lectura validado**. Es una identidad de continuidad ya consumida por Bootstrap/Home; no es grant ni fuente de verdad empresarial. `PortfolioHandoffAssignment` de ADR-005 es otro objeto, para lifecycle de handoff Initiative Owner, y no reemplaza este snapshot. En ausencia de scope, la sesión y el Critical Handoff 114D ya persistidos sostienen el contexto provisional propio; el objeto de continuación puede seguir ausente. No fabricar `portfolioScope` para crear una fila.

Snapshot conceptual mínimo, no esquema DB final:

| Grupo | Contenido requerido / regla |
|---|---|
| Identidad | `continuationId`, `sessionId`, `ownerUserId`, estado, `createdAt`, `updatedAt`, `supersededAt?` si se admite una revisión posterior |
| Fuente | `sourceCriticalHandoffId`, versión de artefacto, `sourceContextRevision`, estado/tiempo de confirmación, versión de contrato/proyector usada; 114E `starteriaPathVersion` o referencia/binding si se muestra Path, nunca su semántica duplicada |
| Perfil | valor, versión y evidencia de establecimiento/transición del perfil; compatibilidad de fuente y destino |
| Scope | `organizationScopeId` validado y, sólo si existe como entidad autorizada distinta, `portfolioScopeId?`; versión/referencia de grant o policy como evidencia diagnóstica, con revalidación live en cada lectura/acción |
| Contexto | proyección mínima de lectura/decisión confirmada como **representación**, contexto declarado/provisional con clases por campo, `openItems`, unknowns y resumen de procedencia con source refs |
| Concurrencia | binding de fuente + sesión + usuario + perfil + scope + operación y clave de idempotencia; misma solicitud válida devuelve el mismo resultado; cambio material crea revisión/supersesión gobernada, nunca sobrescritura invisible |

No copiar conversación cruda completa, razonamiento oculto, metadatos de proveedor/modelo, `rawEntry` completo como duplicado indiscriminado, `semanticState` completo, ni `promptManifestId` al snapshot 114F. No duplicar el Path derivado cuando una referencia reproducible basta. Tampoco convertir metas, KPI, prioridades, listas u ownership declarados por el usuario en StrategicFront/Challenge/Initiative canónicos. El origen 114D y los campos de procedencia siguen conservados donde pertenecen.

**Gap de implementación para el contrato posterior:** la fila actual es única por sesión, contiene `handoffId`/`confirmationId` y `sourceSnapshot` construido desde el handoff legacy, incluye `rawEntry`, `semanticState` y `promptManifestId`, y guarda `portfolioScope` sólo después de un grant de lectura. El servicio actual devuelve una fila existente antes de verificar su binding contra el Critical Handoff 114D actual y la idempotencia puede devolver una respuesta cacheada. El contrato 114F deberá especificar adaptación/lecturas y tests de currentness, revocación y redacción de snapshot; este documento no ordena migración ni transforma filas históricas. Los lectores de filas legacy permanecen `KEEP_COMPAT` con discriminador de versión, sin elevarlas a snapshots 114F.

## 6. Verdad provisional frente a autoridad organizacional

Cuatro clases de presentación/transferencia, aplicadas **por claim o campo**, no a toda la sesión:

| Clase | Significado | Ejemplos |
|---|---|---|
| `PROVISIONAL_USER_CONTEXT` | declaración, extracción o sugerencia aún no validada por la organización; retener subtipo y fuente | meta de empresa descrita por usuario, KPI target propuesto, prioridad estratégica declarada, lista de iniciativas, presupuesto, capacidad, apetito de riesgo, owner de Challenge/Strategic Front declarado |
| `CONFIRMED_REPRESENTATION` | la persona confirmó que la lectura representa su intención; no certifica verdad objetiva | marco de decisión 114D confirmado, correcciones de la persona, lectura que 114E presenta desde esa fuente |
| `SERVER_AUTHORITY` | identidad, ownership, revisiones, perfil y elegibilidad calculados desde registros/políticas del servidor | sesión owned, fuente 114D actual, perfil/versionado, capability derivada del grant |
| `ORGANIZATIONAL_AUTHORITY_REQUIRED` | requiere una persona/política/fuente con mandato para aprobar como verdad empresarial | KPI aprobado, prioridad oficial, presupuesto/capacidad comprometidos, riesgo aprobado, Challenge/Strategic Front Owner oficial, alineamiento, decisión corporativa |

La membresía `OrganizationMember` validada y el grant Portfolio son `SERVER_AUTHORITY` **sobre acceso**, no aprobación del contenido de negocio. `Starteria Path` es una proyección derivada de `CONFIRMED_REPRESENTATION` y límites de capacidad; no es decisión organizacional ni perfil. `openItems` retienen su clase original y estado sin volverse hechos por haber sido trasladados. Una declaración puede estar también marcada `ORGANIZATIONAL_AUTHORITY_REQUIRED` para su uso canónico: se conserva como provisional hasta que llegue esa validación.

## 7. Open items y unknowns

Cada pendiente llevado necesita ID/source ref, tipo, descripción breve, impacto en la decisión o acción, autoridad/evidencia requerida, estado y siguiente dueño/superficie; conservar distinción entre:

| Tipo | Tratamiento 114F |
|---|---|
| `DECISION_CHANGING_UNKNOWN` | visible junto al marco confirmado; sólo bloquea scope si impide identificar inequívocamente la organización; bloquea una acción si su contrato exige resolverlo |
| `ORGANIZATIONAL_AUTHORITY_UNKNOWN` | no puede confirmarse por autodeclaración; bloquea el acceso o la acción que depende de esa autoridad; puede permanecer visible para trabajo posterior si no afecta el acceso actual |
| `EXTERNAL_EVIDENCE_UNKNOWN` | conservar fuente faltante; no bloquear por defecto la entrada Portfolio, sí cualquier afirmación o decisión que necesite esa evidencia |
| `LATER_WORK` | entregar a Home/Bootstrap como trabajo futuro; no convertir en bloqueo actual ni campo obligatorio |
| `UNSUPPORTED_ASSUMPTION` | mostrar como supuesto sin soporte; no usar para grants, perfil, scope o canonicalización; pedir verificación sólo en el punto donde cambia una decisión |

Un unknown bloquea **establecimiento de scope** únicamente si impide verificar identidad, ownership, pertenencia o grant para un target concreto, o si la selección sigue ambigua. Bloquea **acción organizacional** si falta permiso/autoridad o el dato requerido por esa acción. Puede ser **visible y no bloqueante** para explorar un contexto propio y para la lectura Portfolio cuando el permiso ya existe. Home/Bootstrap decide cómo trabajar unknowns de estrategia, evidencia y priorización después del handoff. 114F no convierte todos los pendientes en un formulario corporativo.

## 8. Final de 114F y mínimo handoff a Home/Bootstrap

114F termina cuando están verificados identidad y propiedad de sesión, 114D actual/confirmado, perfil y fuente 114E actual si se usa, y cuando el scope está validado **o** explícitamente sin resolver en estado provisional seguro. El contexto está persistido en las fuentes owned y, si hay scope B, en un snapshot de continuidad ligado a ellas. Cada campo llevado conserva su clase, los pendientes sobreviven y el servidor conoce la próxima superficie permitida.

Handoff mínimo: identidad de continuidad (o sesión provisional), source binding/versiones, perfil, scope y resultado de autorización actual, contexto presentado con procedencia/clases, pendientes, destinos autorizados y `next_authorized_surface`. Si B existe: entregar a Home/Bootstrap con su read model sujeto a revalidación de acceso. Si B falta: quedarse en establecimiento provisional, sin cargar Home organizacional. Home/Bootstrap se encarga de anchor, trabajo existente, atención y decisiones; 114F no se convierte en Home ni crea su estructura. [Bootstrap Logic](../../portfolio-lead/03-bootstrap-home/PORTFOLIO_BOOTSTRAP_HOME_LOGIC_CONTRACT_v0.1.md) exige continuidad sin repetición; [Home Read Model](../../portfolio-lead/06-portfolio-home-governance/PORTFOLIO_HOME_READ_MODEL_CONTRACT_v0.1.md) es proyección de lectura y conserva procedencia.

## 9. Excepción Initiative y autoridad de handoff — `CLOSED` como gate v0.1

La excepción se **consume**, no se crea por defecto en 114F. Para mostrarla como destino deben existir, bajo ADR-003/004/005 y Activation v0.2:

1. fuente Entry actual/confirmada, sesión owned y perfil `INITIATIVE_ENTRY` establecido mediante transición gobernada antes de conversión;
2. `PortfolioHandoffAssignment` vigente, versionado y target-scoped, emitido por actor que pasó una política server-owned explícita para ese target, con issuer y destinatario registrados; ninguna etiqueta de rol global basta;
3. identidad invitada ligada a la identidad autenticada; invitación vigente, no revocada/expirada/rechazada, permiso de lectura/acción del target y scope organizacional correspondientes;
4. para **Assigned Initiative**, Initiative/Project canónico existente y referenciado, además de Challenge/relación requerida; para **Assigned Challenge**, Challenge existente con `initiative_ref = null`, sin fabricar Initiative;
5. aceptación explícita, idempotente y sobre versión actual sólo si la persona decide aceptar; abrir/claim de invitación no equivale a Accept;
6. `Start` como comando separado, posterior a Accept, con permiso y versión actual; 114F no ejecuta Start ni abre Steps. Steps sólo tras el boundary downstream autorizado y nunca por inferencia de 114F.

El target específico, recipient, issuer, policy/version, assignment state/version y fuente/perfil deben coincidir al leer y al actuar. Un retry no duplica Assignment, Accept ni Start. Si falta cualquiera, la rama Initiative no está disponible: se conserva la lectura propia en recuperación provisional sin cambiar el perfil; Home requiere B y, si el perfil era `INITIATIVE_ENTRY`, una transición gobernada compatible. Esto **cierra el criterio negativo de 114F**, pero la política concreta que asigna la capability de issuer y la integración Public Entry→Assignment siguen fuera de este paquete. No se inventa un rol global `Initiative inviter`.

## 10. Actores: límites necesarios para 114F

| Actor | Routing 114F | Establecer scope org/Portfolio | Emitir handoff Initiative | Evidencia requerida |
|---|---|---|---|---|
| Challenge Owner | No por el nombre/campo; condicional sólo por Assignment/target válido | No por ownership declarado; condicional sólo con membresía + grant scoped | Condicional sólo con política explícita para el target | identidad, target/Challenge canónico, assignment y capability/policy versionada |
| Strategic Front Owner | No por el nombre/campo; condicional sólo por política de ruta del target | No por `ownerId`; condicional sólo con membresía + grant scoped | Condicional sólo con política explícita para el target | identidad, frente/scope canónico, mandato y capability/policy versionada |
| Sponsor / Responsable del Reto | No por etiqueta; sólo si otra autoridad de ruta aplica | No por sponsorship; condicional sólo con membresía + grant scoped | **No por defecto**; condicional sólo por asignación y política organizacional específica | identidad, responsabilidad puntual, scope/target y mandato para ese acto |

La capacidad de participar en una revisión o confirmar contexto no es capacidad de conceder acceso ni emitir invitaciones. No se resuelve aquí el modelo global de roles ni se infiere autoridad de campos de owner/sponsor; en ausencia de evidencia, la respuesta es **NO**.

## 11. Compatibilidad legacy — `CLOSED` como clasificación y gate de retiro

Inventario de consumidores observado en KAN-129 y en `front/src`, `backend`, `front/e2e` y `scripts` sobre la base indicada. La clasificación aplica al **caller/branch**, no elimina una ruta compartida válida.

| Superficie / consumidor | Clase para este paquete | Tratamiento futuro condicionado |
|---|---|---|
| `/auth/continue/:draftId` (draft público/pilot lead) | `KEEP_COMPAT` | `DEPRECATION_TARGET` tras reemplazo de links y auditoría de consumidores/tráfico; no autoridad 114F |
| `/public/continuar` | `KEEP_COMPAT` | conservar resume por código de piloto hasta migración/expiración demostrada |
| `/continuar-piloto` | `KEEP_COMPAT` | `RETIRE_WHEN_REPLACED` para el caller piloto, tras demostrar destino y ausencia de tráfico requerido |
| pilot claim y `consume-claim` | `KEEP_COMPAT` | claim autoriza sólo flujo piloto histórico; no es Invitation/Assignment ni grant Portfolio |
| `createProjectFromPublicDraft` (AuthPage/AppContext) | `DEPRECATION_TARGET` | reemplazar el caller de Public Entry y probar que no llega a Project/Step 0 por defecto antes de retirarlo |
| `/projects/new?challengeId=...` | `KEEP_COMPAT` para caller de handoff antiguo; `DO_NOT_TOUCH` para creación independiente válida | retirar sólo el caller Challenge→Project sustituido; conservar uso ajeno legítimo según ADR-005 §27.1 |
| Portfolio Entry `/convert` → Project/Steps | `KEEP_COMPAT` para sesiones históricas y excepción explícita ya autorizada | auditar perfil, provenance y consumidores; `ADAPT` sólo en slice Initiative con autoridad propia; nunca fallback 114F |
| `continue-portfolio` y lectura de `PortfolioEntryPortfolioContinuation` | `ADAPT` | reusar identidad/scope con fuente 114D, clases y currentness 114F; preservar lectura legacy discriminada hasta reemplazo validado |

Condiciones comunes antes de retiro: inventario completo de call sites, deep links y tráfico real; reemplazo con contrato/slice aceptados; migración o expiración de links/sesiones existentes; pruebas negativas y E2E del recorrido nuevo y compatibilidad; observabilidad sin dependencia productiva necesaria; aprobación separada de retiro. No hay borrado de ruta, dual authority permanente, backfill inventado ni fallback automático desde 114F a Project/Steps. El [ADR-005 §17–21](../../../doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md) manda cuarentena por caller.

## 12. Secuencia de experiencia propuesta

| Estado | Qué ve la persona / qué pide Starteria | Salida segura |
|---|---|---|
| 1. Autenticada + Entry owned | resumen de la lectura confirmada y que se conservará el avance; no pregunta de negocio repetida | iniciar verificación de fuente/perfil |
| 2. Cargando contexto | progreso breve; sin prometer acceso hasta resolver servidor | mostrar lectura propia sólo tras source gate |
| 3. Un scope autorizado | nombre del espacio, contexto llevado y pendientes con su clase; pregunta mínima: «¿Continuar en este espacio?» sólo si la confirmación aporta claridad | revalidar y entregar snapshot a Home/Bootstrap |
| 4. Varios scopes | nombres de espacios autorizados; «¿En cuál corresponde revisar este contexto?» | elección explícita, revalidada en servidor |
| 5. Sin scope autorizado | lectura propia y avance guardado; explicación de que falta acceso/ubicación; pedir contacto/solicitud gobernada, sin crear grant | establecimiento provisional, sin Home tenant |
| 6. Validación de scope fallida | mensaje de error recuperable, sin afirmar falta de permisos ni mostrar datos tenant | reintento seguro; soporte si persiste |
| 7. Fuente Entry obsoleta | aviso de que la lectura cambió o ya no está vigente; ofrecer volver a revisión 114D | no continuar ni reutilizar snapshot viejo |
| 8. Perfil incompatible | explicar que ese recorrido necesita una transición autorizada; no convertir la ruta | mantener contexto; transición gobernada o recuperación |
| 9. Handoff Initiative explícito disponible | mostrar target, emisor, destinatario y estado verificados; preguntar si desea revisar ese encargo | Handoff Shell; Accept y Start se deciden allí por separado |
| 10. Recuperación segura | conservar sesión y pendientes; mostrar próxima acción autorizada, reintentar lectura o volver a Entry | nunca enviar automáticamente al piloto, Project o Steps |

La superficie pregunta sólo por scope/autoridad faltantes. Ningún estado exige formulario general de empresa, KPI, lista de iniciativas o taxonomía del Core para entrar.

## 13. Objeto conceptual de salida

```text
PortfolioSetupContinuation (producto/experiencia; no schema)
├── continuation_status: PROVISIONAL_SCOPE_UNRESOLVED | PORTFOLIO_AUTHORIZED | RECOVERY_REQUIRED
├── continuation_id? / session_id / owner_user_id
├── source_binding: critical_handoff_id + artifact_version + source_context_revision
│   └── path_projection_ref/version? (si se usa 114E)
├── continuation_profile: value + version + establishment_evidence
├── identity_binding: authenticated_owner + session_revision
├── organization_scope: validated_id? + selection_state
├── portfolio_access: read/write capability refs + checked_at (siempre revalidables)
├── carried_context: confirmed decision frame + source refs
├── provisional_context: claims tipados + procedencia
├── organizational_authority_requirements: por acción/claim, no rol inventado
├── open_items: unknowns, later work, unsupported assumptions
├── available_destinations: sólo opciones verificadas
├── next_authorized_surface: context establishment | Portfolio Home/Bootstrap | Handoff Shell | recovery
└── legacy_compatibility_metadata?: discriminador de origen, nunca permiso
```

En `PROVISIONAL_SCOPE_UNRESOLVED`, `continuation_id` y `organization_scope.validated_id` pueden faltar: las fuentes owned persistidas preservan la continuidad. `portfolio_access` no es un booleano guardado que otorgue autoridad. El objeto separa dato presentado, evidencia de acceso y requisitos pendientes.

## 14. Reglas fail-closed

| Condición | Resultado |
|---|---|
| fuente 114D ausente, no confirmada, no última o `sourceContextRevision` desactualizada; Path 114E obsoleto si se usa | no continuar; volver a revisión/recuperación sin mostrar Path cacheado |
| identidad o propiedad de sesión no coinciden; sesión expirada/abandonada | no lectura ni continuación |
| cero scopes válidos | sólo contexto propio provisional; ningún dato/acción organizacional |
| membresía/grant faltante, revocado o de otro scope; validación técnica fallida | ninguna lectura/escritura tenant; revalidar, nunca confiar en snapshot |
| `portfolio:write` ausente o política de objeto no satisfecha | negar escritura aunque exista lectura |
| perfil ausente/incompatible, transición no probada o versión vencida | sin coerción de ruta ni conversión |
| issuer/recipient/target/Assignment/Accept/Start sin evidencia válida | ocultar/bloquear la acción Initiative correspondiente; conservar lectura provisional y recuperar sin cambiar perfil |
| retry con binding distinto o destino incompatible | conflicto; no segundo snapshot ni doble conversión |
| ruta legacy aún disponible | nunca fallback automático; uso sólo por consumidor histórico autorizado |

## 15. Dependencias externas y gaps de implementación

1. **Emisión de grants:** definir y aceptar quién puede conceder/revocar `OrganizationPortfolioAccessGrant`, con qué prueba, vigencia y auditoría. 114F v0.1 funciona sin esa emisión mediante estado provisional; no la implementa.
2. **Transición de perfil:** diseñar un comando/versionado server-owned si se quiere ofrecer Initiative desde Entry. Hasta entonces el default Portfolio es estable y la excepción no se habilita por enum legado.
3. **Issuer por target e integración Invitation/Assignment:** política concreta que conceda capacidad al actor y verifique recipient/target. El gate de §9 permite contract shaping sin afirmar que una ruta Initiative ya esté lista.
4. **Adaptación del snapshot:** fuente 114D en vez de handoff legacy; binding/currentness, minimización, clases, revocación, idempotencia y compatibilidad de filas antiguas. No hay schema final decidido.
5. **Revisión de Post-Entry v0.1 y ADR-001:** reemplazar referencias legacy y mantener sus estados hasta decisión humana. ADR-003 §1 llama canónico al Core v0.3; KAN-129 registra ese conflicto factual. Este paquete sigue Core v0.2, sin editar el ADR.
6. **Retiro legacy:** inventario de tráfico y reemplazos autorizados por caller, más E2E; ninguna ruta se retira aquí.

Estos asuntos **no** impiden escribir y someter a aceptación un Experience Contract 114F v0.1 si éste conserva los gates negativos, el provisional sin scope y las dependencias explícitas. Sí impiden implementación y habilitación de las ramas/capacidades que dependen de ellos. Antes de implementar se requieren contrato aceptado, HU técnica/slice y `V2_CHANGE_GUARDRAIL_CHECK`; el cierre de una implementación requerirá `V2_CHANGE_CLOSURE_CHECK` y evidencia.

## 16. Readiness

```text
ACCESS_SCOPE_DECISION: CLOSED
CONTINUATION_PROFILE_DECISION: CLOSED
PORTFOLIO_SNAPSHOT_DECISION: CLOSED
INITIATIVE_HANDOFF_AUTHORITY_DECISION: CLOSED (gate negativo; issuer provisioning externo)
LEGACY_COMPAT_DECISION: CLOSED (clasificación y retiro condicionado; sin retiro ahora)
114F_CONTRACT_READY: YES (para redactar y revisar, no autoaceptar)
114F_IMPLEMENTATION_READY: NO
```

Siguiente paso: redactar/revisar el Experience Contract 114F desde este paquete y la autoridad superior; someterlo a decisión humana. El Manifest mantiene 114F `CANDIDATE / NOT_IMPLEMENTED` mientras esa aceptación y la slice técnica no existan.
