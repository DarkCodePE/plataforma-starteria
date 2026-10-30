# MVP-LLM-01 — Gates de seguridad, datos, coste y operación

Estado: `LLM01_GATES_BLOCKED`  
Decisión aplicada: STOP antes de toda petición a un proveedor de pago.

| Gate L0 | Estado | Evidencia / bloqueo | Aprobación necesaria |
|---|---|---|---|
| Provider/modelo | BLOCKED | El repositorio contiene varios modelos históricos y ejemplos, pero no existe una selección LLM-01 ratificada con cuenta, región y términos. | Producto + seguridad/privacidad: proveedor, modelo exacto, cuenta/región y DPA/retención. |
| Seguridad inter-servicios | BLOCKED | `backend/modules/ai/bridge.service.ts:11-12,173-174` y `ai-service/routers/ai.py:155` conservan TODO de HMAC-SHA256, timestamp y anti-replay. El shared secret actual no satisface el gate. | Aprobar e implementar ADR-011 o una excepción formal equivalente, con tests de replay/firma. |
| Datos | BLOCKED | Los fixtures sintéticos están disponibles, pero no están ratificados proveedor, retención, logging, región ni política de redacción/prompt injection para LLM-01. | Seguridad/privacidad y responsable de datos. |
| Presupuesto | BLOCKED | Existen caps de ejemplo (`MAX_COST_PER_REQUEST_USD=0.05`, `MAX_COST_PER_PROJECT_DAY_USD=2.00`), pero no son presupuesto LLM-01 aprobado ni incluyen sesión/campaña global. | Producto/finanzas: topes numéricos por petición, sesión y campaña, moneda y responsable. |
| Operación | PARTIAL | Feature flag/allowlist y fallback de Step Reasoning existen; no se ha validado kill switch, circuit breaker y contador durable con el proveedor elegido. | Operaciones + seguridad tras seleccionar proveedor. |
| Contratos y tests | TECH PASS MOCKS | Node/PostgreSQL/Python herméticos pasan; no prueban el proveedor real ni sustituyen gates de seguridad. | Ejecutar sandbox real sólo tras aprobar los gates anteriores. |
| Autoridad | PASS técnico | Step Reasoning no confirma checkpoints/Truth, no crea Project/Cycle y no escribe `AdaptiveStepOutput`; las regresiones lo comprueban. | Mantener estas guardas en la futura implementación. |

## Causa del bloqueo

No falta una simple variable local. Falta una decisión conjunta y verificable sobre proveedor/modelo/datos/gasto, y la protección entre Node y Python sigue explícitamente pendiente en el código. Activar una clave ahora violaría el STOP del Goal.

## Siguiente autorización específica

Autorizar un paquete LLM-01B que incluya: proveedor/modelo/cuenta/región; DPA, retención y logs; cifras máximas por request/sesión/campaña; diseño HMAC/anti-replay; allowlist QA; kill switch; y fixtures exclusivamente sintéticos. Esa autorización no debe permitir mutaciones de Core ni uso de datos reales.

