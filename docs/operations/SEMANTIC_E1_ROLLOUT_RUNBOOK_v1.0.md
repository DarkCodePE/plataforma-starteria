# Semantic E1 — production rollout runbook v1.0

Este procedimiento gobierna la E1 semántica normal de Portfolio Lead. La disponibilidad depende del kill switch global `SEMANTIC_E1_ENABLED`; no existen organizaciones piloto ni allowlists. Autenticación, propiedad de sesión, aislamiento tenant y capacidades Portfolio siguen siendo obligatorios.

## Configuración normal

- El environment protegido `production` conserva sus required reviewers.
- La variable de environment `SEMANTIC_E1_ENABLED` admite únicamente `true` o `false`; si no existe, el CD adopta `false`.
- El CD manual registra el valor en el release manifest y lo aplica al backend. No existe un workflow separado para activar E1.
- `PORTFOLIO_ENTRY_API_KEY`, proveedor, modelo y límites siguen siendo los ya configurados; este rollout no crea credenciales ni proveedores.

## Habilitar mediante CD

1. Configurar `SEMANTIC_E1_ENABLED=true` en las variables del environment `production` con el mecanismo administrativo habitual.
2. Ejecutar manualmente `CD` para el SHA completo aprobado de `main` y superar la aprobación de `production`.
3. El job `Semantic E1 real-provider preflight` ejecuta una llamada de bajo consumo a través del orquestador E1 real. Debe acreditar proveedor/modelo, tokens positivos, clasificación, incertidumbre y pregunta o síntesis. Un fallo impide el despliegue.
4. El rollout aplica el valor gobernado y verifica el release manifest contra `/api/health`.
5. El smoke autenticado usa el Portfolio Lead E2E, conversa dos turnos sobre el caso restaurante, comprueba proveedor y tokens reales, y abandona la preparación temporal sin crear trabajo canónico.
6. Si el smoke falla, el mismo CD fija inmediatamente `SEMANTIC_E1_ENABLED=false` y deja la ejecución fallida para investigación.

La comprobación operativa no equivale a aceptación de calidad semántica por Producto.

## Desactivar inmediatamente

1. Configurar `SEMANTIC_E1_ENABLED=false` en el environment `production` para que el siguiente CD conserve el estado.
2. Ejecutar `Semantic E1 Kill Switch` sobre `main` e introducir exactamente `DEACTIVATE_SEMANTIC_E1`.
3. Aprobar el environment `production`.
4. El workflow cambia solo la variable del Deployment, conserva la imagen y verifica en `https://starter-ia.com/api/health` que `release.flags.SEMANTIC_E1_ENABLED=false`.

Con el switch apagado, GET semántico devuelve `enabled=false` y nuevos POST fallan con `PORTFOLIO_SEMANTIC_DISABLED`; la experiencia guiada de compatibilidad permanece disponible. La reactivación se realiza únicamente mediante el CD normal después de resolver la anomalía y superar de nuevo el preflight real.
