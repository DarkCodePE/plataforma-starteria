# KAN-239 — Release parity y certificación UX E1–E7

Estado: implementación propuesta; sin despliegue productivo.

## Alcance y autoridad

Esta entrega implementa el gate técnico de KAN-239 bajo la HU KAN-233. No cambia Core, Steps,
MCP, memoria, autoridad de IA ni reglas funcionales de Portfolio Lead/Owner Handoff. KAN-232 y
KAN-254 se consumen como suites de conformidad del recorrido ya aprobado.

## AS-IS / TO-BE

| Superficie | AS-IS | TO-BE |
|---|---|---|
| Fuente probada | El CD podía resolver un SHA histórico, pero el reusable CI usaba el checkout del caller. | CI recibe y hace checkout del `release_source_sha` exacto. |
| Frontend y flags | CI compilaba con defaults y CD con argumentos VITE distintos. | CI, imagen y manifiesto declaran un perfil funcional único; flags E2 experimentales permanecen OFF. |
| Artefactos | CD construía tras CI y desplegaba `main-<sha7>`. | Una construcción por SHA produce tres digests; el E2E y Kubernetes consumen exactamente `@sha256`. |
| Evidencia de release | No había manifiesto ni identidad visible de frontend/backend. | Manifiesto sin secretos, etiquetas OCI, `/release.json` y metadata en health. |
| Paridad E2E | Playwright ejercitaba procesos locales, no los contenedores candidatos. | Gate aislado levanta PostgreSQL 16 y las tres imágenes candidatas antes del rollout. |
| Verificación runtime | Health no acreditaba SHA, digest ni flags. | Post-rollout compara manifest, DeploymentSpecs, image IDs, SHA y flags efectivos. |

## Recorrido certificado antes del despliegue

El gate ejecuta Inicio → E1 → E2 → E3 → E4 → E5 → E6 → E7 con CTA,
transiciones, persistencia, regreso y reentrada. Conserva los escenarios 0, 3 y 25 iniciativas y el
caso de iniciativa avanzada. Owner Handoff cubre usuario existente/nuevo, organización y tenant,
aceptación/rechazo, expiración, reentrada e historial. El correo del gate es exclusivamente Mailpit
sandbox; no se presenta como entrega productiva.

La evidencia incluye Playwright HTML, resultados, axe y capturas de las vistas finales en 375, 768
y 1440 px. Estas capturas son candidatas de revisión visual; la aprobación humana del baseline no se
infiere de CI.

## Evidencia de implementación

- Contrato de release, sintaxis shell/YAML, typecheck y lint: PASS.
- Backend sobre PostgreSQL 16 descartable: 234 archivos aprobados, 44 omitidos; 2031 pruebas
  aprobadas, 207 omitidas.
- Frontend y servicio de IA: suites completas PASS; metadata de release y health cubiertos por
  pruebas específicas.
- Playwright sobre procesos fuente, PostgreSQL y Mailpit: 5/5 PASS, con 18 capturas.
- Playwright sobre las tres imágenes candidatas referenciadas por digest, PostgreSQL 16 y Mailpit:
  5/5 PASS. El gate verificó etiquetas OCI, SHA, flags y metadata antes de abrir el navegador.

Una primera ejecución diagnóstica detectó dos condiciones y bloqueó correctamente: Mailpit no tenía
el alias local exigido por el sandbox y una confirmación E2 recibió un conflicto transitorio del
Anchor. Se corrigió el arnés Mailpit; la siguiente ejecución exacta pasó 5/5. El conflicto E2 no se
oculta con reintentos: el gate fuerza `--retries=0` y, si reaparece, conserva logs e inspección
sanitizada de runtime y devuelve `PROD_UX_FAIL`.

## Manifiesto y seguridad

`release-manifest.json` contiene SHA completo, versiones, referencias por digest, las dos migraciones
autorizadas para este release con checksum, el inventario completo de schema, flags funcionales y suites aprobadas. El verificador rechaza referencias mutables,
flags experimentales activos, suites incompletas y claves con nombres de secretos. No almacena
credenciales, tokens, correos ni datos personales.

## Estado productivo y límites

- El workflow de CD sigue siendo manual y conserva environment, autoridad de migración, backup y
  separación de funciones existentes.
- Esta entrega no ejecuta CD, migraciones ni correo real.
- La identidad runtime puede verificarse sin escribir datos. El smoke autenticado productivo E1–E7
  requiere una autorización posterior, tenant sintético aprobado y operación humana controlada.
- Hasta completar rollout autorizado, smoke productivo y aprobación visual, el resultado no es DONE
  ni `PROD_UX_PASS`.
- La aprobación del baseline visual sigue siendo una decisión humana pendiente; CI conserva las
  capturas candidatas, pero no se autoaprueba.
