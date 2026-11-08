# KAN-242 FASE A — Auditoría y contrato propuesto del loop semántico E1

**Estado:** `PHASE_A_COMPLETE / B_C_SCOPE_AUTHORIZED / B0_RECONCILED`

**Baseline auditada:** `main@afe81709fbb057d7d66d95581c995698985bf340`

**Fecha:** 2026-11-08

**Alcance original:** auditoría y diseño. La autorización posterior de Fases B/C no cambia
la evidencia de Fase A; su perímetro técnico reconciliado se registra a continuación.

## 0. Reconciliación KAN-243 posterior a Fase A

KAN-242#10748 autoriza expresamente Fases B/C y KAN-242#10781 aclara que el estado
`IMPLEMENTATION_NOT_AUTHORIZED` de la fotografía Fase A fue superseded. La autorización queda
condicionada a guardrail V2 positivo, tests-first, feature flag OFF, consumo live deshabilitado y
revisión independiente. No autoriza merge, deploy, infraestructura, secretos ni compras IA.

Decisiones cerradas para B1:

- semantic owner exclusivo: `Portfolio Bootstrap E1`, separado de Portfolio Entry;
- `PortfolioBootstrapContextReview` continúa como snapshot canónico confirmado;
- persistencia aditiva de un agregado semántico por sesión y turnos/eventos versionados;
- facts requieren evidence refs y provenance; hipótesis permanecen separadas;
- `answered_gaps` resuelve conceptos cross-field y una pregunta puede resolver varios gaps;
- una única pregunta activa, estado de convergencia y presupuesto configurable, sin fijar cifras
  nuevas por código;
- CAS, idempotencia, owner/tenant y reentrada son server-authoritative;
- errores retryable conservan el turno original y no producen síntesis ni avance E2;
- métricas duration/tokens/retry/fallback se persisten, sin ejecutar inferencia live en B1;
- `SEMANTIC_E1_ENABLED=false` por defecto y fail-closed.

Contrato técnico B1:

```text
PortfolioBootstrapSemanticState (1 por BootstrapSession)
  version + factLedger + hypotheses + answeredGaps
  activeQuestion + convergence + questionBudget

PortfolioBootstrapSemanticTurn (N por BootstrapSession)
  semanticVersion + actor + organization + input
  facts + hypotheses + answeredGaps + question state + convergence
  status/error + idempotency request hash
  duration + input/output/total tokens + retry/fallback/provider/model
```

La escritura queda en un servicio backend interno para que B2 sea el único productor de output
semántico validado. B1 expone lectura owner-scoped; no acepta facts arbitrarios desde el navegador.
El endpoint de inferencia y el provider se implementan únicamente en KAN-245/B2.

Reconciliación de autoridad:

- Core v0.2 INV-03/04/05 se preserva: IA propone, estado oficial estructurado/versionado y claims
  con provenance/evidence;
- ADR-002 continúa limitado a Portfolio Entry; sólo se reutilizan patrones técnicos;
- no cambia Core, Steps, Handoff, entidades canónicas ni autoridad humana;
- la extensión Prisma es expand-only, nullable/JSON donde corresponde, sin backfill ni modificación
  de filas legacy.

## 1. Resultado ejecutivo

El E1 de Portfolio Bootstrap implementado no contiene un loop semántico. La conversación
`PortfolioBootstrapContextConversation` recorre cuatro campos en orden fijo (`situation`,
`area`, `stakeholder`, `pilotExperience`), usa expresiones regulares sólo para ajustar el
copy y considera resuelto cada campo por su propio valor o disposición. Una narración que
ya contiene «nunca hemos hecho un piloto» no resuelve `pilotExperience` si fue guardada en
`situation`; por ello la pregunta reaparece.

Portfolio Entry sí dispone de análisis estructurado, una pregunta visible por turno,
`previous_questions`, `answered_gaps`, presupuesto, CAS, trazas y adapter live con retry y
fallback opcional. Esa capacidad pertenece al bounded context Portfolio Entry. ADR-002
excluye expresamente Portfolio Bootstrap y no autoriza implementación por sí mismo. Los
skills v0.1 de `doc/` siguen propuestos; los prompts v0.2 sí son cargados por Entry, no por E1.

La persistencia E1 conserva correctamente draft, snapshot confirmado, procedencia, versiones,
CAS, idempotencia, autorización y tenant. No representa turnos semánticos, hechos con evidencia,
hipótesis, resoluciones, pregunta activa, convergencia o ejecución del modelo. FASE B necesita
autoridad backend/API y una decisión de persistencia; Prisma es probable si el historial debe ser
durable y consultable. No se implementa hasta confirmar estas dependencias.

## 2. Autoridad reconciliada

1. El Core factual vigente es `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`.
2. `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` v0.3 es candidato, no autoridad promovida.
3. ADR-002 está aceptado para Portfolio Entry, declara `IMPLEMENTATION AUTHORIZED: NO` y
   excluye Bootstrap.
4. `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` gobierna Entry, no E1.
5. KAN-219/220/221/222 gobiernan el bridge persistente; KAN-241 sólo autorizó adaptación
   determinista frontend y excluyó IA/backend/Prisma.
6. KAN-242 FASE A autoriza auditoría y diseño, no implementación.

Invariantes Core preservados:

- la IA propone y no adquiere autoridad organizacional;
- los claims materiales llevan procedencia y evidencia;
- chat no es el registro oficial: el estado confirmado es estructurado y versionado;
- una síntesis IA no se vuelve verdad automáticamente;
- la historia no se sobrescribe silenciosamente;
- la confirmación humana sigue siendo el gate E1 → E2.

```text
CONFLICT
Contract: ADR-002 y skills/prompts Portfolio Entry
Requirement: loop semántico en Portfolio Bootstrap E1
Current document/code: ADR-002 excluye Bootstrap; KAN-241 excluye backend/IA/Prisma
Observed mismatch: existe infraestructura reutilizable, pero no autoridad para conectarla a E1
Risk: transferir semántica, presupuesto y persistencia de Entry por inferencia
Recommended treatment: ADAPT mediante contrato E1 y subtarea técnica autorizados
Requires ADR: no si no cambia Core; sí si cambia autoridad o cardinalidad Core
```

## 3. Implementado frente a documentado

| Superficie | Implementado | Sólo documentado, propuesto o ausente |
|---|---|---|
| Bootstrap E1 UI | Secuencia fija; variantes regex; `unknown`/`not_applicable` en gaps; síntesis editable; confirmación y CTA E2 | Interpretación semántica, extracción multihecho, recap semántico, historial y convergencia no existen |
| E1 navegación | `effectiveContext` habilita E2; confirmación y avance separados; E2 confirmado habilita E3 | El provider no decide navegación; no hay gate server-side de suficiencia semántica |
| E1 cliente | GET/PUT/POST; timeout 15 s; CAS; key estable durante retry; epoch de sesión | No hay endpoint de turno, pregunta activa ni model execution |
| E1 backend | Owner/tenant; Company opcional; draft; snapshot; corrección; CAS; receipt; serializable retry; auditoría | No hay extractor, planner, `answered_gaps`, resoluciones o metadata IA |
| E1 Prisma | Review, versiones snapshot y receipts | No existe turno semántico durable ni enlace a model execution |
| Entry analysis | Intent, frame, contexto extraído, ambigüedades, contradicciones, reverse alignment, provenance y question plan | No es contrato E1 ni modela automáticamente sus conceptos |
| Entry loop | 0/1 pregunta; quick budget 3; guided 2; historial; gaps; safety; checkpoints | Presupuesto no ratificado para E1; dedupe semántico depende de `resolves` estables |
| Entry resolución | ID activo 0..1; unknown retira pregunta sin resolver; sólo resuelve con valor estructurado | No crea por sí solo un ledger de conceptos E1 cross-field |
| Entry persistencia | Turnos, análisis, semantic state, CAS/idempotencia y latencia | `usage` no se copia al registrar, `retryReason` queda null y `fallbackUsed` no es durable; no hay coste calculado |
| Entry provider | Adapter `/responses`, schema estricto, timeout, un retry, fallback finito opcional, unconfigured fail-closed | No hay SLA/coste E1 aprobado; fallback sólo es real con clave ya existente |
| Skills v0.1 | No se ejecutan directamente | `doc/entry-01..04_*_v0.1.md` dice `PROPUESTO PARA REVISIÓN` |
| Prompts v0.2 | Manifest carga agent + entry-01..04; planner pide 0/1 y no repetición | Su ejecución en Entry no promueve el stack candidato ni autoriza E1 |

## 4. Evidencia factual

### Bootstrap E1/E2 y persistencia

- `PortfolioBootstrapContextConversation.tsx` define `ContextField`, `CONTEXT_FIELDS`,
  `fieldResolved()` y `guidedContextQuestion()`. Las regex cambian vocabulario, no extraen hechos.
- `PortfolioBootstrapHome.tsx` monta `FrozenContextConversation` y
  `FrozenObjectiveConversation`; calcula progreso con `effectiveContext` y mantiene avance explícito.
- `usePortfolioBootstrapContext.ts` aplica CAS, receipt estable por operación, retry y epoch; no
  contiene adapter/planner.
- `portfolioBootstrapContextClient.ts` restringe el payload a cuatro campos, constraints,
  assumptions, gaps y provenance por campo.
- `portfolio-bootstrap-context.service.ts` protege owner/tenant, versión esperada, transacción
  serializable, idempotencia y snapshots. Correcciones no sustituyen el confirmado hasta reconfirmar.
- `portfolio-bootstrap.schemas.ts` es `strict()` y no acepta turnos, facts o questions.
- `PortfolioBootstrapContextReviewVersion` registra snapshots de acciones, no conversación.

### Portfolio Entry question planner, skills y loop

- `analysis.schema.ts` valida `reason_to_ask`, `resolves`, prioridad y tipo esperado.
- `question-budget.ts` normaliza a una pregunta y descarta repetición por ID, texto normalizado o
  conjunto exacto de `resolves`.
- `single-turn-result.ts` sólo resuelve targets de la pregunta activa si el análisis posterior
  contiene valores significativos; unknown conserva el gap sin repetir esa pregunta.
- `session-controller.ts` conserva `previous_questions`, aplica presupuesto y converge a pregunta,
  checkpoint o parada técnica/safety.
- `session-safety-limits.ts` fija para Entry 12 turnos, 20 llamadas y 3 rondas; E1 no hereda esto.
- Los documentos v0.1 son propuestos. `prompt-manifest.ts` sí carga los prompts v0.2, incluido
  `entry-04-question-planner.md` de 0/1 pregunta.

### Adapter live, fallback y observabilidad

- `LivePortfolioEntryAgentAdapter` envía input, análisis previo, contexto y presupuesto con salida
  validada por schema.
- `FetchStructuredModelAdapter` captura duración, retry, usage y fallback en memoria.
- `ResilientStructuredModelAdapter` usa fallback sólo para fallos elegibles, no auth/config/4xx.
- `portfolio-entry.router.ts` usa live en producción; sin config entrega adapter unconfigured, no
  una respuesta semántica simulada.
- El fallback existe sólo si `PORTFOLIO_ENTRY_FALLBACK_API_KEY` ya está configurado. KAN-242 no
  autoriza secretos, proveedor nuevo ni gasto.
- `PortfolioEntryModelExecution` tiene `usage` y `retryReason`, pero `recordExecution()` no los
  copia y `fallbackUsed` no forma parte del record. Latencia sí se guarda.

## 5. Hallazgos priorizados

1. **Crítico — E1 no es semántico.** No reconoce equivalencia ni hechos en otro campo.
2. **Alto — autoridad insuficiente.** Entry es reutilizable técnicamente, no transferible como
   semántica o autoridad de Bootstrap.
3. **Alto — persistencia insuficiente.** El payload strict no representa turnos, evidencia,
   hipótesis, resoluciones, pregunta activa o convergencia.
4. **Alto — coste/fallback no trazables.** Usage y fallback se pierden parcialmente al persistir.
5. **Medio — dedupe limitada.** ID/texto/`resolves` exactos no sustituyen un ledger conceptual E1.
6. **Medio — Critical Synthesis no es apta por turno.** Es una segunda llamada grande y lenta.

## 6. Contrato funcional propuesto

### Propósito y unidad de interacción

E1 convierte narrativa empresarial en contexto estructurado, editable, versionado y confirmable
para E2. No crea departamentos, capacidades, KPI, piloto, equipo o hechos no soportados.

Cada turno aceptado termina en exactamente uno de:

1. una pregunta material con recap factual y motivo;
2. síntesis lista para revisión/confirmación;
3. parada técnica explícita y reintentable.

Nunca presenta un lote ni deja que el modelo avance a E2.

### Estado semántico mínimo

```text
SemanticE1State
  facts[]: conceptId, value/polarity, provenance, evidence, confidence, status
  hypotheses[]: statement, support[], confidence, PROPOSED|ACCEPTED|REJECTED
  dispositions[]: conceptId, UNKNOWN|NOT_APPLICABLE, sourceTurnId
  unresolvedMaterialGaps[]
  previousQuestions[] / answeredQuestionIds[] / resolvedConceptIds[]
  activeQuestion: null | { id, recap, question, reasonToAsk, resolves[] }
  convergence: { status, reason, budgetUsed }
  synthesis / confirmedSnapshotRef
```

`COPILOT_INFERRED` nunca se mezcla con `USER_DECLARED`; una hipótesis no se promueve a hecho sin
aceptación o evidencia. Cada claim material apunta a evidencia.

### Resolución cross-field

- La resolución opera por `conceptId`, no por campo visual.
- Un turno puede resolver varios conceptos con evidencia individual.
- «Nunca hemos probado un piloto» resuelve `pilot_experience = none` aunque llegue en situación.
- «Somos tres y no tenemos departamentos» soporta estructura ligera; no inventa funciones.
- Ausencia de mención no equivale a `false`, `none` o `not_applicable`.
- `UNKNOWN` retira la pregunta, mantiene la incertidumbre y no resuelve el concepto.
- `NOT_APPLICABLE` sólo existe por declaración explícita.

### Hechos, hipótesis y no invención

1. Fact material requiere fuente y evidencia.
2. Inferencia se almacena como hipótesis con soporte/confidence.
3. Sugerencia no es fact.
4. Contradicción conserva claims y sólo pregunta si es material.
5. Output sin evidencia se rechaza en schema/validador.
6. La proyección determinista cambia estado; el prompt nunca es el único gate.

### Pregunta única

```text
Recap: “Entiendo que sois una cafetería pequeña y aún no habéis probado un piloto.”
Question: “¿Qué situación concreta os gustaría mejorar primero?”
Reason: “Me ayuda a formular un objetivo útil sin asumir departamento o métrica.”
```

El recap sólo contiene facts soportados y disposiciones. No se pregunta si ya fue contestado, si la
pregunta fue retirada por unknown/no aplica o si la respuesta no cambiaría materialmente E2.

### Historial, convergencia y síntesis

Cada turno persiste texto/actor, pregunta respondida, extracción con evidencia, resoluciones,
pregunta o motivo de no emitirla, estado/version, metadata y receipt. Reentrada reconstruye todo.
Corrección crea versión y mantiene el snapshot confirmado efectivo hasta reconfirmar.

E1 es suficiente cuando hay situación/oportunidad o decisión concreta, dirección suficiente para
iniciar E2, restricciones/actores/incógnitas materiales representados y ningún gap cuya respuesta
probablemente cambie el framing inicial. No exige cuatro campos ni agotar presupuesto.

Salidas: `QUESTION_REQUIRED`, `READY_FOR_HUMAN_REVIEW`,
`USER_CHOSE_TO_REVIEW_WITH_UNKNOWNS`, `BUDGET_CHECKPOINT`,
`PROVIDER_RETRYABLE_FAILURE`, `SAFETY_STOP`.

ADR-002 fija 3 quick + 2 guided sólo para Entry. FASE B debe ratificar explícitamente si E1 reutiliza
esos límites. Hasta entonces sólo rige una pregunta activa y no se inventa presupuesto E1.

La síntesis separa hechos/provenance, situación interpretada, restricciones/actores, hipótesis,
unknown/no aplica e implicación provisional para E2. Editar guarda draft versionado. El CTA persiste
y confirma server-side antes de habilitar E2; la IA no confirma ni salta el gate.

## 7. Contrato técnico propuesto

```text
authorize owner/tenant
  -> load expectedVersion
  -> claim/check idempotency receipt
  -> persist raw turn pending
  -> one structured call with existing configured provider
  -> validate schema/evidence/no-invention
  -> resolve concepts cross-field
  -> deterministic question/convergence policy
  -> atomically persist turn + state/version + execution
  -> return one question, review-ready, or retryable failure
```

Reglas:

- `expectedVersion` obligatorio; stale recarga y nunca last-write-wins.
- Misma key + mismo payload reentra; misma key + payload distinto es conflicto.
- Timeout ambiguo consulta receipt antes de repetir inferencia.
- Pending/failed es visible y reintentable sin duplicar facts/questions.
- Reutilizar sólo adapters y configuración existentes; no crear proveedor, clave o entorno.
- Sin proveedor/fallback: guardar raw turn `FAILED_RETRYABLE`, no fingir síntesis ni habilitar E2.
- Auth/config/4xx no elegible falla explícitamente; no se revela secreto.

Reutilizable tras autorización: interfaces del adapter, patrón de prompt manifest, conceptos de
historial/resolución/safety, patrones CAS/model execution y bridge E1 draft/confirm.

No reutilizar sin adaptar: DTO/taxonomía Entry, prompt de `recommended_approach`, Critical Synthesis
por turno, presupuesto Entry, confirmación/handoff Entry o fallback determinista productivo.

### Decisión de persistencia bloqueante

Recomendación: API E1 aditiva con turnos semánticos durables y relación a model execution,
manteniendo `PortfolioBootstrapContextReview` como snapshot oficial. Probablemente exige Prisma.
Ampliar sólo el JSON evita migración, pero debilita historial, receipt de inferencia, reconciliación
de timeout y trazabilidad. La autoridad técnica debe elegir antes de tests de implementación.

## 8. Coste, latencia y fallback real

- Análisis Entry: timeout default 30 s y un retry; hasta dos intentos primarios.
- Con fallback existente, éste puede tener sus propios intentos: límite secuencial teórico default
  cercano a 120 s, no un SLA de UI aceptable.
- Critical Synthesis usa timeout 120 s, sin retry de timeout, y no debe llamarse por turno.
- `durationMs` es durable; usage/retry/fallback no están completos en DB.
- Sin usage durable ni tarifas versionadas no existe coste monetario defendible por turno.

Gate previo a rollout:

- una llamada estructurada por turno;
- medir p50/p95 y tokens por provider/model autorizado;
- persistir usage/retry/fallback y aprobar presupuesto;
- pasar a pending/retryable al superar el umbral UX aprobado;
- no añadir proveedor ni segunda síntesis;
- probar que ausencia de provider no produce hechos ni avance.

Coste y SLO: `UNKNOWN / BLOCKING FOR ROLLOUT`. FASE A no ejecuta inferencia ni genera gasto.

## 9. Casos de aceptación para FASE B

| ID | Escenario | Resultado obligatorio |
|---|---|---|
| C01 | Cafetería sin piloto | Resuelve ausencia de piloto desde narrativa; no pregunta área/equipo/piloto ya cubierto; no inventa KPI |
| C02 | Microempresa sin departamentos | Lenguaje proporcional; no pregunta organigrama; no aplica sólo si se declara |
| C03 | Corporativo formal | Reconoce área/proceso/actores y pregunta sólo el gap material |
| C04 | Respuesta cubre varias preguntas | Resuelve varios conceptos con evidencia; siguiente resultado tiene 0/1 pregunta distinta |
| C05 | Unknown/no aplica | Retira pregunta; unknown conserva gap; no aplica conserva disposición; no reformula lo mismo |
| C06 | Reentrada | Restaura facts, disposiciones, historial, pregunta, budget y snapshot sin pérdida |
| C07 | Stale/CAS | Segundo cliente recibe conflicto; no sobrescribe ni duplica turno/inferencia |
| C08 | Timeout/provider failure | Retry visible/idempotente; raw turn persiste; sin síntesis falsa ni E2 |
| C09 | No invención | Fact sin evidence ref se rechaza; hipótesis separada y no confirmada |
| C10 | Confirmación E1→E2 | Guarda/confirma server-side antes de E2; corrección no reemplaza snapshot hasta reconfirmar |

Cada caso requiere policy/domain, API/DB y, cuando aplique, E2E autenticado sobre PostgreSQL
desechable. Tests de provider herméticos; CI nunca consume IA real.

## 10. Ruta concreta de desarrollo

1. **Decisión funcional/autoridad:** aprobar semantic owner, conceptos/suficiencia, presupuesto E1,
   unknown/no aplica, SLO/coste y necesidad de ADR.
2. **Subtarea de contrato backend/API/Prisma:** elegir persistencia; autorizar endpoint/schema,
   model execution completo, CAS/idempotencia/timeout y prompt E1 versionado. Bloquea frontend.
3. **Implementación backend/IA:** una llamada, provider/fallback existentes, sin Critical Synthesis;
   tests-first C04/C05/C07/C08/C09 y PostgreSQL desechable.
4. **Frontend E1:** historial, recap+motivo+pregunta, síntesis, pending/error/retry, reentrada y CTA;
   tests-first C01–C06/C10 y E2E autenticado.
5. **Certificación:** regresiones KAN-221/222/241 y Entry, 0 skips obligatorios, lint/typecheck/build,
   DB disposable, revisión independiente, CI y matriz requisito → archivo → test → commit → CI.

## 11. Estado final

```text
AUDIT: COMPLETE
CONTRACT: PROPOSED
IMPLEMENTATION: NOT AUTHORIZED
BACKEND/API/PRISMA DEPENDENCY: MATERIAL / REQUIRES EXPLICIT AUTHORITY
AI PROVIDER: REUSE EXISTING ONLY; NO NEW SPEND AUTHORIZED
COST/SLO: UNKNOWN UNTIL OBSERVABILITY + BENCHMARK GATE
NEXT HUMAN DECISION: approve/correct contract, ownership, persistence and budget
```
