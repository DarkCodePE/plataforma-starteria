# Semantic E1 pilot gate — production runbook v1.0

Este procedimiento publica primero el código con E1 semántica apagada y permite una activación posterior limitada a organizaciones aprobadas. No autoriza merge, CD ni activación por sí mismo.

## Preconditions

- El commit a publicar pertenece a `main`, incluye HU-E1-V1 y HU-E1-PILOT-GATE, y tiene CI requerido aprobado.
- Producto aprobó los IDs opacos de las organizaciones piloto. No usar emails, nombres ni IDs de usuario.
- El environment GitHub `production` mantiene required reviewers.
- El secret protegido `SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST` contiene los IDs exactos separados por comas. Un valor vacío deniega a todas las organizaciones.

## 1. Publicar con el flag apagado

1. Ejecutar manualmente `CD` para el SHA completo aprobado de `main` y superar la aprobación del environment `production`.
2. El CD sincroniza la allowlist en `starteria-backend-secrets` y fuerza `SEMANTIC_E1_ENABLED=false`; no activa el piloto.
3. Verificar `https://starter-ia.com/api/health`: `release.flags.SEMANTIC_E1_ENABLED` debe ser `false`.
4. Con una cuenta piloto y otra no piloto, abrir Home → Crear objetivo. Ambas deben seguir viendo el flujo guiado. Un POST semántico debe responder `PORTFOLIO_SEMANTIC_DISABLED`.

No continuar si el health no reporta `false`, si cambia la imagen fuera del SHA aprobado o si el modo guiado presenta una regresión.

## 2. Activar solo la organización piloto

1. Tras aprobación explícita de Producto, abrir GitHub Actions → `Semantic E1 Pilot Gate` sobre `main`.
2. Elegir `activate` e introducir exactamente `ACTIVATE_E1_PILOT`.
3. Aprobar el environment `production`. El workflow comprueba que la allowlist protegida no esté vacía, cambia solo `SEMANTIC_E1_ENABLED`, espera el rollout del backend, comprueba que la imagen no cambió y valida el flag público.
4. Verificar con una cuenta perteneciente a la organización allowlisted: entrada E1, conversación, revisión/corrección, confirmación y continuidad E1→E2.
5. Verificar con una organización distinta: debe conservar el modo guiado y no debe revelar estado, membresía ni configuración del piloto.

La allowlist no sustituye autenticación: cada request sigue exigiendo propiedad de sesión, tenant y permiso Portfolio adecuado.

## 3. Desactivar ante cualquier anomalía

1. Abrir GitHub Actions → `Semantic E1 Pilot Gate` sobre `main`.
2. Elegir `deactivate` e introducir exactamente `DEACTIVATE_E1_PILOT`.
3. Aprobar el environment `production` y esperar el rollout verificado.
4. Confirmar en `/api/health` que `release.flags.SEMANTIC_E1_ENABLED` es `false`.
5. Confirmar que nuevas solicitudes POST semánticas reciben `PORTFOLIO_SEMANTIC_DISABLED` y que el GET vuelve a `enabled=false`, `state=null`, `turns=[]`; el flujo guiado debe continuar disponible.

Una activación que falla o se cancela después de obtener acceso al clúster ejecuta además un cierre de seguridad que vuelve a fijar el flag en `false`. Un CD posterior también fuerza `false`, pero no debe usarse como primera respuesta porque cambia más superficie y tarda más.

## Cambiar la organización piloto

Actualizar el secret protegido con aprobación de Producto y volver a ejecutar CD: el propio CD deja el flag apagado. Validar primero el modo guiado y luego repetir la activación gobernada. Nunca introducir la allowlist como input del workflow, comentario, artifact o log.
