# KAN-204 — Steps conversacional con autorización persistida

## Resultado

El slice queda preparado para revisión humana. No se ha ejecutado CD ni se ha modificado producción.

La autorización ya no depende de copiar un `User.id` a GitHub. En cada petición, el backend parte del `User.id` autenticado y consulta la identidad persistida. Sólo habilita la experiencia cuando coinciden simultáneamente:

- email `e2e-participante@starteria.test`;
- roles efectivos que incluyen `participante` y excluyen `admin`;
- `organizationId=org-e2e-prod`;
- membresía canónica `OrganizationMember` con rol `member` en ese tenant;
- `isActive=true`.

Las claims autenticadas deben concordar con esa misma identidad y presentar rol primario `participante`, sin `admin`. El gate se ejecuta antes del control de acceso al Project y el servicio recibe el actor persistido autorizado, por lo que un JWT antiguo con privilegios superiores falla cerrado.

El frontend no evalúa email, nombre, tenant, rol ni ID: consulta el endpoint autenticado de elegibilidad y refleja su respuesta. Los endpoints de sesión y turn mantienen la misma comprobación server-side.

## Matriz de exposición

| Control | Valor de release | Función |
|---|---|---|
| `VITE_STEP_REASONING_COPILOT_ENABLED` | `true`, fijado por el CD manual | Permite al bundle consultar elegibilidad; no concede acceso. |
| `STEP_REASONING_COPILOT_ENABLED` | `true`, fijado por el CD manual | Habilita la modalidad code-driven en backend. |
| `STEP_REASONING_COPILOT_EMERGENCY_DISABLED` | variable protegida, default `false` | Kill switch backend. En `true`, elegibilidad y endpoints quedan cerrados sin ampliar usuarios. |
| `STEP_REASONING_PROVIDER_MODE` | `qa_stub`, fijado por el CD | Único proveedor admitido. Cualquier otro valor detiene el runtime/validación. |
| `STEP_REASONING_QA_USER_IDS` | eliminado | Ya no existe allowlist manual ni se propaga identidad al bundle o Kubernetes. |

Billing, proveedores LLM reales y flags de Portfolio Copilot no cambian.

## Autoridad y continuidad

- `StepReasoningPanel` conserva la identificación visible de QA simulado.
- Los turnos sólo persisten conversación y sugerencias; no confirman checkpoints.
- No cambian `InitiativeCycle.currentStep`, outputs adaptativos ni relaciones Portfolio.
- Adaptive Core, autenticación, transiciones y contratos de Steps no se modifican.
- La segunda identidad autenticada, aunque pertenezca al mismo tenant, recibe elegibilidad `false` y `STEP_REASONING_QA_ACCOUNT_REQUIRED` al acceder al razonador.

## Validación esperada

La prueba KAN-204 usa PostgreSQL 16 descartable y crea únicamente datos sintéticos. Verifica en desktop 1440 px y móvil 390 px:

- la cuenta exacta persistida ve «Conversa con Startería»;
- una segunda cuenta queda excluida;
- iniciativa independiente y vinculada conservan ciclo, Step, checkpoints, output y relación Portfolio;
- recarga mantiene la conversación;
- los turnos usan exclusivamente `qa-stub/kan-204-step-reasoning`, con cero tokens y coste;
- no existen POST implícitos de checkpoint, output o transición.

Evidencia generada por CI:

- `artifacts/KAN-204/independent-desktop-1440x900.png`
- `artifacts/KAN-204/portfolio-linked-desktop-1440x900.png`
- `artifacts/KAN-204/portfolio-linked-mobile-390x844.png`
- `artifacts/KAN-204/portfolio-linked-mobile-composer-390x844.png`
- `artifacts/KAN-204/KAN204_BROWSER_EVIDENCE.json`

## Operación posterior al merge

No es necesario configurar un ID. El único control operativo opcional es `STEP_REASONING_COPILOT_EMERGENCY_DISABLED`; dejarlo ausente o en `false` permite la cuenta exacta, y establecerlo en `true` cierra la modalidad en backend.

Tras merge y CI verde, un operador debe iniciar el CD manual existente sobre el SHA aprobado y superar la aprobación humana del environment `production`. Este cambio no ejecuta ese CD.

## GO / NO_GO

- **GO para revisión humana y merge:** sujeto a CI remoto verde y aceptación de la revisión independiente.
- **NO_GO para CD automático:** el despliegue sigue siendo manual y protegido.
- **NO_GO para LLM real, billing o acceso global:** quedan expresamente fuera de KAN-204.
