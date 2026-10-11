# KAN-129 — ADR-003 factual reconciliation and 114F authority gate v0.1

**Estado:** AUDIT / GOVERNANCE COMPLETE; 114F RUNTIME NOT AUTHORIZED
**Fecha:** 2026-10-11
**Base:** `origin/main` = `bf5547cf06e67ea929e1c37fbe44b2155ab454df`
**Rama:** `docs/KAN-129-adr003-114f-reconciliation`
**Tickets:** KAN-128 (parent) y KAN-129 (subtarea). Sin cambios de runtime, contratos de `doc/`, Core, Steps, Prisma o rutas.

## 1. Base de autoridad y precondición

Se leyeron `docs/STARTERIA_AUTHORITY.md`, `CURRENT_STATE.md`,
`STARTERIA_V2_MANIFEST.md`, Core v0.2, índice de ADRs de producto, ADR-001,
ADR-003, Portfolio Entry Logic Contract v0.1, Post-Entry Continuation Contract
v0.1, las tres auditorías solicitadas de 2026-09-25, y KAN-128/KAN-129 en Jira.
También se contrastaron ADR-004 y ADR-005, el contrato de activación/handoff
v0.2, los informes de acceso scoped, establecimiento de contexto y Portfolio
Home, el código y las referencias actuales de legacy. No se interpretó una
auditoría anterior como autoridad superior al Core, ADRs aceptados o contratos
aprobados.

Orden aplicable: Core v0.2 factual (`Base fundacional revisada / Por validar`)
→ ADR de producto aceptado, confirmado por su documento e índice → Experience
Contract aprobado → contratos subordinados → evidencia y código. El Core v0.3
en `docs/core/` sigue siendo candidato. El contrato Portfolio Entry Logic v0.1
está aprobado; el Post-Entry Continuation v0.1 sigue propuesto. ADR-003 es de
diseño y declara `IMPLEMENTATION AUTHORIZED: NO`.

## 2. Estado factual de ADR-003

```text
ADR003_STATUS: ACCEPTED
```

`doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md`
declara `Estado: ACCEPTED` (§0) y `STATUS: ACCEPTED` (§12). El índice canónico
`doc/product-adr/ADR-INDEX.md` registra ADR-003 como `Aceptado`. `git log`
sitúa la aceptación en `65b68ad` (2026-09-25 16:11 +02:00), después de las
tres auditorías (`63356ef` 12:26, `93c152c` 12:58 y `bc24259` 15:33).
Ninguna fuente
superior revoca ese estado. `CURRENT_STATE.md` y la Authority Map conservaban
un enunciado corriente `PROPOSED / OPEN / DEFERRED` derivado de una etapa
anterior; no son un veto superior a ambos registros del ADR. La aceptación
fija la frontera de producto, no acredita su integración ni autoriza 114F.

Hay una inconsistencia factual distinta dentro de ADR-003 §1: llama
«canonical Core v0.3» al documento que Authority Map §3 y Portfolio Entry
Logic §0 clasifican como candidato; Core v0.2 conserva la primacía. Las reglas
de autenticación, procedencia, autoridad humana y Portfolio/Initiative de
ADR-003 son compatibles con Core v0.2 INV-01/02/03/04/05. Esta observación no
altera el estado de ADR-003 ni sus semánticas y queda fuera de la edición
autorizada de KAN-129.

```text
CONFLICT
Contract: Core v0.2; Authority Map §3.
Requirement: el Core factual vigente es v0.2; v0.3 es candidato.
Current document/code: ADR-003 §1 llama canónico al Core v0.3.
Observed mismatch: la premisa documental de versión no coincide con la jerarquía vigente.
Risk: usar v0.3 como autoridad implícita durante 114F.
Recommended treatment: UPDATE la referencia factual en una subtarea documental autorizada, sin cambiar la decisión ADR-003.
Requires ADR: no, mientras no se altere un invariante Core ni la decisión de producto.
```

## 3. Inventario de referencias y distinción temporal

| Referencia | Clase | Tratamiento KAN-129 |
|---|---|---|
| ADR-003 §0/§12 e índice de producto | `CURRENT_AUTHORITATIVE` | Conservar `ACCEPTED`. |
| Authority Map, antigua sección «discrepancia abierta y diferida» | `CURRENT_STALE` | Reconciliada aquí. |
| `CURRENT_STATE.md` §ADR-003 y enunciados corrientes `PROPOSED / OPEN / DEFERRED` | `CURRENT_STALE` | Reconciliados aquí; los checkpoints antiguos se rotulan como observaciones de entonces. |
| Manifest, visual 114E y frase que usaba la discrepancia ADR-003 como bloqueo actual | `CURRENT_STALE` | Reconciliado; `V2_PILOT` se conserva por el estado de la jornada completa y los consumidores legacy. |
| Auditorías `PORTFOLIO_ENTRY_ADR003_RECONCILIATION_AND_NEGATIVE_GUARDS`, `CONTINUATION_OWNERSHIP_PROFILE_AUDIT` y `SERVER_OWNED_CONTEXT_AND_INVITATION_AUDIT` (2026-09-25) | `HISTORICAL_CORRECT_AT_TIME` | Conservar sus `PROPOSED` y hallazgos como evidencia fechada; sus conclusiones de readiness no se promueven automáticamente. |
| KAN-119 cierre 114D; KAN-121 audit; KAN-124 arquitectura; KAN-125D/125F informes; KAN-127 política | `EVIDENCE_ONLY` | Sus descripciones de una discrepancia entonces abierta se preservan como snapshots; no son índice de estado actual. |
| Business Capability Boundary 114E y Starteria Path Experience Contract 114E, adoptados sólo en 114E | `CURRENT_STALE` para frases que dicen «remains OPEN»; `HISTORICAL_CORRECT_AT_TIME` para la decisión de excluir 114F al adoptarse | No se reescriben contratos 114E fuera del alcance permitido. La Authority Map/Manifest actuales y este inventario prevalecen para el estado ADR-003; próxima revisión contractual debe actualizar esas frases. |
| Skill `entry-05` KAN-114, congelada sólo para síntesis previa al registro | `HISTORICAL_CORRECT_AT_TIME` en su scope; `CURRENT_STALE` si se lee su frase de discrepancia como estado global actual | Conservar la exclusión 114F; corregir la referencia de estado en una revisión de esa Skill, sin cambiar KAN-114. |
| ADR-003 §1 sobre Core v0.3 y §12 `DECISION: CANDIDATE` junto a `STATUS: ACCEPTED` | `AMBIGUOUS` de redacción, no de status | Seguir Core v0.2 y el estado explícito del ADR/índice; no editar ADR-003 en KAN-129. |
| ADR-001 y Post-Entry Continuation Contract v0.1 | `CURRENT_AUTHORITATIVE` sólo respecto de su propio estado `PROPOSED`; no autoridad funcional aprobada | Conservar propuestos; revisar antes de aceptación. |

Los informes fechados no se reescriben para afirmar que ADR-003 «siempre» fue
aceptado. Los registros de exclusión de 114D y 114E describen el alcance de
esas slices al cerrarse; KAN-129 no cambia retrospectivamente lo que hicieron.

## 4. Invariantes aplicables a 114F, sólo dentro de ADR-003

| Invariante | Apoyo preciso |
|---|---|
| `AUTHENTICATION != BUSINESS_CANONICALIZATION`; `REGISTRATION_PRESERVES_CONTINUITY != CANONICALIZATION` | ADR-003 §§3, 4.1–3: registro prueba identidad/sesión; conserva un snapshot provisional, sin validar verdad organizacional. |
| `USER_CONFIRMATION != ORGANIZATIONAL_AUTHORITY` | ADR-003 §§3.1.7, 4.6, 8: confirma/corrige representación de intención, sin aprobar alineamiento, ownership, KPI ni autoridad de otra persona. |
| Public Entry convertido → contexto Portfolio por defecto | ADR-003 §§3, 4.4; `PORTFOLIO_LEAD_ENTRY` no puede ir directo a Project/Steps (§3.1). |
| Continuación Initiative/Project/Steps sólo como rama explícita gobernada | ADR-003 §3.1 exige perfil `INITIATIVE_ENTRY` previo, handoff versionado, confirmación, elegibilidad, owner autenticado, permisos, idempotencia/procedencia y autoridad separada. No autoriza esa rama por sí solo. |
| Registro/login o confirmación por sí solos no crean Organization, StrategicFront, Challenge, Initiative, Project, Step, Evidence o Decision | ADR-003 §§4.1–6, 8: identidad y confirmación no ejecutan mutación canónica; §8 enumera las entidades y §4.2/7 preservan procedencia/evidencia. Es una prohibición del efecto automático, no de las operaciones autorizadas posteriores. |
| El servidor gobierna perfil/destino; ni CTA, query param, último mensaje, registro ni IA lo seleccionan | ADR-003 §3.1. `recommended_cta` y `starteria_path` legacy son valores/sugerencias provisionales de la misma clase, sin autoridad de routing; ADR-003 §§7–8 no los promueve, y la adopción 114E los mantiene `KEEP_COMPAT`. |
| Unknowns, open items, later work y procedencia sobreviven el boundary | ADR-003 §§4.7–9, 7 y 8: restaurar contexto conocido sin repetición, conservar revision y fuentes, distinguir inferido/sugerido de confirmado. |
| Dos rutas activas no tienen autoridad equivalente para el mismo perfil | ADR-003 §4.10; la rama Initiative requiere evidencia propia. |

Estas son reglas de frontera; ADR-003 no elige un objeto de DB de 114F, un
grant issuer ni la UX concreta para falta de scope.

## 5. Decisiones 114F y autoridad restante

Las auditorías del 25 de septiembre identificaron huecos antes de ADR-004 y
de slices posteriores. Su «OPEN» no debe copiarse sin contrastar las
decisiones y el código actuales. La clase indica el estado de la **pregunta
nombrada**; la última columna conserva los límites que siguen pendientes.

| Pregunta | Clase | Evidencia y límite restante |
|---|---|---|
| 1. Acceso/permiso mínimo Portfolio | `RESOLVED_ELSEWHERE` | ADR-004 §§4–5 distingue continuación provisional autenticada (identidad + sesión owned) de lectura/escritura organizacional (membresía + capability scoped). `PORTFOLIO_SCOPED_ACCESS_AUTHORITY` materializa grants; falta política de emisión/provisión de grants para 114F. |
| 2. Perfil contextual de continuación server-owned | `OPEN_AUTHORITY_DECISION` | ADR-003 exige `INITIATIVE_ENTRY` explícito; la sesión ya tiene enum, pero la auditoría de ownership §15 no identifica una regla aceptada que establezca/cambie el perfil y vincule contexto de negocio para todas las entradas. El enum no es un grant. |
| 3. Selección de organización/scope Portfolio | `RESOLVED_ELSEWHERE` | ADR-004 §5 exige scope validado; `AUTHENTICATED_PORTFOLIO_CONTEXT_ESTABLISHMENT` implementa cero/uno/varios contextos autorizados y revalida selección en servidor. Falta el gobierno de aprovisionamiento inicial y el contrato 114F que adopte esta continuidad. |
| 4. Autoridad del emisor de invitación Initiative | `OPEN_AUTHORITY_DECISION` | ADR-004 §7 fija criterio target-scoped y actores sólo condicionales; no decide quién recibe capability ni su política de emisión en cada target. La auditoría server-owned §8 lo llamó `AUTHORITY_GAP`; no se convierte en detalle de código. |
| 5. Autoridad de aceptación del destinatario | `RESOLVED_ELSEWHERE` | ADR-004 §§6–7 y ADR-005 §§12–13 exigen identidad/recipient match, target, estado válido, permiso, versión e aceptación explícita. Contrato Activation v0.2 gobierna Accept. Integración concreta Public Entry→invitation aún se debe verificar. |
| 6. Frontera Invitation → Start | `RESOLVED_ELSEWHERE` | ADR-004 §6, ADR-005 §§12–14 y Activation v0.2 separan Invitation, Accept y Start; Steps sólo tras Start autorizado. La wiring de 114F y la ruta recipient todavía requieren pruebas. |
| 7. Autoridad de Challenge Owner | `OPEN_AUTHORITY_DECISION` | Core v0.2 §5.1 permite unificar experiencia Sponsor/Responsable del Reto, manteniendo autoridad configurable. Auditoría server-owned §10 encuentra campos ambiguos; no existe issuer/routing genérico de Challenge Owner. |
| 8. Autoridad de Strategic Front Owner | `OPEN_AUTHORITY_DECISION` | Core requiere confirmación humana según autoridad; `ownerId`/`sponsor` observados no prueban mandato de continuación. Auditoría server-owned §10 deja la asignación/política contextual sin decidir. |
| 9. Sponsor en continuación | `RESOLVED_ELSEWHERE` para el límite negativo | Core v0.2 §5/§5.1 y ADR-004 §8 impiden Sponsor como destino, invitador o aprobador universal; autoridad sólo por asignación/política específica. Un nuevo acto de Sponsor en 114F requeriría decisión contextual explícita. |
| 10. Destino de consumidores pilot/public-draft legacy | `LEGACY_RETIREMENT_DECISION` | ADR-003 §9 y ADR-004 §11 los ponen en compatibilidad/deprecación. El inventario actual aún muestra llamadas; retiro exige auditoría de consumidores, reemplazo y autorización separada. |
| 11. Usuario autenticado sin rol/contexto conocido | `RESOLVED_ELSEWHERE` | ADR-004 §§4–5, 9: preservar Entry provisional, establecer contexto Portfolio sin inventar rol ni exponer datos de organización. Sin grant/scope: estado pendiente seguro. Copy y presentación exacta son detalle de implementación posterior. |
| 12. Objeto canónico de persistencia de continuación Portfolio | `OPEN_PRODUCT_DECISION` | ADR-003 §7 define snapshot conceptual, no schema. Existe `PortfolioEntryPortfolioContinuation` y Home lo usa; ADR-001/Post-Entry siguen propuestos. El Experience Contract 114F debe adoptar o revisar expresamente identidad de snapshot, fuente actual, idempotencia y frontera con Bootstrap; el código no promueve esa decisión. |

La implementación anterior de acceso scoped, context establishment y Home
demuestra componentes reutilizables; no demuestra que 114F completo esté
aprobado o implementado. `PortfolioHandoffAssignment` de ADR-005 gobierna el
handoff hacia Initiative Owner, no es el snapshot Portfolio de Public Entry.

## 6. ADR-001 y Post-Entry Contract

```text
ADR001_DISPOSITION: SUPERSEDED_IN_PART
POST_ENTRY_CONTRACT_READINESS: READY_FOR_REVISION
```

ADR-001 sigue `Propuesto / no aprobado` en el índice y en su banner. ADR-003
ya decidió la separación entre Portfolio default e Initiative explícita, por
lo que esa porción de la propuesta ADR-001 quedó absorbida por autoridad
aceptada. ADR-001 todavía plantea snapshot versionado, autorización server
side, compatibilidad de sesiones antiguas y condiciones de habilitación: deben
revisarse frente a ADR-004/005, KAN-98, el acceso scoped y el 114D/114E actual.
No se retira ADR-001 ni se lo promueve en KAN-129.

Post-Entry v0.1 puede ser **base candidata de revisión**, sin ser contrato 114F
aceptado. Antes de acceptance review debe: reemplazar el handoff legacy
`recommended_approach`/`starteria_path`/`recommended_cta` por el 114D actual y
su 114E acotado sin reusar semántica; citar Core v0.2 y ADR-003/004/005;
definir acceso provisional frente a Portfolio organizacional, grant/scope y
perfil server-owned; definir snapshot, source binding/currentness,
idempotencia y open items; separar Invitation/Accept/Start; definir tratamiento
de desconocidos y compatibilidad legacy; y convertir todo ello en criterios de
aceptación comprobables. Ninguno se acepta automáticamente aquí.

## 7. Legacy, estado de índices y readiness

Una búsqueda de referencias en `front/src`, `backend`, `front/e2e` y `scripts`
encontró `/auth/continue/:draftId` en `routes.ts`,
`PublicProposalEditor.tsx` y `PublicProposalResultPage.tsx`;
`createProjectFromPublicDraft` en `AuthPage.tsx` y `AppContext.tsx`;
`/public/continuar` en notifier/test de pilot leads;
`/continuar-piloto` en `routes.ts` y `AuthPage.tsx`;
`consume-claim` en router, controller, servicio frontend y tests; y llamadas
legacy a `/projects/new?challengeId=...` en tests de navegación. Esto prueba
consumidores de repositorio, no tráfico productivo completo. Estado:
`KEEP_COMPAT / DEPRECATION_TARGET` según ruta; ningún retiro autorizado.

`CURRENT_STATE.md` ahora dice `ADR-003 ACCEPTED` y conserva los cierres
anteriores como observaciones históricas. La Authority Map reemplaza sólo su
nota de discrepancia. El Manifest conserva 114E `V2_PILOT`, registra la
integración 125F en PR #192 y agrega 114F como `CANDIDATE` (contrato no
materializado) / `NOT_IMPLEMENTED` con bloqueos de autoridad/contrato, sin
conflicto de status ADR-003. No marca Portfolio Setup, Core, Steps ni la
jornada total como migrados.

```text
114F_SHAPING_READY: YES
114F_IMPLEMENTATION_READY: NO
```

Shaping puede usar ADR-003/004/005 aceptados y la evidencia scoped existente.
Implementación espera el Experience Contract 114F aceptado, una slice Jira
explícita, reglas de perfil e issuer/grant contextual, adopción del snapshot,
integración de invitación cuando aplique, criterios negativos y auditoría de
consumidores legacy. ADR-003 aceptado resuelve sólo el conflicto de estado.

## 8. Paquete mínimo de decisiones siguiente

1. **Acceso Portfolio y scope organizacional.** Adoptar para 114F el acceso
   provisional de ADR-004 y el grant scoped existente; decidir issuer,
   provisión/revocación, selección y estado de quien carece de contexto.
2. **Handoff Initiative.** Fijar la política target-scoped que habilita emisor,
   recipient y aceptación, y cómo 114F se une al Assignment de ADR-005 sin
   confundir Invitation, Accept, Start o conversión Project.
3. **Persistencia de continuidad.** Aceptar o revisar el uso de
   `PortfolioEntryPortfolioContinuation` como snapshot de transferencia;
   decidir qué queda provisional, fuente/versión/currentness, idempotencia,
   open items y frontera con Bootstrap/autoridad organizacional.
4. **Compatibilidad legacy.** Inventariar consumidores y tráfico, condiciones
   de keep/adapt/deprecate, pruebas de reemplazo y ausencia de fallback
   silencioso. No retirar rutas en este paquete.

Después, redactar/revisar un único Experience Contract 114F, someterlo a
aceptación humana y abrir la slice técnica gobernada. KAN-129 no toma esas
decisiones ni inicia el contrato.
