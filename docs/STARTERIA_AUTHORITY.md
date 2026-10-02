# Starteria - Authority Map

**Documento:** `docs/STARTERIA_AUTHORITY.md`
**Version:** v0.1
**Estado:** Base de gobernanza para repositorio mixto documental + implementacion controlada
**Fecha:** 2026-09-09
**Estado del repositorio:** ver `../CURRENT_STATE.md`

## 1. Proposito

Este archivo indica a cualquier persona, agente o herramienta que documentos tienen autoridad y en que orden deben consultarse.

Este repositorio es actualmente mixto: conserva harness/documentacion publica y contiene implementacion frontend/backend con tests. No es runtime productivo certificado por defecto.

El codigo presente en el arbol no redefine Starteria ni autoriza incorporacion productiva por si solo. La evolucion frontend puede ocurrir solo con decision explicita de slice, autoridad leida, alcance documentado y reporte. Backend, Prisma, IA productiva, Core y cambios de semantica de producto requieren autorizacion especifica adicional.

## 1.1. Manifest operativo V2

La reconciliacion Starteria V2 utiliza como indice operativo:

`../STARTERIA_V2_MANIFEST.md`

El Manifest NO reemplaza:

- Core;
- ADRs;
- Experience Contracts;
- Agent Contracts;
- Skill Contracts.

Su funcion es declarar que version y estado corresponde actualmente a cada slice y distinguir:

```text
logic status
implementation status
visual status
evidence status
```

Cuando exista una discrepancia entre:

```text
documentacion
implementacion
tests
visual migration
```

no debe elegirse silenciosamente una fuente.

Debe registrarse el conflicto y reconciliarse segun esta Authority Map.

## 2. Jerarquia de autoridad

Cuando dos fuentes entren en conflicto, aplicar este orden:

1. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`
2. ADRs de producto aprobados en `docs/product-adr/`
3. Experience Logic Contracts aprobados
4. Agent Contracts
5. Skill Contracts
6. Tech Specs
7. PRDs
8. Prototipos, mockups, prompts experimentales y reportes historicos
9. Implementacion historica presente en el arbol

Regla: si dos fuentes entran en conflicto, gobierna la de mayor autoridad y debe conservarse el estado factual declarado por cada documento.

## 3. Estado factual del Core Contract

Core Contract:

`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`

Estado declarado actual:

- Version: `v0.2`
- Estado: `Base fundacional revisada / Por validar`

The external `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` v0.3 artifact is not
materialized or promoted in this checkout. It remains a reconciliation
candidate and requires an ADR, original evidence and re-test before promotion.

La presencia de este contrato en el repositorio no lo convierte en aprobado. Cualquier cambio que dependa de tratarlo como aprobado requiere ratificacion explicita.

## 4. Contrato activo para Portfolio Entry

Para el vertical slice `Pantalla 1 - Portfolio Entry / Landing publica`, el Experience Contract activo es:

`doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`

Estado declarado:

- Version: `v0.1`
- Estado: `APROBADO COMO BASE DE EXPERIENCIA PARA AUDITORIA E IMPLEMENTACION`

No crear otro `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` si duplica este contrato. Usar una sola autoridad.

El desarrollo de este slice no debe modificar el comportamiento del Adaptive Core / Step 0-4.

## 4.1 Portfolio Home and Strategic Framing reconciliation status

PH-0 remains a frozen Portfolio Home governance target. PH-2 is implemented on
this branch and post-merge revalidated as `GO_WITH_GAPS`; the report is evidence
only and runtime is not globally certified. PH-3A is design/reconciliation
evidence. PH-3B is not implemented and remains paused pending later SF-7
reconciliation.

The SF-0 Strategic Framing documentation package is materialized under
`docs/portfolio-lead/07-strategic-framing/` and was human-approved on
2026-09-24. The Experience Contract is an `APPROVED` Experience Contract,
subordinate to Core v0.2 and approved ADRs. This approval does not imply
runtime implementation, does not execute SF-1 and is not a canonical Core
extension.

## 4.2 Portfolio Lead First Value — A.3.2

For the KAN-63 First Value checkpoint and inline review slice, Jira KAN-63
identifies the following document as its Source of Truth:

`docs/portfolio-lead/06-portfolio-monitoring/experience/STARTERIA_PORTFOLIO_LEAD_A32_CHECKPOINT_INLINE_REVIEW_v0.1.md`

The document is a slice-specific `DELTA IMPLEMENTATION SPEC`; this entry makes
its cited source available on the governed baseline and does not promote it to
a generally approved Experience Logic Contract. Its A.3/A.3.1 v0.2 references
were not found in repository history. The A.3.2 requirements are self-contained
in the spec and KAN-63; the A.3/A.3.1 implementation reports remain historical
evidence, not normative dependencies. No KAN-63 acceptance criterion or product
semantics are changed by this reconciliation.

## 5. Contrato activo para Portfolio -> Initiative Activation/Handoff

Para el bounded context:

```text
Portfolio / Challenge -> Invitation -> Accept -> Initiative Overview -> Start
```

El Experience Contract activo para este bounded context es:

`docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md`

**Estado:** ACTIVE / FROZEN FOR IMPLEMENTATION PLANNING

El contrato v0.1 queda superseded para este bounded context y se conserva
como referencia historica y de trazabilidad:

`docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.1.md`

Este contrato:

- no reemplaza `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`;
- no reemplaza este Authority Map;
- gobierna especificamente la experiencia y lifecycle del bounded context Portfolio -> Initiative Activation/Handoff;
- termina en la frontera `Start` y no autoriza modificar Steps 0-4.

La relacion de autoridad para este bounded context es:

```text
STARTERIA_AUTHORITY
        |
        v
STARTERIA_CORE_LOGIC_CONTRACT
        |
        v
PORTFOLIO_GOVERNANCE_INTERACTION_CONTRACT
        |
        v
PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT
        |
        v
Implementation / Tech Specs
```

El audit:

`docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_HANDOFF_CURRENT_STATE_AUDIT_v0.1.md`

queda fuera de la linea de autoridad. Es evidencia factual de current state para clasificar KEEP / ADAPT / NEW / DEPRECATE / ADR CANDIDATE.

## 6. Documentos de referencia

### Core

- `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`
- `docs/core/STARTERIA_CRAZY8S_E2E_BASE_LOGIC_v0.1.md`

### Gobernanza de desarrollo

- `docs/governance/STARTERIA_DEVELOPMENT_HARNESS_v0.1.md`
- `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md`
- `docs/governance/STARTERIA_V2_IMPLEMENTATION_PLAYBOOK.md`

### Portfolio Entry

- `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
- `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_ACCEPTANCE_CHECKLIST_v0.1.md`
- `docs/experience/portfolio-entry/PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md` - propuesto para revision, no implementado
- `docs/agents/portfolio-entry/PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.1.md` - propuesto
- `docs/agents/portfolio-entry/skills/entry-01-intent-detection/SKILL.md` a `entry-04-question-planner/SKILL.md` - propuestos
- `docs/ai-harness/portfolio-entry/PORTFOLIO_ENTRY_AI_HARNESS_v0.1.md` - harness propuesto/ejecutable segun su propio estado

#### Candidate reconciliation stack

The following Portfolio Entry documents are installed in the repository as a candidate reconciliation stack:

- `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
- `docs/agents/portfolio-entry/PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
- `docs/agents/portfolio-entry/skills/entry-01-intent-detection/SKILL_v0.2.md`
- `docs/agents/portfolio-entry/skills/entry-02-context-extraction/SKILL_v0.2.md`
- `docs/agents/portfolio-entry/skills/entry-03-reverse-alignment/SKILL_v0.2.md`
- `docs/agents/portfolio-entry/skills/entry-04-question-planner/SKILL_v0.2.md`
- `docs/ai-harness/portfolio-entry/PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`
- `docs/ai-harness/portfolio-entry/PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2.md`

Evidence:

- `docs/ai-harness/portfolio-entry/PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md`

This stack is present for reconciliation and validation.

Its presence does NOT automatically supersede:

- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`;
- current v0.1 Agent/Skill/Harness documents;
- any approved Experience Contract.

Promotion to active authority requires repository validation and an explicit authority update.

`PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md` is evidence and does not define product authority.

Nota de estado: implementado no equivale a aprobado ni a probado end-to-end. El Experience Contract v0.1 sigue siendo el contrato activo aprobado para Pantalla 1. Los documentos Agent/Skill conservan su estado propio hasta ratificacion explicita.

### Portfolio Lead / Activation-Handoff

- `docs/portfolio-lead/04-channel-independence/PORTFOLIO_GOVERNANCE_INTERACTION_CONTRACT_v0.1.md` - contrato de interaccion/canal; debajo de Core.
- `docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md` - Experience Contract activo del bounded context Portfolio -> Initiative Activation/Handoff; frozen for implementation planning.
- `docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.1.md` - superseded para este bounded context; referencia historica conservada para trazabilidad.
- `docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_ACCEPTANCE_CHECKLIST_v0.1.md` - checklist de aceptacion H-0.
- `docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_HANDOFF_CURRENT_STATE_AUDIT_v0.1.md` - evidencia factual; no autoridad funcional.

## 7. ADRs

- ADRs de harness/documentacion: `docs/adr/`.
- ADRs de producto: `docs/product-adr/ADR-INDEX.md`.
- El índice de producto apunta a los ADR-027 y ADR-031 canónicos en
  `backend/docs/adr/` durante la reconciliación de este checkout mixto;
  ADR-031 tiene estado `Accepted` por decisión explícita del 2026-09-20.
- No mezclar la serie de producto con `docs/adr/ADR-001...007`.

## 8. Reglas obligatorias

Antes de modificar producto:

1. leer `../CURRENT_STATE.md`;
2. leer `../STARTERIA_V2_MANIFEST.md`;
3. leer este archivo;
4. leer `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` y conservar su estado factual;
5. identificar el Experience Contract afectado;
6. revisar ADRs relevantes;
7. revisar Agent/Skill Contracts;
8. revisar Tech Spec si existe;
9. revisar `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md`;
10. seguir `docs/governance/STARTERIA_V2_IMPLEMENTATION_PLAYBOOK.md`;
11. inspeccionar la implementacion actual;
12. ejecutar baseline tests;
13. reportar conflictos antes de editar.

## 9. Conflicto contrato / codigo

Si el codigo actual contradice una autoridad superior, no preservar el comportamiento solo porque ya existe.

Reportar:

```text
CONFLICT
Contract:
Requirement:
Current implementation:
Observed mismatch:
Risk:
Recommended treatment:
KEEP / UPDATE / ADD / DEPRECATE
Requires ADR: yes/no
```

## 10. Regla de ADR

Detener la implementacion y proponer ADR si el cambio:

- modifica un Invariante Core;
- altera relaciones o cardinalidades canonicas;
- expande autoridad de IA;
- cambia autoridad humana;
- modifica la funcion estable de Step 0-4;
- cambia logica de ciclo/gating adaptativo;
- convierte inferencias en verdad canonica automaticamente;
- requiere migracion de dominio material.

## 11. Portfolio Entry - guardrails especificos

Durante implementacion de `/public/start`:

- no crear Organization;
- no crear StrategicFront;
- no crear Challenge;
- no crear Initiative;
- no crear Step;
- no crear Decision;
- no activar Step 0;
- no modificar Step 0-4;
- no modificar Adaptive Cycle;
- no aceptar archivos publicos P0;
- no convertir inferencias IA en confirmadas;
- no presentar preview ilustrativa como analisis real.

## 12. Regla final

El codigo implementa contratos; no redefine Starteria.
