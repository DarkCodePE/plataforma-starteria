# KAN-240 — Auditoría delta E1→E7

Fecha de ejecución: 2026-11-08  
Baseline: `main@22ba66d8b2fad600997911492f3c3acb3de4ff3d`  
Test delta: `front/e2e/kan240-e1-e7-delta.spec.ts`  
Commit del test: `61cfd94e1a239368dc92152879963bd068e69fce`

## Resultado

La auditoría produce un recorrido verificable de una misma sesión desde E1 hasta E7 y Portfolio Overview, pero no certifica todavía un happy path de usuario completamente limpio.

- Cafetería: E1 vuelve a preguntar por un piloto que ya fue negado explícitamente. Es un defecto funcional reproducido primero con una aserción RED y conservado después mediante una aserción diagnóstica exacta de una aparición.
- Cafetería con workaround explícito: la misma sesión llega a E7 y Home; E1–E4 se ejecutan por UI y E5–E7 por APIs gobernadas ya existentes.
- Distribuidora: un MVP con uso/logs llega a E4 sin crear ni autoaprobar `Project` o `Step`.
- El entorno usa PostgreSQL 16 desechable con 78 migraciones. Antes de cualquier request, el spec exige `SEMANTIC_E1_ENABLED=false`, `PORTFOLIO_ENTRY_RUNTIME_MODE=deterministic` y `SMTP_HOST` vacío; falla cerrado si el runner hereda una configuración live.
- No hubo inferencia live, proveedor de pago, secretos nuevos, infraestructura, merge ni deploy.

## Matriz de trazabilidad

| Criterio | Superficie | Test | Commits relevantes | Evidencia ejecutada |
|---|---|---|---|---|
| A1. Una negación explícita de piloto no debe generar la misma pregunta | `PortfolioBootstrapContextConversation.tsx`; contrato de proyección E1 pendiente | `A · cafetería (defecto confirmado)...` | `8e01f6f` (fallback persistido); `61cfd94` (reproductor) | RED inicial: esperado 0, recibido 1. Diagnóstico estable posterior: exige exactamente 1; `test-results/...58ed2.../error-context.md` y `cafeteria-e1-pilot-reprompt.png` |
| A2. Objetivo sin KPI numérico inventado y E3 sin trabajo | `PortfolioBootstrapHome.tsx`; `portfolio-bootstrap.service.ts` | `A · diagnóstico: la misma sesión alcanza E1→E7...` | `c39327f`; `61cfd94` | PASS; la señal queda declarada como desconocida y E3 usa la ruta sin iniciativas |
| A3. Ausencia de trabajo no crea `Project`/`Step` | Servicio de bootstrap y gates E3/E5 | mismo test diagnóstico | `43b7748`; `61cfd94` | PASS; conteos finales iguales a los iniciales |
| A4. E5 reto, E6 Brief confirmado, E7 Lab notificado y Home | organización, Brief/Handoff, Lab y `PortfolioOverviewHome` | mismo test diagnóstico | `3e5faa5`; `61cfd94` | PASS; `completionRoute=LAB_NOTIFIED`, Home visible, Brief confirmado y contacto pendiente |
| C1. MVP en uso con logs llega a E4 sin autovalidar Steps | `PortfolioBootstrapHome.tsx`; análisis de bootstrap | `C · distribuidora: el MVP y sus logs llegan a E4...` | baseline `22ba66d`; `61cfd94` | PASS; fase `B4_MATERIAL_REVIEW`, un work item, un analysis run, cero deltas de `Project`/`Step` |

Los hashes anteriores trazan las piezas ya presentes que la auditoría reutiliza; no atribuyen a esos commits una certificación E1→E7 completa.

## Defecto A1: repregunta redundante de piloto

Entrada:

> Somos una cafetería de 4 personas. Nunca hemos probado desayunos para llevar ni pedidos a oficinas.

Esperado: tras completar área y stakeholder, el flujo no vuelve a preguntar si hubo un piloto.  
Actual: aparece una vez «¿Habéis probado algo parecido?».

El fallback sólo considera resuelto `pilotExperience` cuando ese campo del `ContextReview` tiene valor o disposición. La negación sigue estando en la narrativa inicial, sin una proyección autorizada hacia ese campo.

No se aplicó una regex o extractor en React. Ese atajo convertiría texto libre en un hecho de dominio y le asignaría una procedencia sin las reglas de mapping, conceptos no asignables, versionado e idempotencia exigidas por el handoff. La corrección mínima de runtime queda bloqueada hasta aprobar ese guardrail funcional; el PR de auditoría conserva el RED inicial y una aserción diagnóstica exacta, no finge una reparación ni usa `test.fail()` para ocultar fallos ajenos.

## Alcance real del recorrido E1→E7

El test diagnóstico responde de manera explícita la repregunta redundante y continúa por UI hasta E4. Para evitar declarar superficies TO-BE como implementadas, prepara mediante APIs autenticadas existentes:

1. propuesta de organización y materialización del reto;
2. Brief versionado y confirmado;
3. solicitud Lab con consentimiento;
4. aceptación de notificación simulada sólo dentro de la base desechable;
5. finalización `LAB_NOTIFIED` y lectura de Portfolio Overview.

No se llama a SMTP ni se afirma que Lab/Fab haya aceptado o iniciado trabajo. La fixture sólo permite probar el handoff y Home sobre el mismo `sessionId`.

## Ejecuciones

```text
npm run test:e2e -- e2e/kan240-e1-e7-delta.spec.ts --workers=1
PASS (exit 0): 3 tests; A1 exige exactamente la conducta defectuosa ya reproducida en RED; A4 y C1 pasan realmente.

npm run test:e2e -- e2e/kan240-e1-e7-delta.spec.ts --grep "distribuidora" --workers=1
PASS: 1/1.

npm run test:e2e -- e2e/kan240-e1-e7-delta.spec.ts --grep "diagnóstico" --workers=1
PASS: 1/1.

npm run lint
PASS.

git diff --check
PASS.
```

## Clasificación delta

| Clasificación | Resultado |
|---|---|
| KEEP | Confirmación humana de E1/E2; ausencia de trabajo sin `Project`/`Step`; análisis E4 sin autoaprobación; autoridad separada de Brief, Lab y Home. |
| ADAPT | El test espera cada pregunta de E2 antes de responder para eliminar una carrera de automatización, sin modificar runtime. |
| NEW | Un único spec KAN-240 cubre defecto A1, distribuidora E3/E4 y continuidad diagnóstica E1→E7/Home sobre una sesión. |
| DEFER | Reparación A1 hasta guardrail de proyección; casos B y D; rutas Fab-iniciativa y Steps+Fab Step2; conexión completa Step4→Decision Package→Portfolio. |

## Gate

- GO para revisar y conservar esta evidencia de QA.
- NO_GO para declarar un happy path E1→E7 limpio mientras A1 siga abierto.
- NO_GO para una reparación de A1 basada en inferencia React sin autoridad de mapping/provenance.
- NO_GO para merge o deploy automático.
