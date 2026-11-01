# KAN-204 — Steps conversational QA exposure

## Resultado

El slice queda preparado para revisión humana y validación UX. No se ha ejecutado CD ni se ha modificado producción.

El cambio no rediseña `StepReasoningPanel`: publica de forma coherente el diseño ya integrado en `main` para una única cuenta sintética E2E. La conversación es la interacción principal; la card de avance/output y el workspace oficial de checkpoints conservan la autoridad canónica.

## Hallazgo de despliegue

| Capa | Estado previo | Cierre KAN-204 |
|---|---|---|
| Frontend | `VITE_STEP_REASONING_*` se evaluaba en código, pero `Dockerfile.frontend` y CD no lo inyectaban. | Build args explícitos, apagados por defecto y restringidos a una identidad. |
| Backend | El router exigía flag + allowlist, pero Kubernetes/CD no los configuraban. | ConfigMap no sensible creada por el CD protegido; ausencia equivale a feature apagada; el runtime falla al arrancar si se intenta habilitar más de una identidad o un proveedor distinto de `qa_stub`. |
| Proveedor | El servicio derivaba al endpoint LLM real cuando el flag se activaba. | `STEP_REASONING_PROVIDER_MODE=qa_stub`; respuesta determinista local, cero llamadas al bridge y cero coste. |
| UI | Copilot, progreso/output y checkpoint ya estaban implementados. | Se conservan sin cambios visuales; la respuesta muestra `Respuesta de integración QA · no es razonamiento de un LLM`. |
| Autoridad | Copilot sólo tenía `reason`/`suggest`, pero faltaba evidencia integrada de continuidad. | E2E prueba que ciclo, Step, checkpoints y outputs canónicos no cambian después de conversar y recargar. |

## Matriz de flags

| Variable | Capa | Default | Valor para validación KAN-204 | Restricción |
|---|---|---:|---:|---|
| `VITE_STEP_REASONING_COPILOT_ENABLED` | bundle frontend | `false` | derivado de `vars.STEP_REASONING_COPILOT_ENABLED=true` | Sólo decide visibilidad; no concede acceso API. |
| `VITE_STEP_REASONING_QA_USER_IDS` | bundle frontend | vacío | una identidad sintética | Exactamente un ID, sin credenciales ni correo. |
| `STEP_REASONING_COPILOT_ENABLED` | backend | `false`/ausente | `true` | Backend falla cerrado si falta. |
| `STEP_REASONING_QA_USER_IDS` | backend | vacío | el mismo ID sintético | Allowlist efectiva del endpoint autenticado. |
| `STEP_REASONING_PROVIDER_MODE` | backend | `qa_stub` | `qa_stub` en el CD KAN-204 | El proveedor no generativo es fail-closed por defecto; `live_llm` requiere una autorización futura y ajena a KAN-204. |
| `COPILOT_ENABLED` / `COPILOT_WRITE_ENABLED` | Copilot de Portfolio | sin cambio | sin cambio | No controla `StepReasoningPanel`. |
| `OPENROUTER_API_KEY` y flags del AI Service | AI Service | sin cambio | no utilizados por KAN-204 | Ningún proveedor real se activa. |

Activar sólo una de las capas no constituye una experiencia válida: frontend y backend deben compartir el mismo flag y el mismo ID, y el proveedor debe permanecer en `qa_stub`.

## Evidencia funcional

- PostgreSQL 16 descartable, 72/72 migraciones canónicas.
- Cuenta E2E sintética generada por `seed.e2e.ts` y resuelta dinámicamente; ningún ID se fija en código o documentación.
- Iniciativa independiente: conversación persistida tras recarga; ciclo activo único; Step 0 sin avance; checkpoints intactos; cero `AdaptiveStepOutput` implícitos.
- Iniciativa vinculada: Frente/Reto/relación sintéticos en la misma organización; contexto muestra `Reto vinculado en Adaptive Core`; mismas garantías de continuidad.
- La relación `InitiativePortfolioMeta` y sus registros Front/Challenge se vuelven a consultar después de conversar y permanecen vinculados al mismo Project y organización.
- Una segunda cuenta sintética autenticada de la misma organización recibe `STEP_REASONING_QA_ACCOUNT_REQUIRED`; no basta con tener acceso al Project.
- Los dos turns persistidos registran exclusivamente `providerModel=qa-stub/kan-204-step-reasoning`, cero tokens y cero coste; el test unitario demuestra además que el bridge no es invocado en este modo.
- Los únicos POST de negocio observados durante la interacción controlada fueron los dos turns `/steps/0/copilot/turn`; no hubo confirmación de checkpoints ni transición de Step.
- Unit/integration cubren la presentación contextual de Steps 0, 1, 2, 3 y 4, modo histórico/read-only, output confirmado, idempotencia y fail-closed.

Capturas y evidencia JSON, todas con datos sintéticos:

- `artifacts/KAN-204/independent-desktop-1440x900.png`
- `artifacts/KAN-204/portfolio-linked-desktop-1440x900.png`
- `artifacts/KAN-204/portfolio-linked-mobile-390x844.png`
- `artifacts/KAN-204/KAN204_BROWSER_EVIDENCE.json`

## Configuración del operador para una validación posterior

En el GitHub Environment protegido `production`, crear o actualizar únicamente estas variables no secretas:

1. `STEP_REASONING_COPILOT_ENABLED=true`
2. `STEP_REASONING_QA_USER_IDS=<userId de una cuenta E2E sintética autorizada>`

El ID debe corresponder a una sola cuenta sintética existente con acceso legítimo a sus iniciativas. No usar una cuenta humana, una identidad productiva de cliente ni una lista múltiple. No se necesita ningún secreto de proveedor LLM.

Después, una ejecución futura del CD manual requerirá la aprobación humana normal del environment y una autorización separada de release. Este PR no la solicita ni la ejecuta. Para desactivar la exposición en un release posterior, establecer `STEP_REASONING_COPILOT_ENABLED=false` y reconstruir/desplegar el frontend por el mismo CD autorizado.

## GO / NO_GO

- **GO para revisión de código y validación UX humana:** sí.
- **NO_GO para merge o CD automático:** se requiere revisión humana, CI remoto verde y aceptación visual de las capturas.
- **NO_GO para LLM real:** privacidad, seguridad, coste y evaluación del proveedor siguen fuera de alcance.
