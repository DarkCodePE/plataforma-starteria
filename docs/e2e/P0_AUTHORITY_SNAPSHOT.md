# P0 — Authority & Source Baseline

**Corte:** 2026-10-20. **Estado:** `PASS` tras incorporación literal del Goal Execution Context aprobado. **Alcance:** inventario documental y procedencia; no se modificó código productivo ni se ejecutó P1.

## 1. Executive summary

Hay una jerarquía explícita para el checkout auditado `starteria-KAN-153-recovery-ux`. El Core factual es v0.2, declarado «Por validar»; v0.3 no está promovido. Activation v0.2 gobierna hasta `Start`. El freeze Portfolio Lead v1.0 y el freeze Steps target v0.1 son baselines de diseño externas con límites expresos; el HTML Steps v0.6 tiene QA negativo. La auditoría E2E más reciente (20/10/2026) bloqueó 25/25 recorridos por falta de runtime/tenant. INT-01 es una composición aislada que no fue integrada a la baseline auditada. El Tech Spec PL-01 existe en su worktree fuente. El contexto v0.1 aprobado fue proporcionado textualmente por el usuario en esta conversación y se incorporó bajo `docs/e2e/`; el último bloqueo de fuente de P0 quedó resuelto. Las decisiones reservadas para P2–P10 permanecen abiertas en sus fases.

**Convención de ruta:** `R` = `C:/Users/User/proyect-starteria`; `D` = `C:/Users/User/Downloads`. Una ruta `ZIP!/entrada` identifica una entrada inspeccionada sin extraerla. Las clasificaciones describen el estado documental y el alcance citados, no implementación o despliegue. INT-01 contiene cambios no confirmados en Git; KAN-153 es el checkout de la auditoría. No se fusionan sus estados.

### Canonical Goal checkout — Git and audit identity

```text
CANONICAL_GOAL_REPO_ROOT: C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux
BRANCH: feat/KAN-153-recovery-ux
HEAD_SHA: 1e689ea5c54f7513e323e30f58e45e7168738c7c
REMOTE: origin https://github.com/DarkCodePE/plataforma-starteria.git
WORKTREE_STATUS: branch tracks origin/feat/KAN-153-recovery-ux; pre-P0 only untracked artifacts/; post-P0 untracked artifacts/ and docs/e2e/; no tracked/product-code edits
```

**AUTHORITY / EVIDENCE** — Path: `R/starteria-KAN-153-recovery-ux/artifacts/e2e-audit-results/RUNTIME_BASELINE.md`, «Identidad verificada». **Cita exacta:** «Checkout usado para pruebas | `feat/KAN-153-recovery-ux@1e689ea5c54f7513e323e30f58e45e7168738c7c` en `starteria-KAN-153-recovery-ux`». **Interpretación:** el audit pack identifica la rama y raíz del checkout probado. Verificación independiente: `rtk git -c safe.directory=* -C starteria-KAN-153-recovery-ux rev-parse --show-toplevel`, `rev-parse HEAD`, `status --short --branch`, `remote -v`, `worktree list --porcelain`. `git diff --exit-code 1e689ea 75fc358 -- front backend ai-service` devolvió 0, coherente con la equivalencia de código que declara el audit pack; esto no certifica runtime desplegado.

**Reubicación:** la primera ronda creó dos archivos en `R/docs/e2e/`, fuera del checkout auditado. Se copiaron a `CANONICAL_GOAL_REPO_ROOT/docs/e2e/`, se verificaron allí y se retiraron las copias de `R/docs/e2e/`. Los ZIP externos usados se copiaron byte a byte a `docs/e2e/sources/` como `MIRROR_OF_EXTERNAL_SOURCE`; sus hashes y entradas están en [P0_SOURCE_MANIFEST.md](P0_SOURCE_MANIFEST.md). No se alteró ningún documento fuente.

## 2. Authority hierarchy observada

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/docs/STARTERIA_AUTHORITY.md`, §2. **Cita exacta:** «1. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`» y «2. ADRs de producto aprobados en `doc/product-adr/` (índice canónico: `doc/product-adr/ADR-INDEX.md`)»; siguen Experience Logic Contracts aprobados, Agent Contracts, Skill Contracts, Tech Specs, PRDs, prototipos/mockups/reportes históricos e implementación histórica. **Interpretación:** el Core y ADR aprobados prevalecen sobre diseño y código. El índice `docs/product-adr/` es otra serie operativa, no reemplaza el índice canónico `doc/product-adr/`.

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/AGENTS.md`, §2. **Cita exacta:** «El Core Contract vigente es `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`; `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` es candidato.» **Interpretación:** ningún número de versión promueve v0.3.

**AUTHORITY** — Path: `R/starteria-int01-trial/STARTERIA_V2_MANIFEST.md`, §1. **Cita exacta:** «Starteria V2 no se define por un número de versión aislado ni por el archivo más reciente.» **Interpretación:** el manifest indexa estados, pero se declara «Baseline de consolidación propuesto para reconciliación» y no reemplaza Core/ADRs.

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md`, portada y §§0, 30. **Citas exactas:** «**Estado:** APPROVED FOR E2E GOAL EXECUTION»; «No es un Core Contract.»; «Una decisión pendiente que pertenece explícitamente a una fase posterior NO bloquea por sí sola una fase anterior de inventario o baseline.» **Interpretación:** gobierna la ejecución y gates del Goal bajo Core/ADRs/Experience/Agent/Skill/Tech Spec; no promueve candidates. **Procedencia:** texto íntegro suministrado por el usuario el 2026-10-20, sin reformulación. **SHA-256 local:** `d701511b3dd5531fcf3e40e327de2e1ca56c33ba66fa6d428d7a5b99c699c3bb`. **Clasificación:** `APPROVED_AUTHORITY` de gobernanza de ejecución, subordinada según §0 del propio documento.

## 3. Core Contract activo

| Path exacto | Nombre / versión / estado propio | Clasificación | Superior / alcance / sustitución / conflicto |
|---|---|---|---|
| `R/starteria-KAN-153-recovery-ux/doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` | Contrato de Lógica Core, v0.2, «Base fundacional revisada / Por validar» | `APPROVED_AUTHORITY` **factual vigente**, con validación pendiente | Primer nivel según Authority §2; Portfolio, Initiative, IA y conocimiento. Ninguna promoción documentada. La etiqueta de clasificación no convierte «Por validar» en aprobación plena. |
| `R/starteria-int01-trial/doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` | Copia v0.2, mismo estado declarado | `REFERENCE_ONLY` respecto del árbol KAN-153 | Sirve para contraste de worktree; no se asume identidad de bytes ni incorporación de WIP. |
| `R/starteria-KAN-153-recovery-ux/docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` | Core v0.3 candidata, «Candidata de gobernanza / Requiere re-test» | `CANDIDATE` | Debajo del factual v0.2; propuestas posteriores no son invariantes vigentes. |

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/docs/STARTERIA_AUTHORITY.md`, §3. **Cita exacta:** «It is not promoted and does not replace the factual current Core v0.2 at the path above. Promotion requires explicit reconciliation, supporting evidence and re-test.» **Interpretación:** v0.3 no gobierna cambios de dominio.

## 4. ADRs aprobados relevantes

El índice canónico completo de INT-01 fue inspeccionado: ADR-001 propuesto; ADR-002 a 011 figuran aceptados en ese worktree. El mismo índice del checkout KAN-153 termina en ADR-007. `docs/product-adr/ADR-INDEX.md` lista además ADR-027/031 del backend para harness/INTERPRET. `docs/adr/ADR-INDEX.md` corresponde al plugin de harness y no se usa como serie de producto.

| Path exacto (prefijo `R/`) | Versión / estado propio | Clasificación | Superior; tramo gobernado; conflicto o límite |
|---|---|---|---|
| `starteria-KAN-153-recovery-ux/doc/product-adr/ADR-002-portfolio-entry-active-question-clarification-convergence.md` | ADR-002; Aceptado en índice canónico | `APPROVED_ADR` | Core v0.2; Entry secuencial. |
| `starteria-KAN-153-recovery-ux/doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md` | ADR-003; Aceptado | `APPROVED_ADR` | Core v0.2; registro/continuación; su antigua discrepancia de estado está reconciliada por Authority §6. |
| `starteria-KAN-153-recovery-ux/doc/product-adr/ADR-004-authenticated-continuation-access-and-initiative-handoff-authority.md` | ADR-004; «ACCEPTED — ADR DESIGN ONLY» | `APPROVED_ADR` | Core v0.2; acceso autenticado y excepción Steps. No autoriza runtime. |
| `starteria-KAN-153-recovery-ux/doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md` | ADR-005; «ACCEPTED — ADR DESIGN ONLY» | `APPROVED_ADR` | Core v0.2; Assignment y ruta legacy. No autoriza runtime. |
| `starteria-KAN-153-recovery-ux/doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md` | ADR-006; ACCEPTED | `APPROVED_ADR` | Core v0.2; Landing/Entry; supersede parcialmente ADR-019 backend según índice. |
| `starteria-KAN-153-recovery-ux/doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md` | ADR-007; Aceptado, 2026-10-04 | `APPROVED_ADR` | Core v0.2; exposición pública `reason_to_ask`, alcance estrecho. |
| `starteria-int01-trial/doc/product-adr/ADR-008-strategic-framing-scoped-authorization.md` | ADR-008; Accepted, 2026-10-15, en índice INT-01 | `UNKNOWN_AUTHORITY` para Goal; aprobación local declarada | Core v0.2 y ADR-004; SF scoped. Falta acreditar integración en baseline principal. |
| `starteria-int01-trial/doc/product-adr/ADR-009-project-steps-scoped-resource-authority.md` | ADR-009; «ACCEPTED — DESIGN AUTHORITY» | `UNKNOWN_AUTHORITY` para Goal; aprobación local declarada | Core v0.2 y ADR-004/005; Project/Steps. No aprueba schema. |
| `starteria-int01-trial/doc/product-adr/ADR-010-revocation-safe-core-transaction-boundary.md` | ADR-010; «ACCEPTED — DESIGN AUTHORITY; sin cambio de runtime» | `UNKNOWN_AUTHORITY` para Goal; aprobación local declarada | Core v0.2 y ADR-004/005/009; transacciones/retorno. |
| `starteria-int01-trial/doc/product-adr/ADR-011-handoff-committed-external-effects.md` | ADR-011; «ACCEPTED — DESIGN AUTHORITY» | `UNKNOWN_AUTHORITY` para Goal; aprobación local declarada | Core v0.2 y ADR-004/005/009/010; issuer/outbox. No autoriza migración. |
| `starteria-KAN-153-recovery-ux/backend/docs/adr/ADR-027-methodology-agent-harness.md` | ADR-027; «Accepted — 2026-07-24» | `APPROVED_ADR` scoped harness | Core y Authority; pipeline/hard gates de diagnóstico, no autoridad de decisión organizacional. |
| `starteria-KAN-153-recovery-ux/backend/docs/adr/ADR-031-confidence-threshold-for-human-escalation.md` | ADR-031; «Accepted — 2026-09-20» | `APPROVED_ADR` scoped INTERPRET | Complementa ADR-027; corte 0.50 provisional, no certificado en tráfico real. |

**AUTHORITY** — Path: `R/starteria-int01-trial/doc/product-adr/ADR-INDEX.md`, «Estado de la serie». **Cita exacta:** «ADR-001 ... Propuesto / no aprobado» y «ADR-009 ... ACCEPTED — DESIGN AUTHORITY, 2026-10-15». **Interpretación:** el índice separa propuesta de diseño aprobado, pero no prueba incorporación a `main`.

**AUTHORITY** — Path: `R/starteria-int01-trial/doc/product-adr/ADR-009-project-steps-scoped-resource-authority.md`, «D-SEC-01». **Cita exacta:** «Un Project independiente conserva clasificación independiente y no requiere Frente, Challenge ni grant Portfolio». **Interpretación:** no fabricar jerarquía corporativa.

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md`, §1. **Cita exacta:** «Starteria adopta un bounded persistence model de Handoff Assignment como source of truth exclusivo del lifecycle de transferencia». **Interpretación:** Assignment y Initiative Core son identidades distintas.

### INT-01 provenance and Goal classification

**AUTHORITY / EVIDENCE** — Path: `R/starteria-int01-trial/STARTERIA_INT01_INTEGRATION_REPORT_v0.1.md`, «Baseline, protección y composición». **Citas exactas:** «Copia aislada: `starteria-int01-trial`, clon local del HEAD común y superposición de 39 archivos SEC y 21 PL-01 (producto, pruebas, ADRs y contrato). Procedencia por archivo: `INT01_PROVENANCE.json`. El clon no constituye una rama fuente ni un merge a main.» y «No hubo commit, push, PR, merge a main ni deploy.» **Interpretación:** INT-01 es evidencia de integración, no una promoción de autoridad al checkout canónico. `R/starteria-int01-trial/STARTERIA_INT01_CONFLICT_MATRIX_v0.1.md`, C-01, añade: «`PARTIAL`: revisión de gobernanza antes de incorporar a índice canónico.»

**EVIDENCE** — Path: `R/starteria-int01-trial/INT01_PROVENANCE.json`. Sus entradas registran `source: SEC`, `action: COPIED` para ADR-009/010/011; `source: PL01`, `action: COPIED` para ADR-008 y el Experience Contract PL-01; y `action: MANUAL_GOVERNANCE_RECONCILIATION` para el índice/Authority compartidos. **Interpretación:** el archivo prueba origen de copia y mezcla manual; no prueba promoción al índice del checkout canónico.

| Path original y documento | Versión / estado declarado / cita exacta | Authority level y Goal classification | Supersedes / superseded by |
|---|---|---|---|
| `R/starteria-portfolio-lead-pl01/doc/product-adr/ADR-008-strategic-framing-scoped-authorization.md` | ADR-008; «`ACCEPTED — DESIGN AUTHORITY FOR PL-01`» | ADR de producto aprobado **en rama fuente**; `UNKNOWN_AUTHORITY` para uso normativo del Goal hasta reconciliación del índice canónico | Especializa ADR-004 solo SF; no lo sustituye. No hay supersesión posterior comprobada. |
| `R/starteria-sec01/doc/product-adr/ADR-009-project-steps-scoped-resource-authority.md` | ADR-009; «ACCEPTED — DESIGN AUTHORITY; implementación y cambios de datos sujetos a autorización separada» | ADR de producto aprobado **en rama fuente**; `UNKNOWN_AUTHORITY` para Goal | Subordinado Core v0.2/ADR-004/005; ninguna supersesión probada. |
| `R/starteria-sec01/doc/product-adr/ADR-010-revocation-safe-core-transaction-boundary.md` | ADR-010; «ACCEPTED — DESIGN AUTHORITY; sin cambio de runtime» | ADR de producto aprobado **en rama fuente**; `UNKNOWN_AUTHORITY` para Goal | Subordinado Core/ADR-004/005/009; ninguna supersesión probada. |
| `R/starteria-sec01/doc/product-adr/ADR-011-handoff-committed-external-effects.md` | ADR-011; «ACCEPTED — DESIGN AUTHORITY; implementación de outbox y migración no autorizadas por este documento» | ADR de producto aprobado **en rama fuente**; `UNKNOWN_AUTHORITY` para Goal | Subordinado Core/ADR-004/005/009/010; ninguna supersesión probada. |
| `R/starteria-portfolio-lead-pl01/docs/portfolio-lead/07-strategic-framing/PORTFOLIO_LEAD_PL01_CONTINUITY_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; «`APPROVED EXPERIENCE CONTRACT` para PL-D01 y PL-D02 únicamente» | Experience aprobado **en rama fuente**; `UNKNOWN_AUTHORITY` para Goal | 114F/SF-0 siguen superiores en sus ámbitos; no supersede el contrato unificado candidato. |
| `R/starteria-int01-trial/docs/experience/project/PROJECT_ORIGIN_CREATION_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; «APPROVED — decisión PD-01 ... 2026-10-15» | Aprobación local declarada; `UNKNOWN_AUTHORITY` para Goal (origen primario no acreditado en checkout canónico) | No supersesión comprobada; no sustituye Core/ADRs. |
| `R/starteria-int01-trial/STEPS_ENTRY_SLICE1_EXPERIENCE_FREEZE_v0.2.md` | v0.2; «`DESIGN_APPROVED` para F-S1-01…06» | Freeze de Slice 1 local; `UNKNOWN_AUTHORITY` para Goal hasta reconciliación, `FROZEN_EXPERIENCE` solo en su worktree | Consolida propuesta UX Slice 1 v0.1 en F-S1-01…06; no supersede Steps target 0–4. |
| `R/starteria-int01-trial/STARTERIA_INT01_INTEGRATION_REPORT_v0.1.md` | v0.1; «`PARTIAL`. Ensayo local» | `AS_IS_EVIDENCE` | Reporte, no contrato; no supersede fuente. |
| `R/starteria-int01-trial/STARTERIA_INT01_CONFLICT_MATRIX_v0.1.md` | v0.1; matriz aislada `PARTIAL` | `TEST_EVIDENCE` | Reporte, no contrato; no supersede fuente. |

Las filas `UNKNOWN_AUTHORITY` no gobiernan implementación en este Goal. Sus estados propios se conservan sin promover los archivos de INT-01 o de las ramas fuente a la baseline KAN-153.

## 5. Experience Contracts

| Path exacto (prefijo `R/`) | Versión / estado propio | Clasificación | Superior / E2E / supersesión o conflicto |
|---|---|---|---|
| `starteria-KAN-153-recovery-ux/doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` | v0.1; aprobado como base según Authority §4 | `APPROVED_AUTHORITY` | Core + ADR; Entry opcional. No gobierna Steps. |
| `starteria-KAN-153-recovery-ux/docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; ACCEPTED/FROZEN para planning | `FROZEN_EXPERIENCE` | Core/ADRs/Entry v0.1; razonamiento público acotado. |
| `starteria-KAN-153-recovery-ux/docs/experience/portfolio-entry/PORTFOLIO_SETUP_CONTINUITY_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; ACCEPTED/FROZEN para 114F | `FROZEN_EXPERIENCE` | Core, ADR-003/004/005, Entry; termina en Home/Bootstrap, no activa Steps. |
| `starteria-KAN-153-recovery-ux/docs/portfolio-lead/07-strategic-framing/STRATEGIC_FRAMING_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; «APPROVED EXPERIENCE CONTRACT — SF-0» | `APPROVED_AUTHORITY` | Core v0.2; framing, sin extensión Core. |
| `starteria-KAN-153-recovery-ux/docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md` | v0.2; «ACTIVE / FROZEN FOR IMPLEMENTATION PLANNING» | `FROZEN_EXPERIENCE` | Core/ADRs; Assignment→Start. Supersede v0.1 solo en este vertical. Referencia interna ambigua a Core v0.3: CONFLICT-01. |
| `starteria-int01-trial/docs/portfolio-lead/07-strategic-framing/PORTFOLIO_LEAD_PL01_CONTINUITY_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; «APPROVED EXPERIENCE CONTRACT» para PL-D01/02 | `UNKNOWN_AUTHORITY` para Goal; aprobación local declarada | Core/ADRs/114F/SF-0; Home→SF. Falta integración principal. |
| `starteria-int01-trial/docs/experience/project/PROJECT_ORIGIN_CREATION_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; «APPROVED» PD-01, 2026-10-15 | `UNKNOWN_AUTHORITY` para Goal; aprobación local declarada | Core/ADRs; origen Project corporativo/independiente y creación. No aprueba migración. |
| `starteria-int01-trial/docs/portfolio-lead/06-portfolio-home-governance/PORTFOLIO_HOME_GOVERNANCE_TARGET_v0.1.md` | v0.1; «PH-0 frozen target / Experience-level candidate for implementation planning» | `FROZEN_EXPERIENCE` target, dependencias candidatas | Core v0.2; Home. No promueve cardinalidad/cobertura ni autoridad ampliada. |
| `starteria-int01-trial/docs/portfolio-lead/06-portfolio-home-governance/PORTFOLIO_HOME_READ_MODEL_CONTRACT_v0.1.md` | v0.1; «PH-0 frozen target contract; implementation pending» | `FROZEN_EXPERIENCE` target, dependencias candidatas | Core v0.2; read model Portfolio. |
| `starteria-sec01/STARTERIA_STEPS_ENTRY_ROUTES_EXPERIENCE_CONTRACT_v0.1.md` | v0.1; «PRODUCT DESIGN ADOPTION CANDIDATE, no aprobado para implementación» | `CANDIDATE` | Core/ADRs/Activation; A/B/C post-Start. No promueve rutas. |
| `starteria-int01-trial/docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_HANDOFF_INTEGRATION_CONTRACT_v0.1.md` | v0.1; «CANDIDATE FOR FREEZE» | `CANDIDATE` | Core/ADRs/Activation; frontera downstream. |

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/docs/STARTERIA_AUTHORITY.md`, §5. **Cita exacta:** «termina en la frontera `Start` y no autoriza modificar Steps 0-4.» **Interpretación:** falta un contrato aprobado para el tramo completo post-Start→Steps→Decision→Portfolio.

## 6. Agent Contracts

| Path exacto | Versión / estado propio | Clasificación | Superior / alcance / conflicto |
|---|---|---|---|
| `R/starteria-int01-trial/doc/PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.1.md` | v0.1; «PROPUESTO PARA REVISIÓN» | `CANDIDATE` | Core/ADRs/Entry; solo Portfolio Entry. |
| `R/starteria-int01-trial/docs/agents/portfolio-entry/PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md` | v0.2; «PROPUESTO PARA TESTING» | `CANDIDATE` | Core/ADRs/Entry; no supersede v0.1 por versión. Referencia interna al Core v0.3 candidato: CONFLICT-02. |

No se localizó un Agent Contract aprobado que gobierne el Copilot unificado de Steps 0–4. `ai-service/agents/` es implementación, no contrato aprobado.

## 7. Skill Contracts

| Path exacto (prefijo `R/starteria-int01-trial/`) | Versión / estado propio | Clasificación | Superior / alcance |
|---|---|---|---|
| `doc/entry-01-intent-detection_SKILL_v0.1.md` a `doc/entry-04-question-planner_SKILL_v0.1.md` | v0.1; propuestos según Authority §6 | `CANDIDATE` | Agent/Entry; cuatro skills de Entry, no Steps. |
| `docs/agents/portfolio-entry/skills/entry-01-intent-detection/SKILL_v0.2.md` a `entry-04-question-planner/SKILL_v0.2.md` (directorios homólogos `entry-02-context-extraction`, `entry-03-reverse-alignment`) | v0.2; «PROPUESTO PARA TESTING» | `CANDIDATE` | Agent/Entry; no promoción por versión. |
| `docs/agents/portfolio-entry/skills/entry-05-critical-situation-synthesis/SKILL_v0.1.md` | v0.1; «FROZEN FOR KAN-114 IMPLEMENTATION» | `FROZEN_EXPERIENCE` **solo skill KAN-114** | Core/ADRs/Entry/Critical Reasoning; texto dice que no aprueba Steps. |

**AUTHORITY** — Path: `R/starteria-int01-trial/docs/agents/portfolio-entry/skills/entry-05-critical-situation-synthesis/SKILL_v0.1.md`, portada. **Cita exacta:** «No aprueba ni implementa runtime, prompts, schemas, UI, backend, Portfolio Setup, Steps ni cambios de Core.» **Interpretación:** no usarlo como contrato general de Steps.

## 8. Tech Specs

| Path exacto (prefijo `R/starteria-int01-trial/`) | Versión / estado propio | Clasificación | Superior / alcance |
|---|---|---|---|
| `docs/portfolio-lead/03-bootstrap-home/PORTFOLIO_BOOTSTRAP_HOME_TECH_SPEC_v0.1.md` | v0.1; «PROPUESTO PARA REVISIÓN TÉCNICA» | `CANDIDATE` | Bootstrap Logic propuesto; Home. |
| `docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_HANDOFF_TECHNICAL_DESIGN_v0.1.md` | v0.1; «listo para planificación de implementación; no autoriza por sí mismo cambios de runtime» | `REFERENCE_ONLY` | Activation/ADR-005; diseño Handoff, límite Start. |
| `docs/implementation/portfolio-entry/KAN-133_114F_TECHNICAL_CURRENT_STATE_AND_ARCHITECTURE_v0.1.md` | v0.1; «auditoría técnica y propuesta de arquitectura; sin implementación runtime» | `AS_IS_EVIDENCE` | 114F; baseline histórica 2026-10-11. |
| `docs/implementation/portfolio-entry/KAN-124_STARTERIA_PATH_TECHNICAL_ARCHITECTURE_v0.1.md` | v0.1; aceptada solo para KAN-125 por Authority §6 | `APPROVED_AUTHORITY` **scoped tech baseline** | 114E, no E2E completo. |
| `docs/portfolio-lead/07-strategic-framing/PORTFOLIO_LEAD_PL01_GOVERNANCE_RELEASE_v0.1.md` | v0.1; `READY_FOR_IMPLEMENTATION` solo PL-01 | `REFERENCE_ONLY` de adopción en INT-01 | PL-D01/02/03; no certifica E2E. Remite al Tech Spec PL-01 encontrado en su worktree fuente. |
| `R/starteria-portfolio-lead-pl01/PORTFOLIO_LEAD_PL01_INTEGRATION_TECH_SPEC_v0.1.md` | v0.1; `APPROVED FOR PL-01 IMPLEMENTATION`, solo puente 114F→Home/Bootstrap→SF | `REFERENCE_ONLY` para Goal hasta adopción en checkout canónico | Core/ADR-004/008/PL-01 scoped; Tech Spec local encontrado. No forma parte del baseline obligatorio para inventariar P0 ni probar AS-IS en P1. `PL-01 = FOUND`; `P0_BLOCKER = NO`; `FUTURE_DEPENDENCY = YES`. |

**AUTHORITY** — Path: `R/starteria-portfolio-lead-pl01/PORTFOLIO_LEAD_PL01_INTEGRATION_TECH_SPEC_v0.1.md`, portada. **Cita exacta:** «`APPROVED FOR PL-01 IMPLEMENTATION`, solo el puente 114F → Home/Bootstrap → SF y los guards de ese recurso; no autoriza migración de datos.» **Interpretación:** aprobación local de implementación acotada, no Tech Spec del E2E unificado. Path de referencia: `R/starteria-portfolio-lead-pl01/docs/portfolio-lead/07-strategic-framing/PORTFOLIO_LEAD_PL01_GOVERNANCE_RELEASE_v0.1.md`, «Compatibilidad y alcance técnico liberado»: «El [Tech Spec PL-01](../../../PORTFOLIO_LEAD_PL01_INTEGRATION_TECH_SPEC_v0.1.md) coincide con PL-D01/02/03». Ninguna autoridad aplicable exige integrarlo como precondición de P0; la reconciliación técnica pertenece a P5 si PL-01 queda en alcance.

## 9. Frozen Portfolio Lead references

| Path exacto | Versión / estado propio | Clasificación | Superior / alcance |
|---|---|---|---|
| `D/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/01_FROZEN_PORTFOLIO/01_FREEZE_DECLARATION.md` | v1.0; `FROZEN_UX_APPROVED_FOR_IMPLEMENTATION_PLANNING`, 2026-10-19 | `FROZEN_EXPERIENCE` visual | Core/ADRs/Experience del repositorio; Portfolio Lead UX. Declara HTML SHA-256 `6eadaf4b72b55107120cf0b097b65deeba3c7108c07d3f98dd81128b7bf4c846`. |
| mismo ZIP, `.../01_FROZEN_PORTFOLIO/02_IMPLEMENTATION_BEHAVIOR_CONTRACT.md` | v1.0 pack; comportamiento del freeze | `FROZEN_EXPERIENCE` visual | UX Portfolio; subordinado a autoridad producto. |
| mismo ZIP, `.../01_FROZEN_PORTFOLIO/03_ACCEPTANCE_CHECKLIST.md` | v1.0 pack; checklist | `TEST_EVIDENCE` target checklist | Criterios del freeze, no resultados runtime. |
| mismo ZIP, `.../01_FROZEN_PORTFOLIO/STARTERIA_PORTFOLIO_LEAD_v1.0_CONTROL_DE_CAMBIOS_Y_QA.md` | v1.0; QA de prototipo | `TEST_EVIDENCE` | Evidencia visual, no prueba del producto. |
| mismo ZIP, `.../04_REFERENCIA_VISUAL/STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html` | v1.0, HTML de diseño aprobado | `FROZEN_EXPERIENCE` **referencia visual exacta** | Su freeze lo eleva para UX, nunca para dominio/API/IA real. |
| `D/STARTERIA_PORTFOLIO_LEAD_UX_SPEC_v0.3.md` | v0.3; estado no ratificado en esta P0 | `REFERENCE_ONLY` | Referencia de diseño previa; no sustituye freeze v1.0. |

**AUTHORITY** — Path: ZIP Portfolio v1.0, `01_FREEZE_DECLARATION.md`, portada. **Cita exacta:** «No equivale a: publicación en GitHub, aprobación de Core/ADRs, implementación productiva, pruebas E2E ni autorización de despliegue.» **Interpretación:** el HTML es autoridad visual congelada, no autoridad funcional superior.

## 10. Frozen Steps references

| Path exacto | Versión / estado propio | Clasificación | Superior / alcance |
|---|---|---|---|
| `D/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/STEPS_TARGET_DESIGN_FREEZE_v0.1.md` | v0.1; «BASELINE DE DISEÑO CONGELADA PARA LA SIGUIENTE FASE»; pendiente de aprobación de integración/reconciliación | `FROZEN_EXPERIENCE` **target condicional** | Core/ADRs; Steps 0–4, A/B/C. Sus dependencias v0.3 no son autoridad. |
| `R/starteria-int01-trial/STEPS_ENTRY_SLICE1_EXPERIENCE_FREEZE_v0.2.md` | v0.2; `DESIGN_APPROVED` F-S1-01…06, 2026-10-17 | `UNKNOWN_AUTHORITY` para Goal; freeze local solo Slice 1 | Core/ADR-004/005/009/010/011/PD-01; card/Accept/hito Lead. Start y Steps fuera de alcance. |
| `D/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/Starteria_Steps_Conversacion_Card_Viva_v06.html` | v0.6; mockup | `REFERENCE_ONLY` | UI ilustrativa; no runtime ni semántica válida del Copilot. |
| mismo ZIP, `Starteria_Steps_v06_QA_2_Perfiles.md` | v0.6; QA 2026-10-19; «NO APTO todavía» | `TEST_EVIDENCE` | Prueba de mockup, documenta fallos semánticos. |

**AUTHORITY** — Path: ZIP auditoría v02, `STEPS_TARGET_DESIGN_FREEZE_v0.1.md`, portada. **Cita exacta:** «pendiente de aprobación de integración en el repositorio y de reconciliación con las autoridades superiores.» **Interpretación:** target congelado no habilita cambios de Core.

**AUTHORITY** — Path: mismo ZIP, `Starteria_Steps_v06_QA_2_Perfiles.md`, «Resumen ejecutivo». **Cita exacta:** «La información se asigna por orden de turno, no por su significado.» **Interpretación:** HTML v0.6 no acredita Copilot/Card semánticos.

## 11. Candidate documents

Además del Core v0.3, Agent/Skills v0.1/v0.2 y contratos de rutas señalados arriba: `R/starteria-int01-trial/docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md` es `CANDIDATE / PROPOSED FOR TESTING` según Authority §6; `R/starteria-int01-trial/STARTERIA_SLICE1_FREEZE_DECISIONS_AND_SEQUENCE_v0.1.md` se declara «propuesta de cierre de diseño» y quedó antecedido en su ámbito por el freeze Slice 1 v0.2; `D/STARTERIA_E2E_PLAN_POST_AUDITORIA_v01.zip!/STARTERIA_E2E_PLAN_ACCION_POST_AUDITORIA_v0.1.md` y `.../STARTERIA_E2E_HALLAZGOS_Y_DECISIONES_v0.1.md` son planificación/hallazgos posteriores a la auditoría, `CANDIDATE` hasta adopción explícita. `D/STARTERIA_E2E_OBJETIVO_UNIFICADO_v0.1.md` y planes MVP v1.x quedan `CANDIDATE`/`REFERENCE_ONLY`, no Core. Ninguna de estas fuentes se promueve por inclusión en ZIP o fecha.

## 12. AS-IS / Test evidence

| Path exacto | Versión / estado propio | Clasificación | Superior / alcance |
|---|---|---|---|
| `R/starteria-KAN-153-recovery-ux/artifacts/e2e-audit-results/RUNTIME_BASELINE.md` | corte 2026-10-20 04:51 UTC; audit only | `AS_IS_EVIDENCE` | Describe checkout KAN-153 y entorno; no norma producto. |
| mismo directorio, `E2E_AUDIT_EXECUTIVE_SUMMARY.md` | dictamen 20/10/2026 | `AS_IS_EVIDENCE` | Última auditoría AS-IS localizada por fecha/cobertura E2E. |
| mismo directorio, `GAP_MATRIX_RUNTIME_DELTA.md` | delta de auditoría | `AS_IS_EVIDENCE` | Contraste target/runtime, sin promover target. |
| mismo directorio, `E2E_TEST_EXECUTION_REGISTER.md` y `evidence/*.txt` | ejecución focal local | `TEST_EVIDENCE` | Resultados limitados a tests corridos. |
| `D/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/STARTERIA_E2E_ASIS_TOBE_GAP_MATRIX_v0.2.md` y `STARTERIA_E2E_SECOND_PASS_ADDENDUM_v0.2.md` | matriz segunda pasada | `AS_IS_EVIDENCE` + target candidato | No sustituye pruebas de runtime. |
| `D/STARTERIA_E2E_PLAN_POST_AUDITORIA_v01.zip!/auditoria_codex/*` | copia posterior del pack de auditoría | `AS_IS_EVIDENCE` / `TEST_EVIDENCE` según archivo | No es auditoría nueva solo por fecha del ZIP; comprobar hashes antes de afirmar identidad. |

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/artifacts/e2e-audit-results/E2E_AUDIT_EXECUTIVE_SUMMARY.md`, «Diagnóstico ejecutivo». **Cita exacta:** «25/25 escenarios de navegador/API quedaron `BLOCKED` sin tenant/sesiones/versión desplegada; 80 pruebas focales locales pasaron y tienen alcance de componente/servicio.» **Interpretación:** hay baseline local parcial y ningún PASS E2E desplegado.

## 13. Superseded / reference-only documents

| Path exacto | Versión / estado propio | Clasificación | Evidencia de sustitución / uso permitido |
|---|---|---|---|
| `R/starteria-KAN-153-recovery-ux/docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.1.md` | v0.1 | `SUPERSEDED` **solo Handoff** | Activation v0.2 dice «actualiza y reemplaza, para este vertical». Solo trazabilidad. |
| `R/starteria-KAN-153-recovery-ux/doc/experience/portfolio-entry/PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md` | v0.1; PROPOSED FOR REVIEW | `SUPERSEDED` **en parte 114F**, candidato fuera de solape | Authority §6: `SUPERSEDED_IN_PART` en frontera 114F por 114F aceptado. |
| `R/starteria-KAN-153-recovery-ux/doc/product-adr/ADR-001-portfolio-entry-continuation-to-portfolio.md` | propuesto/no aprobado | `CANDIDATE` | Índice canónico. No se usa como ADR aprobado. |
| `R/starteria-KAN-153-recovery-ux/docs/adr/ADR-INDEX.md` y su serie ADR-001…013 | ADR de harness/plugin | `REFERENCE_ONLY` para autoridad de producto | Authority §7 separa series. |
| `D/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/04_REFERENCIA_VISUAL/STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html` | v1.0 | `FROZEN_EXPERIENCE` visual, **no** referencia de reglas Core | Elección explícita del acta, limitada a UX. |

## 14. Conflicts

### CONFLICT-01 — referencia a Core candidato dentro de Activation

- **Contract / Requirement:** Authority §2–3 / Core factual v0.2.
- **Current document:** `R/starteria-int01-trial/docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md`, §0.
- **Observed mismatch:** cita como superior «`STARTERIA_CORE_LOGIC_CONTRACT.md`», cuya portada declara «v0.3 candidata»; Authority declara v0.2 factual. No se interpretan las reglas exclusivas de v0.3 como vigentes.
- **Risk:** promover cardinalidad, cobertura o autoridad no aprobadas. **Treatment:** UPDATE referencia mediante reconciliación; ADR/re-test si cambia invariante. **Requires ADR:** condicional a la regla.

### CONFLICT-02 — stack Agent v0.2 remite a Core v0.3

- **Contract / Requirement:** Authority §3 / Agent subordinado al Core factual.
- **Current document:** `R/starteria-int01-trial/docs/agents/portfolio-entry/PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`, §0.
- **Observed mismatch:** enumera `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` como superior, aunque Authority no lo promueve. **Treatment:** UPDATE tras decisión formal; mientras tanto `CANDIDATE`. **Requires ADR:** si adopta semántica exclusiva v0.3.

### CONFLICT-03 — procedencia de ADR/Experience locales frente a baseline principal

- **Contract / Requirement:** índice canónico y adopción trazable.
- **Current documents:** `R/starteria-int01-trial/doc/product-adr/ADR-INDEX.md` incluye 008–011; `R/starteria-KAN-153-recovery-ux/doc/product-adr/ADR-INDEX.md` acaba en 007. PL-01/PD-01 y Steps Slice 1 aparecen como archivos no seguidos en INT-01.
- **Observed mismatch:** decisión humana declarada en fuentes SEC/PL-01 e INT-01 no equivale a incorporación en la baseline auditada de KAN-153/main. INT-01 reporta ensayo `PARTIAL`, sin merge. **Treatment:** KEEP separados; no usar estos documentos para gobernar implementación hasta reconciliación en P2/P5. P1 puede observar runtime sin adoptar reglas INT-01. **Requires ADR:** no por mera integración; sí si cambia regla.

### CONFLICT-04 — freeze visual y dominio corporativo

- **Contract / Requirement:** Core v0.2 y ADR-009 (cuando aplicable) vs UX Portfolio Lead.
- **Current document:** ZIP Portfolio v1.0, `05_SCOPE_NOT_AUTOMATICALLY_APPROVED.md`.
- **Observed mismatch/laguna declarada:** «Si se puede omitir Challenge **en el dominio corporativo**: puede requerir ADR». El HTML no decide cardinalidad. **Treatment:** congelar solo UX; dejar regla de dominio pendiente. **Requires ADR:** sí si se alteran invariantes.

### CONFLICT-05 — ADR-003 aceptado conserva referencia factual incompatible

- **Contract / Requirement:** Authority §3 y reconciliación KAN-129; Core factual v0.2.
- **Current document:** `R/starteria-KAN-153-recovery-ux/doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md`, §1.
- **Observed mismatch:** dice «The canonical Core v0.3 is restored at: `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`». Authority §3 declara explícitamente v0.3 candidato. Authority §6 dice que KAN-129 reconcilió el estado de ADR-003, pero el texto interno conserva esa referencia. **Treatment:** UPDATE referencia con trazabilidad, sin alterar decisión aceptada; no usar cláusulas exclusivas v0.3. **Requires ADR:** si la corrección cambia semántica, sí; la mera referencia factual requiere reconciliación documental.

## 15. ADR blockers

1. Post-Start A/B/C y elección Step/ciclo carecen de Experience Contract aprobado integral; cualquier cambio de identidad, cardinalidad o función estable de Steps exige ADR/re-test conforme Authority §10. El contrato candidato de `starteria-sec01` no elimina el bloqueo. **Primera fase:** P2/P5 según decisión; no bloquea P0.
2. Cobertura mínima de Challenge, autoridad de decisión ampliada, lifecycle `pre_start` y modelado de Portfolio Home figuran expresamente `CANDIDATE DEPENDENCY / ADR-RETEST REQUIRED` en `PORTFOLIO_HOME_READ_MODEL_CONTRACT_v0.1.md`; no son normas vigentes. **Primera fase:** P2/P5; no bloquea P0.
3. Omitir Challenge corporativo, inferir relaciones canónicas o dar autoridad organizacional a IA choca con Core/ADR; el freeze visual remite a revisión. **Primera fase:** P2/P3/P5 según regla. No se emite ADR nuevo en P0.

### Blockers by first required phase

Las descripciones D-03/B-01/02/03/D-08/09 provienen de `P0_SOURCE_MANIFEST.md` E2E-DECISIONS, «Resoluciones pendientes antes de implementación de dominio», y E2E-MATRIX, «Decisiones críticas». Son hallazgos/candidatos, no autoridad normativa. P0 los identifica y asigna sin decidirlos.

| Blocker ID | Description | Authority affected | First phase that requires resolution | P0 blocker | Reason |
|---|---|---|---|---|---|
| D-03 | Estados y cobertura Challenge/Initiative; Core v0.2 vs v0.3 candidata | Core v0.2; posible ADR de cardinalidad | P2, luego P5 si hay cambio técnico | NO | La jerarquía y la diferencia factual/candidato están identificadas. |
| B-01 | Comando, actor, confirmación, idempotencia y vínculo post-Start | Activation v0.2 límite Start; nuevo Experience/Tech | P2 para contrato; P5 diseño técnico; P6 implementación | NO | Falta decisión futura, no fuente de P0. |
| B-02 | Initiative avanzada: identidad, historia y Step legítimo | Core/Steps; Experience post-Start | P2 y P5; P6 ejecución | NO | P0 localizó el vacío y no promueve el candidato. |
| B-03 | Quién confirma contribución y cambios materiales de mandato | Core autoridad humana; Portfolio/Owner | P2 y P5; P9/P10 ejecución | NO | Matriz de responsabilidad por aprobar después. |
| D-08 | Expected/observed/attributed, L5/L6 y ROI | Core v0.2; posible ADR/re-test | P2/P5; P10 ejecución | NO | No altera identificación de fuentes actuales. |
| D-09 | Versionado de mandato, evidencia y `requires_review` | Core v0.2; contrato de reasoning/Card | P3 y P5; P7/P10 ejecución | NO | Reglas detalladas quedan por congelar, no por inventariar. |
| POST-START-A/B/C | Tres rutas y convergencia sin duplicación | Activation v0.2, Core v0.2, contrato candidato SEC | P2; P5 especificación; P6 ejecución | NO | Boundaries y candidaturas ya identificados. |
| CARDINALITY/COVERAGE | Challenge activo/cobertura, `pre_start`, posible cambio de dominio | Core v0.2; PH-0 target candidato | P2 con ADR si altera invariante; P5 | NO | v0.3 no se promovió. |
| DECISION-AUTHORITY | Decisor organizacional y retorno Portfolio | Core v0.2; ADR aplicable, nuevo contrato | P2; P5; P10 ejecución | NO | Autoridad humana vigente identificada; extensión pendiente. |
| CONTEXT-P0 | `STARTERIA_E2E_CODEX_CONTEXT.md` obligatorio, ahora incorporado | Instrucción explícita del Goal y contexto aprobado §0 | P0 | NO — RESOLVED | Texto proporcionado por el usuario, incorporado en ruta canónica y verificado por portada, secciones 0–33 y SHA-256. |

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/docs/STARTERIA_AUTHORITY.md`, §10. **Cita exacta:** «Detener la implementacion y proponer ADR si el cambio: modifica un Invariante Core». **Interpretación:** el gatillo afecta fases que cambien producto; P0 registra la dependencia y no implementa.

**AUTHORITY** — Path: `R/starteria-KAN-153-recovery-ux/docs/STARTERIA_AUTHORITY.md`, §10. **Cita exacta:** «Detener la implementacion y proponer ADR si el cambio: modifica un Invariante Core; altera relaciones o cardinalidades canonicas; expande autoridad de IA; cambia autoridad humana; modifica la funcion estable de Step 0-4». **Interpretación:** estos temas no se resuelven por prototipo o Tech Spec.

## 16. Unknown authority items

- **RESOLVED-CTX — `docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md`.** No existía en las búsquedas iniciales. El usuario proporcionó la versión v0.1 `APPROVED FOR E2E GOAL EXECUTION`; quedó incorporada literalmente en el checkout canónico. Ya no es `UNKNOWN_AUTHORITY` ni bloquea P0. La jerarquía propia del §0 la subordina al Core, ADRs, Experience, Agent, Skill y Tech Spec aplicables.
- **UNKNOWN-INT01 — adopción en Goal de decisiones locales.** Sus fuentes SEC/PL-01 y la copia INT-01 están localizadas y clasificadas en §4, pero no incorporadas al índice canónico KAN-153. No se usan como autoridad normativa del Goal. **No bloquea P1**, que observa AS-IS sin implementar; exige reconciliación antes de P2/P5 según regla.
- **UNKNOWN-STEPS-INTEGRATION — adopción del freeze Steps target externo.** La portada declara pendiente aprobación de integración y reconciliación con superior. El pack está preservado con SHA-256 en `P0_SOURCE_MANIFEST.md`. **No bloquea P0** como inventario ni P1 AS-IS; debe resolverse antes del freeze TO-BE P2.
- **UNKNOWN-E2E-CONTRACT — contrato integral E2E y reasoning/card.** No localizado como aprobado; el Goal ordena crearlos/congelarlos en P2/P3. **No bloquea P0/P1**; no inferirlos del HTML o auditoría.

## 17. P0 Acceptance Criteria

Cada resultado usa la evidencia citada arriba. `BLOCKED` indica que falta autoridad/procedencia; no es bug funcional.

| AC ID | Requirement | Authority / cita exacta | Implementation evidence | Verification command | Runtime evidence | Result / notes |
|---|---|---|---|---|---|---|
| P0-AC01 | Todas las fuentes aplicables localizadas | Authority §8: «identificar el Experience Contract afectado»; «revisar ADRs relevantes»; «revisar Agent/Skill Contracts»; «revisar Tech Spec si existe» | Inventario §§2–13, manifest y Goal Execution Context v0.1 proporcionado | `rtk rg --files` por nombres en `C:/Users/User`; listado ZIP Python `zipfile.namelist()`; lectura del contexto incorporado y SHA-256 | N/A P0 | `PASS`: fuentes obligatorias identificadas; pendientes futuros delimitados por fase. |
| P0-AC02 | Cada fuente material clasificada | Authority §2: «Un contrato presente en el repo no está aprobado por estar» (AGENTS) | Tablas §§3–13 | Lectura de portadas e índices | N/A | `PASS` para las fuentes localizadas; desconocidos explícitos. |
| P0-AC03 | Core vigente o bloqueo documentado | Authority §3: «factual current Core v0.2» | §3 | Lectura de Authority y portadas Core | N/A | `PASS` como autoridad factual; estado «Por validar» conservado. |
| P0-AC04 | Índice y ADR relevantes inspeccionados | Índice canónico: «Registrar aqui solo ADRs de producto» | §4, procedencia INT-01 y discrepancia de índices | Lectura de `doc/product-adr/ADR-INDEX.md` en KAN-153 e INT-01, ADR focales y originales SEC/PL-01 | N/A | `PASS` inventario; 008–011 no gobiernan Goal mientras su adopción sea desconocida. |
| P0-AC05 | Freezes Portfolio/Steps identificados | Acta Portfolio: «FROZEN_UX_APPROVED_FOR_IMPLEMENTATION_PLANNING»; Steps target: «BASELINE DE DISEÑO CONGELADA» | §§9–10 y `P0_SOURCE_MANIFEST.md` | `zipfile.namelist()`, SHA-256 y lectura de entradas | QA mockup, no runtime | `PASS` identificación e integridad del mirror; adopción Steps pendiente P2. |
| P0-AC06 | HTML/mockups autoridad real | Acta Portfolio: «No equivale a ... aprobación de Core/ADRs»; QA Steps: «NO APTO todavía» | §§9–10 | Lectura de acta/QA | QA prototipo | `PASS`. |
| P0-AC07 | Última auditoría AS-IS identificada | E2E summary: «Dictamen al 20/10/2026» | §12 | Lectura de audit pack y ZIP posterior | 25/25 BLOCKED, 80 tests focales PASS según reporte | `PASS` como localización, no verificación independiente de P1. |
| P0-AC08 | Candidatos no promovidos | Authority §3: «It is not promoted» | §§3, 6–8, 11 | Contraste portadas/índice | N/A | `PASS`. |
| P0-AC09 | Superseded no usados como autoridad | Activation v0.2 §0: «actualiza y reemplaza, para este vertical» | §13 | Contraste v0.1/v0.2, Authority §5/6 | N/A | `PASS`. |
| P0-AC10 | Conflictos materiales registrados | AGENTS §2: «Nunca se resuelve en silencio» | §14 CONFLICT-01…05 | Contraste referencias e índices | N/A | `PASS` registro; conflictos abiertos. |
| P0-AC11 | ADR blockers identificados | Authority §10: «Detener la implementacion y proponer ADR» | §15 | Lectura Core/ADR/freeze | N/A | `PASS` identificación; blockers abiertos. |
| P0-AC12 | Código productivo intacto | Goal P0: «No modificar código todavía» | Solo `docs/e2e/` y mirrors; `artifacts/` ya era untracked antes de P0 | `git status --short`; diff de rutas productivas | N/A | `PASS`; ningún archivo `front/`, `backend/`, `ai-service/` editado. |

## 18. Final phase status

**P0 = PASS.** P0-AC01…12 tienen evidencia documental trazada. El checkout canónico y el Tech Spec PL-01 están localizados; el contexto aprobado se incorporó en `docs/e2e/`. CONFLICT-01…05 permanecen visibles y sus decisiones de adopción/producto se asignan a P2/P5 o posteriores; la autoridad factual para el inventario P0 y un AS-IS P1 es inequívoca. Ningún candidato o documento INT-01 no integrado gobierna implementación. P1 continúa `Not authorized` hasta revisión explícita de este cierre.
