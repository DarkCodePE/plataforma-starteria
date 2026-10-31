# Propuesta de aceptación temporal — GHSA-ggr8-5vv4-36mx

## Estado de decisión

- Estado: `APPROVED` (aceptación temporal vigente hasta el 30/11/2026 inclusive).
- Vigencia: desde el 31/10/2026 hasta el 30/11/2026 inclusive.
- Responsable de aprobación: `DarkCodePE`, como responsable humano del producto y del repositorio.
- Alcance: candidato MVP de los PR #222 y #229. Esta propuesta no autoriza despliegues ni migraciones productivas.
- Condición de validez: el riesgo no se considera aceptado hasta que el responsable registre una aprobación explícita y trazable.

## Dependencia afectada

La cadena instalada es `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`. La vulnerabilidad GHSA-ggr8-5vv4-36mx afecta a `deepmerge-ts` anterior a 8.0.0 y puede provocar agotamiento de pila al combinar dos grafos de objetos JavaScript recursivos en la misma ruta.

No hay una versión posterior corregida de Prisma 6. La corrección upstream de `deepmerge-ts` está incorporada por Prisma en su línea 7. Un override transitivo a `deepmerge-ts` 8 sería una modificación mayor indirecta, no está cubierto por esta aceptación y requeriría autorización y validación separadas.

## Justificación técnica

| Contexto | Alcanzabilidad | Exposición efectiva |
| --- | --- | --- |
| Desarrollo | El Prisma CLI carga `prisma.config.ts` y ejecuta el merger vulnerable. | La configuración es código local controlado por el repositorio; no recibe grafos recursivos desde solicitudes de usuario ni datos PostgreSQL. |
| CI | Los jobs de Prisma pueden cargar la configuración. | La entrada relevante procede del checkout revisado. Los jobs no deben exponer secretos o bases protegidas a código no confiable. |
| Migraciones | `prisma migrate` carga la configuración en un proceso operativo privilegiado. | Un fallo podría interrumpir la operación, pero no existe una ruta desde datos de aplicación hasta el merger. ADR-009 continúa bloqueando el despliegue productivo. |
| Runtime productivo | No alcanzable en el diseño actual. | La imagen final elimina y verifica la ausencia de `prisma`, `@prisma/config`, `deepmerge-ts` y `c12`; la aplicación usa el cliente generado. |

La precondición específica del advisory exige dos grafos recursivos. Introducirlos en la configuración actual requeriría modificar código ejecutable del repositorio, capacidad que ya permitiría ejecutar código arbitrario en desarrollo, CI o en la tarea de migración. Por ello se propone aceptar temporalmente el riesgo de disponibilidad operacional, no un riesgo de explotación remota del runtime del MVP.

## Riesgo residual

- Denegación de servicio o fallo por agotamiento de pila durante comandos Prisma de desarrollo, CI o migración si una configuración maliciosa o futura introduce grafos recursivos.
- Persistencia de un hallazgo de severidad alta en escáneres de dependencias aunque la explotación efectiva esté limitada.
- Riesgo de cadena de suministro mientras permanezca instalada la versión vulnerable en tooling.
- Una tarea de migración privilegiada podría detenerse; esta aceptación no cubre pérdida de datos, elusión de autorización ni exposición de secretos.

## Controles compensatorios obligatorios

1. Mantener `prisma.config.ts` estático, revisado y sin incorporar objetos procedentes de solicitudes, base de datos o fuentes no confiables.
2. Exigir revisión humana para cambios en `prisma.config.ts`, dependencias Prisma, scripts de migración y construcción de imágenes.
3. Mantener CI de contribuciones no confiables sin secretos, acceso a bases protegidas ni credenciales de despliegue.
4. Mantener la eliminación y la aserción de ausencia de Prisma CLI, `@prisma/config`, `deepmerge-ts` y `c12` en la imagen productiva.
5. Mantener ADR-009 como bloqueo explícito de despliegue y migraciones productivas.
6. No introducir overrides ni actualizar a Prisma 7 sin autorización y regresión específicas.
7. Revisar semanalmente si aparece un backport soportado para Prisma 6 o una corrección compatible autorizable.

## Revisión anticipada obligatoria

La aceptación, si se aprueba, deberá suspenderse y revisarse antes del 30/11/2026 si ocurre cualquiera de estas condiciones:

- Prisma publica un backport soportado o se autoriza una actualización/override validado.
- Prisma CLI, `@prisma/config` o `deepmerge-ts` pasan a formar parte del runtime productivo.
- `prisma.config.ts` o el merger empiezan a consumir datos externos, dinámicos o no confiables.
- CI o migraciones empiezan a ejecutar código no confiable con secretos, acceso a QA protegida o credenciales productivas.
- Aparece explotación pública aplicable a la configuración de Startería, cambia la severidad o se amplía el impacto más allá de disponibilidad.
- Cambian la construcción de imágenes, los scripts de migración o los controles compensatorios descritos.

## Registro de aprobación

- Decisión: `APPROVED`
- Aprobador: `DarkCodePE`.
- Fecha: 31/10/2026.
- Evidencia de aprobación: el PR que registra esta decisión, abierto y mergeado por `DarkCodePE`.
- Caducidad: 30/11/2026.

La aprobación cubre sólo el riesgo descrito arriba con sus controles compensatorios; no autoriza despliegues ni migraciones productivas, que siguen su propia aprobación en el entorno `production`.
