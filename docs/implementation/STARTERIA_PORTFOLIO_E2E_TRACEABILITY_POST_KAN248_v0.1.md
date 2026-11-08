# Startería — Trazabilidad real E1–E7 y continuidad
**Fecha:** 2026-11-08  
**Baseline integrada:** `main@2ab78569d5559f19cd1bbb1e861efe0cc532c890`  
**Slice en curso:** KAN-247 `feat/KAN-247-e1-context-projection` (aún NO mergeada)  
**Estado:** DELTA / EVIDENCE-BASED, no equivale a certificación productiva.

## 1. Jerarquía y límites
Autoridad factual: `docs/STARTERIA_AUTHORITY.md`, Core `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, ADRs de producto aceptados, Manifest V2. Core v0.3 sigue candidato. La IA propone, `PortfolioBootstrapContextReview` persiste revisión humana, ninguna propuesta E1 confirma por sí sola negocio ni habilita E2.

## 2. Matriz implementación real vs certificación

| Tramo / Job | Integrado en main, respaldado | Evidencia verificable | Lo que NO se ha certificado | Estado |
|---|---|---|---|---|
| Entrada pública → Portfolio Setup | Entry y continuidad 114F; sesiones y contexto provisional | KAN-141/142 y CI recientes | La variante completa de onboarding de cada perfil en producción | Implementado por slices |
| **E1 — contexto** | ContextReview con draft/CAS/reentrada (KAN-221), UX fallback KAN-241, ledger KAN-244 (#266), orquestador KAN-245 (#267), conversación KAN-246 (#268), idempotencia KAN-248 (#271) | Tests PostgreSQL KAN-221/244; KAN-246 deterministic E2E; CI main #42511467700 | Sin rollout live; fallback repregunta en KAN-240 A1; ledger no proyecta íntegramente a ContextReview | Implementado, gap UX |
| **E1 — proyección grounded** | KAN-247 branch: propuesta de piloto no probado + sourceRef versionado, GET owner-scoped, aceptación humana como draft; ninguna escritura automática | Nuevos unit, integración y E2E en PR pendiente | CI/independent review, negativos multi-sujeto, mapping general de área/stakeholder/constraints, rechazo duradero | En implementación / NO CERTIFICADO |
| **E2 — objetivo** | Anchor/objetivo, confirmación y navegación G1 (KAN-207/241) | KAN-240 cafetería recorre UI E2 con señal desconocida explícita | Calidad semántica para cuatro sectores y cambios de contexto posteriores | Parcialmente validado |
| **E3 — incorporar trabajo** | Manual/paste/import/no-work y persistencia B3 (KAN-212 y dependencias) | KAN-240 C distribuidora: un MVP y logs en E3 | Cobertura de UX de todos los formatos y casos B/D | Validado en casos acotados |
| **E4 — análisis y revisión** | AnalysisRun/WorkItem, revisión material y bloqueos G2B (KAN-213) | KAN-240 C llega B4; cero Project/Step ficticios | Validación general de alineamiento, duplicidades, calidad de recomendaciones y navegación completa | Parcial |
| **E5 — Organización** | Propuesta selectiva, frentes/retos y materialización gobernada (KAN-223 y antecedentes) | KAN-240 A por API autenticada sobre misma sesión | Happy path UX completo por pantalla; corporación con múltiples unidades | API validada / UI no certificada E2E |
| **E6 — Briefs** | ChallengeActivationBriefVersion draft/confirm (ADR-008, KAN-223/159) | KAN-240 A confirma Brief vía API real | Variantes y edición/versionado por pantalla con cuatro escenarios | API validada / UX por certificar |
| **E7 — Equipo / Lab** | Handoff Team (PL-06), solicitud/contacto Lab (KAN-226/227), outcome de setup (KAN-230/231) | KAN-240 A prepara Lab-notified con receipt SMTP simulado y Home | Asignación owner UI E2E en este caso; SMTP/lectura/reunión reales; delivery Fab | Implementado por slices, certificación parcial |
| **Portfolio Overview** | G5 Home read model y acciones factual (KAN-232) | KAN-240 A Home visible, Brief confirmado, contacto pendiente | Atención de bloqueos reales, respuesta/escalado, refresh extenso, indicadores de impacto | Lectura parcial validada |
| **Owner → Steps 0–4** | Adaptive Core existente y pruebas por slice | Tests previos del Core (no sustituir por QA de Portfolio) | Flujo integral desde E7 hasta Step 4 en cuatro escenarios | E2E integral NO certificado |
| **Step 4 → Decision Package → beneficio** | Lógica/artefactos previos, no equivalentes a ciclo integral certificado | No hay prueba final aportada de vuelta a Portfolio con L5/L6 atribuible | Decisión humana, beneficios realizados/atribuidos, actualización Home y learning loop | Pendiente de certificación de producto |

**Nota:** tests de KAN-240 (PR #270) son híbridos: E1–E4 vía UI; E5–E7 mediante APIs autenticadas. La auditoría conserva falla A1 en flag OFF como aserción diagnóstica. Los nuevos tests KAN-247 proponen reemplazarla por 0 repreguntas, aún no aprobados por CI.

## 3. Casos E2E v0.4 y brechas

| Escenario | Evidencia actual | Aceptación futura |
|---|---|---|
| A — Cafetería microempresa, sin iniciativas previas | Negación del piloto REPREGUNTADA en baseline; continuidad híbrida E1–E7 y Home con workaround | KAN-247: 0 repreguntas, cita exacta, aceptación humana, E1–E7 UI puro |
| B — Pequeña empresa de otra industria | KAN-246 fixtures parciales; sin QA E1–E7 integral documentado | E1–E7 sin organigramas asumidos; asignación/retorno |
| C — Distribuidora con MVP y logs/WhatsApp | KAN-240 PASS E3→E4, WorkItem/AnalysisRun conservados, sin Project/Step falso | Importación retroactiva, asignación, ejecución/impacto y decisión |
| D — Corporación con estructura formal y varias iniciativas | Casos de B2/UX y suites previas; no E1–E7 integral documentado | E1–E7, equipo/permisos, solapamientos y Portfolio Overview |

## 4. Tres vías de desarrollo (no confundir capacidad disponible y target)
- **Steps**: desarrollo y experimentación por equipo/owner, como iniciativa con checkpoints y evidencia. Componentes Core/PL-06 existen; handoff→Step4 completo aún por certificar.
- **Startería Fab como iniciativa**: alternativa de construcción/implementación técnica sin requerir equipo desarrollador del cliente. **No está implementado como delivery autónomo**. Solicitar Lab/contacto NO equivale a asignar o ejecutar Fab.
- **Steps + Fab en Step 2**: equipo desarrolla el ciclo por Steps y encarga a Fab construcción de entregable en Step 2. **Target futuro; integración y trazabilidad pendientes**.

Lab actual distingue REQUESTED / NOTIFIED / contacto pendiente de reunión, aceptación y ejecución. No declarar Lab/Fab productivo por un correo SMTP.

## 5. Secuencia de entrega
1. **KAN-247** — Proyección E1 con evidencia, aceptación humana versionada, cero repreguntas, flags OFF/ON-determinista, protección tenant, CAS, CI, revisión independiente, PR.
2. **QA UX E2–E7 puramente UI** — Cafetería y distribuidora primero, luego B y D. Sustituir APIs de diagnóstico por acciones de interfaz.
3. **E7→Owner/Steps y seguimiento de solicitudes** — asignación, aceptación, inicio sin Project/Step ficticios, tabla Home con owner/status/bloqueos/alertas/historial.
4. **Step 4→Decision/Benefit Tracking→Portfolio** — versionar Brief de resultados, fuente/decisión/observado vs atribuido, reentrada y actualización de métrica de negocio.
5. **Fab** — contrato independiente de oferta/ejecución/entregables, coste/tiempo/evidencia y integración con iniciativas, sin convertir solicitud Lab en delivery.

## 6. Evidencia y criterios de cierre
- Cada CA debe apuntar a código, prueba (unit + PostgreSQL + Playwright), commit, CI y revisión, con baseline exacta.
- `SEMANTIC_E1_ENABLED=false` por defecto; solo adapter determinista en test, sin gastos IA live, nuevas claves, infraestructura ni SMTP externo.
- No merge/deploy automático. `V2_CHANGE_CLOSURE_CHECK` solo después de pruebas y review, no por render de pantalla.
- Solo marcado `IMPLEMENTED_VERIFIED` cuando existe prueba efectivamente ejecutada para ese alcance; no extrapolar CI general a UI E1–E7 integral.
