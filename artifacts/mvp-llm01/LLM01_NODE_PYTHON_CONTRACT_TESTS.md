# MVP-LLM-01 — Contratos Node/Python

## Resultado ejecutado

| Capa | Resultado | Cobertura |
|---|---|---|
| Node Step Reasoning unit/contract | PASS | Context builder, schemas, feature flag, servicio, fallback, persistencia y autoridad. |
| PostgreSQL Step Reasoning | PASS | Sesión/turnos, reentrada, idempotencia y separación del Core dentro del lote focal de 23 tests. |
| Frontend Step Reasoning | PASS | Incluido en 1.023 tests frontend: estados, retry/fallback, autoscroll, lectura histórica y responsive lógico. |
| Python Step Reasoning | PASS | `pytest tests/test_step_reasoning.py -q`: 7 PASS en Docker aislado, sin red ni proveedor. |
| E2E HTTP/browser | PASS | Step 0 nuevo, tres turnos, reload y Pixel 5 sobre stack/DB efímeros. |
| HMAC/anti-replay Node↔Python | BLOCKED | No implementado; TODO ADR-011 presente en ambos lados. |
| Provider real | NOT_RUN | STOP L0 aplicado. |

## Observación de packaging Python

`pip install -e .[dev]` falla porque el proyecto usa flat-layout con múltiples paquetes top-level. Para ejecutar el contrato focal se instalaron las dependencias declaradas directamente dentro del contenedor. Los tests son reales, pero el packaging debe corregirse antes de promover una imagen/distribución nueva.

## Contrato que debe preservarse

- React nunca llama directamente al proveedor.
- Backend deriva actor, tenant, Project, Cycle y Step.
- Python devuelve respuesta estructurada o error/fallback honesto.
- `clientTurnId` y fingerprint protegen reintentos; el chat no escribe outputs canónicos.
- Una propuesta LLM nunca equivale a validación humana.

