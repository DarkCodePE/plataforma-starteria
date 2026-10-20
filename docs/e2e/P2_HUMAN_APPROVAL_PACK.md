# P2 Human Approval Pack — Unified E2E Experience

**Fecha:** 2026-10-20. **Estado:** HUMAN_DECISION_RECORDED. **P2:** PASS after documentary verification. **Objeto revisado:** [STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md](STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md), now FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING. **Checkout:** C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux, branch feat/KAN-153-recovery-ux, HEAD 1e689ea5c54f7513e323e30f58e45e7168738c7c.

Este pack precisa el alcance de las entradas de [P2_OPEN_DECISION_REGISTER.md](P2_OPEN_DECISION_REGISTER.md). Su clasificación más fina no promueve el Steps target ni un documento candidato a autoridad. La aprobación humana registrada en §Final disposition congela solo las reglas de experiencia compatibles con el Core factual y los ADR aprobados. P1 mantiene T01–T25 **BLOCKED** en runtime ([P1_RUNTIME_BASELINE.md](P1_RUNTIME_BASELINE.md), §§7, 16); ninguna conclusión AS-IS acredita funcionamiento E2E.

## Consolidated Decision Table

| ID | Topic | Classification | Recommended disposition | ADR? | Blocks P2 freeze? | Earliest required phase |
|---|---|---|---|---|---|---|
| D-03 | Alineamiento y cobertura conceptual | RESOLVED_BY_EXISTING_AUTHORITY | Aplicar Core v0.2; cálculo concreto a P5 | No para principio; sí si se cambia Core/cardinalidad | NO | P5 para cálculo |
| B-01 | Comando y persistencia tras Start | DEFER_TO_P5 | Respetar límite de Start; diseñar confirmación downstream sin duplicar identidad | Condicional a cambio canónico | NO | P5 |
| B-02 | Continuidad de Initiative existente | RESOLVED_BY_EXISTING_AUTHORITY | Conservar ID/historia y gating retroactivo; regla exacta de ciclo/Step a P5 | Condicional a cambio de gating | NO | P5 para regla exacta |
| B-03 | Confirmación de contribución/mandato | DEFER_TO_P5 | Mantener confirmación humana material; definir matriz por tipo de decisión | Sí si se amplía autoridad humana/IA | NO | P5 |
| D-08 | Expected/observed/attributed | RESOLVED_BY_EXISTING_AUTHORITY | Aplicar madurez L0–L6 y Benefit Tracking; política ROI a P5/P10 | Sí si se debilitan L5/L6 | NO | P5 para presentación/cálculo |
| D-09 | Historia y revisión dirigida | RESOLVED_BY_EXISTING_AUTHORITY | Preservar versiones y revisión material; semántica fina a P3, dependencias técnicas a P5 | Sí si se cambia gating Core | NO | P3 |
| POST-START-A/B/C | Experiencia downstream unificada | HUMAN_PRODUCT_DECISION | **Option A APPROVED** por el usuario para experiencia P2 acotada | No para experiencia compatible; condicional para cambios Core | NO — RESOLVED | P2, resuelto |
| CARDINALITY/COVERAGE | Relaciones corporativas e independientes | RESOLVED_BY_EXISTING_AUTHORITY | Mantener casos permitidos por Core v0.2; cualquier cambio canónico por ADR | Sí para cambio de cardinalidad | NO | P5 si se propone cambio |
| DECISION-AUTHORITY | Decisor material y retorno | DEFER_TO_P5 | Decisión humana por tipo; matriz de actor y efecto en Tech Spec | Sí si cambia autoridad | NO | P5 |
| SUPPORT-REQUEST | Señal de bloqueo/apoyo | DEFER_TO_P5 | Congelar solo comportamiento; auditar HelpRequest/AttentionItem antes de crear entidad | Posible si cambia dominio/autoridad | NO | P5 |

**Criterio de lectura:** “NO” en P2 freeze significa que el contrato puede congelar el límite de experiencia ya escrito sin decidir un comando, permiso, schema o algoritmo. No autoriza implementar el detalle. “Condicional” significa que un ADR se vuelve obligatorio **solo** si una propuesta posterior altera un invariante, cardinalidad, autoridad o gating vigente. El registro P2 originalmente llamaba abiertas a estas entradas en bloque; este pack separa su parte ya gobernada de la parte todavía pendiente. La disposición final se refleja en el registro y el contrato sin añadir reglas de producto.

## Final disposition

**Decision ID:** P2-HUMAN-APPROVAL-2026-10-20. **Source:** mensaje explícito del usuario de 2026-10-20 en este Goal, §§1–7. **Actor:** humano solicitante/autorizante del Goal. **Result:** APPROVED Option A de POST-START-A/B/C y aprobación del contrato P2 v0.1 para congelación de experiencia.

**Exact quotes from the human decision:**

> Apruebo la **Option A de post-Start A/B/C** presentada en `P2_HUMAN_APPROVAL_PACK.md`.

> La Initiative canónica nace únicamente en el checkpoint de confirmación definido por esta ruta.

> No se crea una segunda Initiative.

> No se debe crear una jerarquía corporativa ficticia —StrategicFront, Challenge u objetos equivalentes— cuando el contexto no la requiere.

> Apruebo:

> `STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`

**Interpretation:** Route A formula y recibe confirmación humana antes de crear exactamente una Initiative; Route B reutiliza identidad/historia/evidencia y no aprueba Steps por reconstrucción; Route C confirma una Initiative independiente sin estructura corporativa ficticia. El contrato v0.1 cambia a FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING. La aprobación no promueve CORE3/INT-01, no cambia Core v0.2, dominio, cardinalidad, autoridad humana/IA ni funciones/gates de Steps. Mantiene P3/P5 diferidos, ADR triggers y T01–T25 BLOCKED. Es autorización de cierre P2, no autorización para iniciar P3 ni implementar.

## Authority key and evidence discipline

| Key | Exact path | Version/status and authority scope |
|---|---|---|
| CORE | doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md | v0.2, factual/current Core según [P0_AUTHORITY_SNAPSHOT.md](P0_AUTHORITY_SNAPSHOT.md); autoridad sobre invariantes |
| CORE3 | docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md | v0.3, CANDIDATE; no gobierna |
| ADR5 | doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md | ACCEPTED — ADR DESIGN ONLY; Handoff/identidad actual |
| ACT | docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md | v0.2, FROZEN_EXPERIENCE hasta Start; referencia subordinada a CORE3 registrada como CONFLICT-01 en P0, por lo que solo se usa donde es compatible con CORE v0.2 y ADR5 |
| PLF | docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/01_FROZEN_PORTFOLIO/01_FREEZE_DECLARATION.md | v1.0, FROZEN_EXPERIENCE visual de Portfolio Lead; mirror byte a byte del externo en [P0_SOURCE_MANIFEST.md](P0_SOURCE_MANIFEST.md) |
| STF | docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/STEPS_TARGET_DESIGN_FREEZE_v0.1.md | v0.1, FROZEN_EXPERIENCE condicional: pendiente de integración/reconciliación con autoridad superior; mirror externo |
| P1 | docs/e2e/P1_RUNTIME_BASELINE.md | P1 PASS de baseline; AS_IS_EVIDENCE, no autoridad de producto |

**AUTHORITY — jerarquía.** Path: docs/STARTERIA_AUTHORITY.md, §2. Exact quote: “CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md”. Interpretation: el Core factual citado aquí es v0.2. Path: [P0_AUTHORITY_SNAPSHOT.md](P0_AUTHORITY_SNAPSHOT.md), Core section. Exact quote: “Core v0.3 = candidate”. Interpretation: no se usan reglas exclusivas de CORE3. Path: ADR5, metadata. Exact quote: “ACCEPTED — ADR DESIGN ONLY”. Interpretation: decisión de diseño aprobada, sin autorización productiva. Path: STF, estado. Exact quote: “pendiente de aprobación de integración en el repositorio y de reconciliación con las autoridades superiores.” Interpretation: su secuencia downstream necesita el checkpoint de P2 y compatibilidad con CORE.

## D-03 — Alineamiento y cobertura

**IS THIS ACTUALLY OPEN?** RESOLVED_BY_EXISTING_AUTHORITY para el principio; solo el cómputo detallado pertenece a P5.

**Decision ID:** D-03. **Decision question:** ¿Hay que aprobar ahora una nueva regla de alineamiento/cobertura? **Why this must be decided:** determina si Portfolio puede leer retos, iniciativas y gaps sin convertir una inferencia en alineamiento confirmado.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: INV-02; Exact quote: “Starteria no debe inferir silenciosamente el alineamiento estratégico.” What this establishes: una relación sugerida no equivale a vínculo confirmado. Path: CORE; Heading: §18; Exact quote: “Cobertura no prueba impacto de negocio.” What this establishes: cobertura e impacto son lecturas distintas.

**Frozen-experience evidence:** Path/source: PLF, “Se congela”; Exact quote: “retos o líneas de trabajo solo si ayudan”; What it requires visually/experientially: organización útil para Portfolio Lead; What it does NOT authorize: cambio de jerarquía o cardinalidad Core.

**AS-IS evidence:** P1 §§15–16, T02–T04/T08 BLOCKED; no medición runtime de cobertura.

**ALREADY DECIDED:** el alineamiento material requiere persona autorizada (CORE INV-02); cobertura no demuestra impacto. **ACTUALLY OPEN:** fórmula, umbrales y presentación de cobertura en P5. Un cambio de relación canónica exigiría ADR; no es necesario para congelar la experiencia actual.

**RECOMMENDED OPTION:** aplicar CORE v0.2. **WHY:** no añade autoridad ni cardinalidad. **EVIDENCE:** CORE INV-02/§18. **ASSUMPTIONS:** P5 no redefine la relación canónica. **RESIDUAL RISK:** estados/cálculo concretos aún no verificados.

HUMAN ACTION:
NO DECISION NEEDED — RESOLVED BY AUTHORITY

## B-01 — Límite post-Start y comando downstream

**IS THIS ACTUALLY OPEN?** DEFER_TO_P5. La elección visible de ruta se presenta aparte en POST-START-A/B/C.

**Decision ID:** B-01. **Decision question:** ¿Qué comando y estado persistido hacen única la confirmación downstream de una Initiative? **Why this must be decided:** P6 necesita creación única, retry seguro y trazabilidad desde Assignment; P2 solo necesita la frontera de experiencia.

**Higher-authority evidence:** Path: ADR5; Version/status: ACCEPTED — ADR DESIGN ONLY; Heading: §1; Exact quote: “Accept no crea Project/Initiative.” What this establishes: creación excluida en Accept. Path: ADR5, §1; Exact quote: “La futura formulación/materialización de una Initiative pertenece al workstream downstream.” What this establishes: el detalle de creación no queda aprobado por Handoff. Path: ACT, v0.2 FROZEN_EXPERIENCE, CHANGE-06; Exact quote: “No define la pantalla, Step, ruta ni comportamiento posterior.” What this establishes: Start termina ese contrato.

**Frozen-experience evidence:** Path/source: STF §3 Route A; Exact quote: “persona confirma creación”; What it requires: checkpoint humano en target downstream; What it does NOT authorize: nuevo comando/schema/identidad canónica. PLF muestra Assign/Accept/Start, sin especificar creación downstream.

**AS-IS evidence:** P1 §§9–11/T08 BLOCKED; el handler frontend inspeccionado actualiza preview, sin observación runtime de creación.

**ALREADY DECIDED:** Assignment, Accept y Start son operaciones distintas; Start no crea Initiative en el contexto Handoff; ADR5 conserva Project como identidad productiva actual de Initiative. **ACTUALLY OPEN:** comando downstream, actor exacto, key de idempotencia, estado de formulación y efecto persistido. P5 debe demostrar compatibilidad con Project; si propone otra identidad/cardinalidad, ADR previo.

### Option A

Usar el objeto/formulación compatible con Project existente y un comando de confirmación downstream único, diseñado en P5.

**Compatible with current Core:** YES. **Changes canonical domain:** NO, si se preserva Project/Initiative. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** POSSIBLY, si la inspección revela cambio canónico. **E2E consequence:** Start lleva a formulación y confirmación separada; retry no duplica. **Main advantage:** identidad y límite existentes. **Main risk:** idempotencia/estado no acreditados todavía.

### Option B

Mantener la formulación como contexto provisional sin confirmar Initiative hasta que P5 acredite un comando downstream compatible con Project.

**Compatible with current Core:** YES. **Changes canonical domain:** NO. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO si no cambia Core. **E2E consequence:** el usuario permanece en formulación hasta que exista confirmación segura; P6 se detiene si el comando no puede acreditarse. **Main advantage:** no crea identidad prematura. **Main risk:** demora la entrada al Core cuando la persistencia de confirmación no esté lista.

**RECOMMENDED OPTION:** A. **WHY:** respeta la identidad vigente y minimiza dominio nuevo. **EVIDENCE:** ADR5 §1. **ASSUMPTIONS:** P5 demuestra que el Project actual puede alojar la Initiative confirmada. **RESIDUAL RISK:** no hay runtime ni diseño de comando aprobado.

HUMAN ACTION:
DEFER — NOT REQUIRED TO FREEZE P2

## B-02 — Initiative existente y gating retroactivo

**IS THIS ACTUALLY OPEN?** RESOLVED_BY_EXISTING_AUTHORITY para identidad, historia y reconstrucción; la regla exacta de ciclo/Step se difiere a P5.

**Decision ID:** B-02. **Decision question:** ¿Puede P2 exigir continuidad de la misma Initiative y preservar trabajo previo? **Why this must be decided:** Route B debe evitar duplicación y aprobación retroactiva automática.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: INV-11; Exact quote: “conservar el contenido existente”; Exact quote: “evitar obligar al usuario a rehacer trabajo válido solo para satisfacer una secuencia estética.” What this establishes: reconstrucción retroactiva sin borrar trabajo. Path: CORE, INV-10; Exact quote: “No se sobrescribe silenciosamente la historia.” What this establishes: versiones/estado previo permanecen. Path: ADR5 §1; Exact quote: “no introduce una nueva identidad canónica de Initiative.” What this establishes: el handoff no reemplaza el ID.

**Frozen-experience evidence:** Path/source: STF §3 Route B; Exact quote: “No duplicar Initiative, no inventar porcentaje, no aprobar Steps retroactivamente.” What it requires: presentación honesta de trabajo conocido y gaps; What it does NOT authorize: selección automática de Step/ciclo ni aprobación histórica.

**AS-IS evidence:** P1 §§11–12/T09 BLOCKED; no observación DB antes/después.

**ALREADY DECIDED:** preservar el mismo ID, fuentes, evidencia e historia; reconstruir conocido/gaps; contenido equivalente no aprueba por sí solo un Step. **ACTUALLY OPEN:** cuál ciclo/Step efectivo es legítimo, quién valida equivalencia y cómo se registra. P5 decide bajo gating vigente; ADR solo si se cambia ese gating.

**RECOMMENDED OPTION:** aplicar CORE INV-10/11. **WHY:** protege identidad y trabajo válido. **EVIDENCE:** CORE INV-10/11 y ADR5. **ASSUMPTIONS:** P5 distingue contenido documentado de estado aprobado. **RESIDUAL RISK:** ciclo/Step aún sin regla operativa.

HUMAN ACTION:
NO DECISION NEEDED — RESOLVED BY AUTHORITY

## B-03 — Confirmación de contribución y mandato

**IS THIS ACTUALLY OPEN?** DEFER_TO_P5 para la matriz de tipos de decisión y actores.

**Decision ID:** B-03. **Decision question:** ¿Qué actor autorizado confirma cada cambio material de contribución/alineamiento/mandato? **Why this must be decided:** evita que una sugerencia de IA o una sesión autenticada se convierta en autorización estratégica.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: INV-02; Exact quote: “Un Portfolio Lead o una persona autorizada confirma el alineamiento estratégico cuando sea materialmente relevante.” What this establishes: confirmación humana y alcance estratégico. Path: CORE §5.1; Exact quote: “La autoridad debe asociarse a un tipo de decisión, no suponerse únicamente por acceso al sistema.” What this establishes: matriz por decisión, no permiso universal.

**Frozen-experience evidence:** Path/source: PLF, experiencia de análisis; Exact quote: “confirmar, posponer, dejar sin vínculo, comparar duplicidades.” What it requires: acciones visibles de revisión; What it does NOT authorize: otorgar al PL todas las decisiones de inversión/Step.

**AS-IS evidence:** P1 T03/T21–T23 BLOCKED; no autorización runtime acreditada.

**ALREADY DECIDED:** IA no confirma; alineamiento material es humano; el tipo de decisión determina autoridad. **ACTUALLY OPEN:** lista de decisiones, rol permitido y efecto exacto. P5 debe expresar matriz y P9/P10 probarla.

### Option A

Definir en P5 autoridad por tipo de decisión, permitiendo Portfolio Lead solo donde el tipo lo autorice.

**Compatible with current Core:** YES. **Changes canonical domain:** NO. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO, si refleja roles existentes. **E2E consequence:** cada confirmación material tiene actor y evidencia. **Main advantage:** preserva límites. **Main risk:** requiere inventario exhaustivo de decisiones.

### Option B

Asignar ciertas confirmaciones a Sponsor/Challenge Owner cuando ese actor tenga autoridad explícita para el tipo de decisión; el Portfolio Lead mantiene las suyas.

**Compatible with current Core:** YES si la autorización por tipo queda explícita. **Changes canonical domain:** NO. **Changes human authority:** NO dentro de autoridad vigente. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO si refleja autorización existente. **E2E consequence:** algunos checkpoints se enrutan a Sponsor/Challenge Owner. **Main advantage:** acerca la decisión al responsable contextual. **Main risk:** asignaciones ambiguas si P5 no distingue patrocinio y ownership.

**RECOMMENDED OPTION:** A. **WHY:** sigue CORE INV-02/§5.1 sin ampliar autoridad. **EVIDENCE:** citas anteriores. **ASSUMPTIONS:** los actores permitidos se verificarán en P5. **RESIDUAL RISK:** la matriz concreta no existe aún.

HUMAN ACTION:
DEFER — NOT REQUIRED TO FREEZE P2

## D-08 — Impacto esperado, observado y atribuido

**IS THIS ACTUALLY OPEN?** RESOLVED_BY_EXISTING_AUTHORITY para la distinción de madurez y Benefit Tracking. La política de visualización/cálculo ROI es P5/P10.

**Decision ID:** D-08. **Decision question:** ¿P2 debe aprobar de nuevo la separación expected/observed/attributed? **Why this must be decided:** Step 4 y Portfolio Return no deben mostrar estimaciones como valor realizado.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: INV-12; Exact quote: “Para promover un claim a **L5 REALIZED**, Starteria debe contar con un resultado observado en operación y una fuente trazable.” Exact quote: “Para promoverlo a **L6 ATTRIBUTED**, además debe existir un método de atribución defendible y el validador requerido.” What this establishes: observado y atribuido tienen umbrales diferentes; el valor esperado pertenece a niveles previos del modelo L0–L6. Path: CORE INV-12; Exact quote: “Step 4 puede cerrar el **ciclo de desarrollo** antes de que el valor de negocio a largo plazo sea completamente observable.” What this establishes: seguimiento posterior a la decisión.

**Frozen-experience evidence:** Path/source: PLF Home/Portfolio, indicadores y evolución; frozen behavior: lectura ejecutiva de KPI y señales; What it requires: representar señales con su madurez; What it does NOT authorize: inventar ROI o rebajar L5/L6.

**AS-IS evidence:** P1 T20–T21 BLOCKED; ningún cálculo runtime de impacto verificado.

**ALREADY DECIDED:** expected, observed y attributed no son intercambiables; L5 necesita observación+fuente; L6 método+validador; Benefit Tracking puede seguir después de Step 4. **ACTUALLY OPEN:** etiquetas, fórmula y condiciones de mostrar ROI; P5/P10. Cambiar umbrales Core exige ADR.

**RECOMMENDED OPTION:** aplicar L0–L6 vigente y diferir cálculo ROI. **WHY:** evita atribución ficticia. **EVIDENCE:** CORE INV-12. **ASSUMPTIONS:** ninguna cifra se promoverá por visualización. **RESIDUAL RISK:** método de cálculo pendiente.

HUMAN ACTION:
NO DECISION NEEDED — RESOLVED BY AUTHORITY

## D-09 — Versionado y revisión dirigida

**IS THIS ACTUALLY OPEN?** RESOLVED_BY_EXISTING_AUTHORITY para preservar historia y revisar solo impactos materiales; detalle semántico P3 y técnico P5.

**Decision ID:** D-09. **Decision question:** ¿P2 necesita otra decisión para conservar snapshots y activar revisión dirigida? **Why this must be decided:** cambios de mandato/evidencia no deben reescribir retrospectivamente Steps.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: INV-10; Exact quote: “se conserva el estado anterior”; Exact quote: “los outputs dependientes se marcan como `requires_review` cuando corresponda.” What this establishes: versión previa, origen y marca de revisión. Path: CORE §19.1; Exact quote: “conservar el snapshot utilizado”; Exact quote: “evitar reinterpretar retroactivamente lo sucedido con información que todavía no existía.” What this establishes: historia del ciclo. Path: CORE §30; Exact quote: “revalidar únicamente lo materialmente afectado.” What this establishes: no invalidación ciega.

**Frozen-experience evidence:** Path/source: STF §9; frozen behavior: snapshots y revisión dirigida; What it requires: experiencia que muestra cambio/revisión; What it does NOT authorize: nuevas reglas de gating ni algoritmo de dependencias.

**AS-IS evidence:** P1 T22 BLOCKED; no evento upstream/review observado.

**ALREADY DECIDED:** versionado, fuente/razón, snapshots y revisión material dirigida. **ACTUALLY OPEN:** tipado semántico de cambio en P3, dependencias y ownership técnico en P5. Si cambia el gating Core, ADR.

**RECOMMENDED OPTION:** aplicar CORE INV-10/§19.1/§30. **WHY:** conserva causalidad sin rehacer trabajo válido. **EVIDENCE:** citas anteriores. **ASSUMPTIONS:** P3/P5 tratarán solo los detalles. **RESIDUAL RISK:** umbral concreto de materialidad pendiente.

HUMAN ACTION:
NO DECISION NEEDED — RESOLVED BY AUTHORITY

## POST-START-A/B/C — Elección de experiencia downstream

**IS THIS ACTUALLY OPEN?** HUMAN_PRODUCT_DECISION. Es la única elección de experiencia de este pack que bloquea congelar P2: ACT acaba en Start y STF ofrece un target condicional que aún necesita aceptación compatible con Core.

**Decision ID:** POST-START-A/B/C. **Decision question:** ¿Se aprueba para el contrato P2 la experiencia acotada de las tres rutas A/B/C, dejando comandos, validadores y ciclo/Step a sus autoridades/fases? **Why this must be decided:** sin ruta downstream aceptada no hay recorrido unificado desde Handoff hasta Initiative Core.

**Higher-authority evidence:** Path: ACT; Version/status: v0.2 FROZEN_EXPERIENCE; Heading: CHANGE-06; Exact quote: “Este contrato termina al registrarse exitosamente `Start`. No define la pantalla, Step, ruta ni comportamiento posterior.” What this establishes: la experiencia después de Start requiere su propia aprobación. Path: ADR5; Version/status: ACCEPTED — ADR DESIGN ONLY; Heading: §1; Exact quote: “`Project` se mantiene como la identidad productiva actual de Initiative mientras no exista otro ADR que cambie esa decisión.” What this establishes: no segunda identidad canónica. Path: CORE INV-11; Exact quote: “conservar el contenido existente.” Path: CORE INV-02; Exact quote: “Las iniciativas independientes o públicas pueden existir sin un Frente Estratégico o Reto corporativo.” What these establish: continuidad de B y ausencia de jerarquía ficticia en C.

**Frozen-experience evidence:** Path/source: STF §3, target A/B/C; Exact quote Route A: “Invitación → aceptar → overview → Start → Copilot ayuda a formular una iniciativa candidata; revisión del mandato → persona confirma creación → Step 0 para delimitar el trabajo inicial.” Exact quote Route B: “No duplicar Initiative, no inventar porcentaje, no aprobar Steps retroactivamente.” Exact quote Route C: “Crear iniciativa → Copilot ayuda a explorar y ordenar → usuario revisa lo entendido → confirma iniciativa → Step 0.” What it requires: trayectorias de experiencia y checkpoint visibles. What it does NOT authorize: un nuevo comando, crear Initiative al hacer Start, aprobar automáticamente un Step, imponer Front/Challenge a C, ni cambiar Core. STF declara integración/reconciliación pendiente.

**AS-IS evidence:** P1 §§9–12, T08–T10 BLOCKED; hay rutas/código, pero ninguna ruta A/B/C se acreditó en runtime.

**ALREADY DECIDED:**

| Ruta | Antes / después de Start ya gobernado | Identidad, historia y autoridad ya gobernadas |
|---|---|---|
| A — Assignment/Challenge sin Initiative | Challenge + HandoffAssignment pueden existir, aceptarse e iniciarse sin Initiative (ACT HC-PR-04); Start cierra Handoff (ACT CHANGE-06/ADR5) | Accept no crea Initiative; IA no confirma organización (CORE INV-03); Project sigue identidad productiva (ADR5) |
| B — Existing Initiative | Handoff de Initiative existente conserva referencia, no crea copia (ADR5); Start no selecciona Step por sí mismo | CORE INV-10/11 preservan historia/evidencia y reconstruyen gaps; contenido no equivale a aprobación retroactiva |
| C — Independent Initiative | CORE INV-02 permite Initiative independiente sin Front/Challenge corporativo | IA no decide ni confirma; usa el mismo Adaptive Core compatible con su contexto (CORE §7) |

**ACTUALLY OPEN:** aceptar como experiencia P2 que (A) después de Start se formule una candidata, una persona revise/confirme, nazca una única Initiative y Overview conduzca al Core; (B) la Initiative existente pase por Overview de continuidad con gaps y revisión antes de escoger ciclo/Step válido; (C) la entrada independiente tenga formulación/revisión/confirmación antes de Core. El actor exacto, comando, persistencia, correlación, idempotencia y regla efectiva de ciclo/Step **no** se aprueban aquí. El Overview previo a Start de ADR5/ACT y el Overview/continuidad posterior propuesto por STF deben distinguirse; no se convierte Overview en un Step ni se altera el Handoff freeze.

### Option A

Aprobar las tres rutas del contrato candidato como experiencia E2E **acotada**: A formula/confirma downstream antes de crear una única Initiative; B reutiliza ID, historia y evidencia y muestra gaps sin aprobar Steps automáticamente; C formula/confirma sin jerarquía corporativa ficticia. Overview conecta cada ruta al Core. Toda operación canónica/Step queda condicionada a CORE, ADR y P5.

**Compatible with current Core:** YES, con las condiciones indicadas. **Changes canonical domain:** NO en el alcance P2; cualquier cambio posterior se detiene. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO para congelar experiencia compatible; POSSIBLY en P5/P6 si se altera identidad, cardinalidad o gating. **E2E consequence:** existe un spine revisable para A/B/C sin afirmar que funcione hoy. **Main advantage:** identidad estable y recorrido completo sin saltar Start ni confirmación. **Main risk:** detalles downstream todavía no autorizados ni verificados.

### Option B

No congelar todavía la continuidad downstream: mantener solo el límite Handoff aprobado y pedir revisión específica del target STF/Overview antes de adoptar A/B/C.

**Compatible with current Core:** YES. **Changes canonical domain:** NO. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO por sí mismo. **E2E consequence:** el contrato P2 permanece candidato, pues el journey unificado queda incompleto. **Main advantage:** permite rediseñar la experiencia downstream si se detecta incompatibilidad material. **Main risk:** retrasa el freeze y P3; la revisión debe identificar qué parte concreta se objeta.

**RECOMMENDED OPTION:** A. **WHY:** usa el target Steps con checkpoint humano, conserva Start como frontera y evita identidad/jerarquía inventadas. **EVIDENCE:** ACT CHANGE-06/HC-PR-04; ADR5 §1; CORE INV-02/03/10/11; STF §3 bajo su clasificación condicional. **ASSUMPTIONS:** el humano aprueba la experiencia con las restricciones explícitas; P5 no promueve un comando ni un Step sin autoridad. **RESIDUAL RISK:** detalles de creación, ciclo/Step y runtime permanecen pendientes; un hallazgo de incompatibilidad en P5 requiere ADR o revisión dirigida del contrato.

HUMAN ACTION:
APPROVE OPTION A

## CARDINALITY/COVERAGE — Relaciones permitidas por Core

**IS THIS ACTUALLY OPEN?** RESOLVED_BY_EXISTING_AUTHORITY para los casos necesarios en P2; cualquier nueva cardinalidad requiere ADR, no elección simple de experiencia.

**Decision ID:** CARDINALITY/COVERAGE. **Decision question:** ¿Debe P2 crear una excepción de relación corporativa para admitir A/B/C? **Why this must be decided:** un mockup de agrupación no puede redefinir el modelo.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: INV-02; Exact quote: “Una iniciativa dentro de un portafolio corporativo puede estar temporalmente”; el listado incluye “pendiente de alineamiento” y “no alineada”. Exact quote: “Las iniciativas independientes o públicas pueden existir sin un Frente Estratégico o Reto corporativo.” What this establishes: C es permitido; alineamiento corporativo no se infiere. Path: ACT, HC-PR-04; Exact quote: “Un Challenge Assignment puede existir, aceptarse e iniciarse como handoff sin que exista todavía una Initiative.” What this establishes: A no exige Initiative antes de Start. Path: CORE §26.1; exact heading: “Iniciativa corporativa independiente / aún no alineada”. What this establishes: no se debe afirmar que toda Initiative corporativa ya está ligada a Challenge confirmado.

**Frozen-experience evidence:** Path/source: PLF; Exact quote: “retos o líneas de trabajo solo si ayudan.” What it requires: agrupación visual contextual. What it does NOT authorize: cardinalidad nueva. STF Route C representa entrada independiente; no concede excepción corporativa.

**AS-IS evidence:** P1 T02/T04/T08/T10 BLOCKED; no estado de DB observado para esos casos.

**ALREADY DECIDED:** Challenge Assignment sin Initiative es válido; Initiative independiente sin Front/Challenge es válida; iniciativa corporativa puede estar pendiente/no alineada; cobertura no demuestra impacto. **ACTUALLY OPEN:** cardinalidades/constraints físicos exactos y cálculo de cobertura en P5. No se necesita excepción nueva para las rutas P2 descritas; una propuesta que cambie el invariante requiere ADR.

**RECOMMENDED OPTION:** conservar los casos Core existentes. **WHY:** evita inferir una relación por diseño visual. **EVIDENCE:** CORE INV-02/§26.1; ACT HC-PR-04. **ASSUMPTIONS:** P5 no declarará nuevas cardinalidades desde PLF. **RESIDUAL RISK:** constraints físicos pueden no reflejar todavía estos casos.

HUMAN ACTION:
NO DECISION NEEDED — RESOLVED BY AUTHORITY

## DECISION-AUTHORITY — Decisor y efecto en Portfolio

**IS THIS ACTUALLY OPEN?** DEFER_TO_P5 para matriz de actor/decisión y cambio de estado; el principio humano ya está resuelto.

**Decision ID:** DECISION-AUTHORITY. **Decision question:** ¿Qué actor puede registrar cada tipo de decisión material y qué lectura de Portfolio cambia? **Why this must be decided:** Step 4 entrega recomendación, no resolución organizacional.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: §21 Step 4; Exact quote: “El output de Step 4 no es por sí mismo la decisión organizacional.” What this establishes: paquete y decisión separados. Path: CORE §5.1; Exact quote: “La autoridad debe asociarse a un tipo de decisión, no suponerse únicamente por acceso al sistema.” What this establishes: no decisor universal inferido por rol de pantalla. Path: CORE INV-03; Exact quote: “La IA no decide autónomamente”. What this establishes: IA recomienda, no aprueba.

**Frozen-experience evidence:** Path/source: PLF, Centro de decisiones; frozen behavior: decisión humana explícita y vista de Portfolio. What it requires: revisión/acción visible del humano autorizado. What it does NOT authorize: que Portfolio Lead decida todos los casos o escriba StepState.

**AS-IS evidence:** P1 T19–T21/T23 BLOCKED; no retorno de decisión observado en runtime.

**ALREADY DECIDED:** la decisión es humana, tipada y separada de Step 4/IA; Portfolio recibe señales sin reescribir historia. **ACTUALLY OPEN:** actor permitido por tipo, efecto persistido, permission matrix y proyección causal en P5/P10. Si se transfiere autoridad humana/IA, ADR.

### Option A

Definir en P5 una matriz por tipo de decisión bajo roles existentes; Portfolio muestra solicitud, actor, decisión y efecto autorizado.

**Compatible with current Core:** YES. **Changes canonical domain:** NO para el principio; detalle por evaluar. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO si refleja CORE. **E2E consequence:** decisión causal y autorizada; StepState sigue con Owner. **Main advantage:** trazabilidad sin autoridad ficticia. **Main risk:** cobertura incompleta si algún tipo no se inventaría.

### Option B

Dar al Portfolio Lead solo las decisiones estratégicas que le correspondan y enrutar las demás a Sponsor/actor autorizado según tipo; Portfolio observa el efecto sin escribir StepState.

**Compatible with current Core:** YES si la matriz respeta autoridad existente. **Changes canonical domain:** NO. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO si no amplía autoridad. **E2E consequence:** Portfolio puede mostrar decisiones pendientes de otro actor y su resultado. **Main advantage:** evita atribuir al PL la decisión ajena. **Main risk:** necesita routing y visibilidad de estados pendientes más precisos.

**RECOMMENDED OPTION:** A. **WHY:** conserva la autoridad humana por tipo y el límite de StepState. **EVIDENCE:** CORE §5.1/§21/INV-03; ACT HC-PR-05. **ASSUMPTIONS:** P5 identifica tipos de decisión y actor válido. **RESIDUAL RISK:** efecto exacto de cada decisión todavía sin definir.

HUMAN ACTION:
DEFER — NOT REQUIRED TO FREEZE P2

## SUPPORT-REQUEST — Bloqueo y apoyo sin entidad presupuesta

**IS THIS ACTUALLY OPEN?** DEFER_TO_P5 para mecanismo/entidad; el comportamiento de experiencia puede congelarse ya.

**Decision ID:** SUPPORT-REQUEST. **Decision question:** ¿Qué mecanismo existente o nuevo debe portar una solicitud de apoyo gobernada hacia Portfolio? **Why this must be decided:** el Owner debe señalar dependencia y recibir respuesta sin que Portfolio mute StepState.

**Higher-authority evidence:** Path: CORE; Version/status: v0.2 factual/current; Heading: §21 Step 2; Exact quote: “identificar qué puede hacer el equipo y qué requiere IT, Data, Seguridad, proveedor u otra capacidad externa”. What this establishes: distinguir capacidad propia y dependencia externa. Path: ACT; Version/status: v0.2 FROZEN_EXPERIENCE; Heading: HC-PR-05; Exact quote: “Portfolio consume estado/eventos posteriores. No controla DOM, rutas, componentes o StepState interno.” What this establishes: señal hacia Portfolio, sin control directo de Step.

**Frozen-experience evidence:** Path/source: STF §5.1/ST-07, target condicional; frozen behavior: pedido contextual de ayuda/bloqueo visible; What it requires: Owner puede pedir apoyo, Portfolio observa/responde según autoridad. What it does NOT authorize: entidad canónica llamada SupportRequest ni lifecycle/schema nuevos.

**AS-IS evidence:** P1 T17 BLOCKED. **CODE, no runtime:** front/src/features/adaptive-core/components/CopilotIntentModes.tsx:24–27 envía POST /projects/:id/help; backend/modules/mentor/mentor.service.ts:93–108 crea HelpRequest PENDING; front/prisma/schema.prisma:1449–1467 define HelpRequest. backend/modules/truth/truth.service.ts:295–328 crea/resuelve AttentionItem; front/prisma/schema.prisma:1310–1333 lo define; backend/modules/portfolio/portfolio-home.read-service.ts:379–400 lee attentionItems como blockers. backend/modules/portfolio-handoff/domain/portfolio-handoff-semantic-event.types.ts:8–9 enumera support_requested. Esto prueba superficies de código, **no** un circuito Owner→Portfolio de solicitud/respuesta certificado, ni seguridad/idempotencia.

**ALREADY DECIDED:** Owner conserva StepState; puede distinguir dependencia externa; Portfolio consume una señal y actúa solo dentro de su autoridad. **ACTUALLY OPEN:** si HelpRequest, AttentionItem o una composición soportan lifecycle, permisos, correlación, persistencia y respuesta gobernada. Eso se audita en P5; crear SupportRequest canónico no es decisión P2.

### Option A

Reutilizar/adaptar HelpRequest, AttentionItem o ambos **solo si** P5 demuestra semántica, ownership y permisos compatibles.

**Compatible with current Core:** YES, condicionado a auditoría. **Changes canonical domain:** NO si se reutiliza sin redefinir; UNCLEAR si se altera lifecycle. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** POSSIBLY si se cambia dominio/autoridad material. **E2E consequence:** señal gobernada desde Initiative al Portfolio con identidad existente. **Main advantage:** menos duplicación. **Main risk:** HelpRequest hoy parece orientado a mentor y AttentionItem a bloqueo; puede faltar gestión de respuesta Portfolio.

### Option B

Introducir un objeto ligero de señal/solicitud subordinado a Initiative tras probar que los existentes no bastan.

**Compatible with current Core:** UNCLEAR hasta P5. **Changes canonical domain:** YES. **Changes human authority:** NO si se preservan roles. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** POSSIBLY según materialidad del cambio. **E2E consequence:** lifecycle propio de apoyo. **Main advantage:** semántica explícita. **Main risk:** duplicar HelpRequest/AttentionItem y sus fuentes.

### Option C

Representar al inicio la necesidad con AttentionItem/señal existente, sin entidad nueva, y dejar respuesta como mecanismo ya autorizado.

**Compatible with current Core:** YES para señal; respuesta UNCLEAR. **Changes canonical domain:** NO. **Changes human authority:** NO. **Changes AI authority:** NO. **Changes Step function/gating:** NO. **Requires ADR:** NO si no se amplía autoridad. **E2E consequence:** Portfolio ve atención, pero el ciclo solicitud→respuesta puede quedar incompleto. **Main advantage:** mínimo modelo nuevo. **Main risk:** P9 no podría pasar si no hay seguimiento de solicitud/resolución verificable.

**RECOMMENDED OPTION:** A, condicionada a la auditoría P5; C solo si permite cerrar el comportamiento completo. **WHY:** hay superficies de código existentes que merecen revisión antes de crear un objeto canónico. **EVIDENCE:** rutas, servicios y schema citados; CORE Step 2; ACT HC-PR-05. **ASSUMPTIONS:** no se declara reutilización acreditada hasta probar lifecycle/seguridad. **RESIDUAL RISK:** puede requerirse B y quizá ADR si los mecanismos actuales no sirven.

HUMAN ACTION:
DEFER — NOT REQUIRED TO FREEZE P2

# Human Decisions Required to Freeze P2

## MUST DECIDE NOW

Ninguna pendiente para el freeze P2. **POST-START-A/B/C Option A** y el contrato P2 v0.1 fueron aprobados explícitamente en §Final disposition. Esta aprobación no incluye comando/schema/actor universal/ciclo/Step ni un resultado runtime.

## ADR REQUIRED

Ningún ADR nuevo es requisito para congelar **Option A dentro del Core factual**. Antes de implementar una propuesta que cambie identidad Project/Initiative, cardinalidad corporativa, autoridad humana/IA, funciones/gates de Steps, umbrales L5/L6 o preservación/revisión Core, detener la parte afectada y tramitar ADR. Ninguna opción de este pack aprueba esos cambios por simple freeze de experiencia.

## DEFER TO P3

- D-09: tipado semántico de cambio, materialidad y propuesta de revisión dirigida.
- Copilot/Card, recuperación de contexto, suficiencia e inferencias del contrato candidato: no se deciden en este pack.

## DEFER TO P5

- D-03 y CARDINALITY/COVERAGE: fórmula/read model/constraints de cobertura sin cambiar Core.
- B-01: comando, actor, estado, idempotencia y correlación downstream tras Start.
- B-02: regla de continuidad de ciclo/Step y validación retroactiva compatible con Core.
- B-03 y DECISION-AUTHORITY: matriz por tipo de decisión, permisos y efecto autorizado.
- D-08: etiquetas, política de cálculo ROI y soporte técnico de Benefit Tracking.
- D-09: dependencias, snapshots y persistencia de revisión dirigida.
- SUPPORT-REQUEST: auditar HelpRequest/AttentionItem/eventos y decidir mecanismo, schema, API y respuesta gobernada. Ninguna entidad nueva queda aprobada aquí.

## ALREADY RESOLVED

- CORE v0.2 INV-02/§18: alineamiento material humano; cobertura distinta de impacto; Initiative independiente sin jerarquía ficticia.
- ACT HC-PR-04 y ADR5 §1: Challenge Assignment puede empezar sin Initiative; Accept no crea Initiative; Start cierra Handoff; Project sigue identidad productiva actual.
- CORE INV-10/11: conservar historia e Initiative existente, reconstruir gaps y evitar rehacer trabajo válido; ningún Step se aprueba por simple contenido equivalente.
- CORE INV-12/L0–L6: esperado, observado y atribuido tienen madurez distinta; Benefit Tracking puede continuar tras Step 4.
- CORE INV-10/§19.1/§30: snapshots e historia se conservan, y solo se revisa lo materialmente afectado.
- CORE INV-03/§5.1/§21 Step 4: IA recomienda; una persona autorizada decide según el tipo de decisión; Step 4 no decide por sí mismo.

**Checkpoint cerrado:** la respuesta humana explícita consta en §Final disposition. El contrato v0.1 está FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING y P2 = PASS tras verificación documental. P3 sigue NOT_STARTED/NOT_AUTHORIZED y P1 T01–T25 siguen BLOCKED. Este pack no altera Core/ADRs ni autoriza implementación.
