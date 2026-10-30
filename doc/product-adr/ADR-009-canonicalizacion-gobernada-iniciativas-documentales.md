# ADR-009 — Canonicalización gobernada de iniciativas documentales

**Estado:** APPROVED — autoridad humana de producto; ejecución exclusivamente en PostgreSQL desechable y condicionada a reconciliación técnica S0
**Fecha de aprobación:** 2026-10-23
**Aprobación:** confirmación humana explícita del Portfolio Lead en la conversación del proyecto. Registro paralelo en Jira KAN-165/KAN-168.
**Alcance de aprobación:** seis decisiones de §6, arquitectura de incorporación LINK_EXISTING/REGISTER_EXISTING y su implementación controlada en entorno disposable. No autoriza alteraciones sobre tenant visual original, producción, PR/merge/deploy/RC, invitaciones o Steps.
**Ámbito:** Startería P12-R1, KAN-165 y KAN-168, integración con PL-06A
**Autoridad a reconciliar en checkout:** Core Contract vigente, ADR-005, ADR-008, Handoff Experience/Integration/Technical Contracts, KAN-165/168, AGENTS.

## 1. Contexto y necesidad

La incorporación documental de Portfolio Lead detecta registros `PortfolioBootstrapWorkItem` que pueden representar iniciativas previamente desarrolladas, pero no los convierte en iniciativas `Project`. En el tenant visual se informaron ocho registros: cinco relacionados con el Challenge de trabajo y tres en otras clasificaciones; ninguno tiene Project ni `InitiativePortfolioMeta` canónicos. La modalidad `EXISTING_INITIATIVE` del Handoff requiere un `Project` real y su relación válida con el Challenge.

La implementación actual de `ProjectService.createProject` materializa equipo y Steps, lo que crea semánticas inapropiadas para un proyecto que preexistía fuera de Startería. `Project.ownerId` es obligatorio y participa indirectamente en el reconocimiento del tenant, y `InitiativePortfolioMeta` asume `en_step_0` por defecto. `upsertInitiativeMeta` por sí solo no registra lineage documental ni atomicidad/idempotencia de la decisión humana.

La necesidad es: **seleccionar una iniciativa identificada → confirmar si se vincula a una Project existente o se incorpora como Project de iniciativa preexistente → seleccionar destinatario → guardar Assignment `CREATED`, sin crear Steps ni enviar invitaciones.**

## 2. Restricciones superiores y compatibilidad

- `Project` sigue siendo identidad canónica de Initiative; `PortfolioBootstrapWorkItem` sigue siendo evidencia importada, preservada e inmutable.
- INV-02: alineamiento explícito al Reto; no inferirlo de coincidencia textual.
- INV-03: la IA puede sugerir equivalencias, pero la persona autorizada confirma identidad, alineamiento e incorporación.
- INV-05 e INV-10: preservar procedencia, evidencias y versiones anteriores.
- INV-11: lo importado se evalúa retroactivamente; no rehacer trabajo válido ni declarar Step suficiente sin validación.
- Core 37A: seleccionado/aprobado, owner pendiente, ready/active y Steps no son equivalentes.
- ADR-005/008: `PortfolioHandoffAssignment` no es la iniciativa, ni guardar/enviar/aceptar supone automáticamente iniciar un ciclo o crear un `Project`.

**Aprobación humana de producto otorgada para este ADR.** La implementación sigue subordinada a comprobar compatibilidad con Core y contratos vigentes del checkout y a un S0 técnico sin conflictos materiales nuevos. La aprobación no autoriza escritura sobre datos persistentes del usuario.

## 3. Decisión recomendada

### 3.1 Dos modos de incorporación

**LINK_EXISTING:** una persona autorizada selecciona un `Project` canónico verificablemente del mismo tenant, comprueba identidad y alineamiento, y confirma un vínculo durable desde el WorkItem. No modifica owner, Steps, progreso ni evidencias del Project.

**REGISTER_EXISTING:** una persona autorizada confirma que el WorkItem representa una iniciativa preexistente que debe gestionarse dentro de Startería. Una factoría específica de incorporación genera `Project` canónico **sin Steps, miembros ficticios ni ciclos activos**, y crea la relación documental y `InitiativePortfolioMeta` en una misma transacción. No reutilizar `ProjectService.createProject` mientras su comportamiento incluya creación de Steps/equipo.

Navegar, seleccionar, cancelar, abrir el Brief o guardar Assignment nunca activa estos comandos. Confirmar incorporación y guardar Assignment son operaciones independientes.

### 3.2 Ownership: pendiente sin identidad fabricada

**Decisión aprobada de producto:** permitir la incorporación con responsable de ejecución todavía no aceptado. El Portfolio Lead no se convierte en `Project.ownerId` por ser quien incorpora o asigna; tampoco se crea un usuario ficticio por introducir un email. Conservar `actor/createdBy` separado de `owner`.

Esto exige una evolución controlada del modelo actualmente obligatorio:

- organización/tenant como pertenencia canónica explícita de `Project`, independiente de `ownerId`;
- permitir `ownerId` pendiente exclusivamente para iniciativas incorporadas aún no aceptadas, con guards en sus consumidores;
- expresar `proposed recipient` en el Assignment existente, no como owner operativo ya confirmado;
- resolver/elaborar el owner efectivo solo mediante evento humano autorizado de claim/aceptación bajo Handoff, sin desencadenar Start ni Steps.

**Alternativa evaluada y no elegida:** exigir `ownerId` activo del mismo tenant al incorporar. Podría acelerar un piloto interno con usuarios ya registrados, pero bloquea la designación a responsables todavía no incorporados a Startería. Si se elige esta alternativa, explicitar esa limitación de MVP y exigir que Project owner y responsable del encargo no se contradigan silenciosamente.

### 3.3 Estado y gating retroactivo

Una iniciativa importada **no comienza `en_step_0` por defecto**. Establecer estado explícito de incorporación/activación `OWNER_PENDING` o equivalente compatible, más una evaluación retroactiva `PENDING_RETROACTIVE_ASSESSMENT`, separada de la posición Step. Las etiquetas exactas deben alinearse con el vocabulario de estado existente; no introducir nuevas ramas de Steps por conveniencia de UI.

- Registrar lo conocido, evidencia/correspondencia tentativa a Steps y vacíos materiales.
- Ningún Step se crea, completa ni aprueba automáticamente.
- `Start` y el inicio de un ciclo solo ocurren cuando el flujo posterior y la autoridad correspondiente lo permitan, con ownership y readiness verificados.
- Si hay consumidores que asumen `Step` siempre presente, adaptar sus estados vacíos/unknown explícitamente antes de habilitar `REGISTER_EXISTING`.

### 3.4 Relación durable y cardinalidad

Añadir o reutilizar una entidad equivalente a `PortfolioImportedInitiativeLink` que registre al menos:

- `organizationId`, `bootstrapSessionId`, `workItemId`;
- `projectId`, `challengeId` y modo `LINK_EXISTING | REGISTER_EXISTING`;
- snapshot/provenance de identidad, fuente, evidencias y decisión de alineamiento;
- actor, instante, versión/expectedVersion, fingerprint idempotente, auditoría y estado de reversión.

**Cardinalidad aprobada:** cada WorkItem tiene como máximo un vínculo activo a Project dentro de su organización; un Project puede ser referenciado por varios WorkItems documentales cuando la persona confirma que son evidencias del mismo trabajo, sin duplicar el Project. Un Project puede asociarse a uno o varios Challenges únicamente según la relación vigente autorizada por Core/Handoff: verificar su cardinalidad antes de implementar, sin ampliar silenciosamente reglas canónicas.

Reintentos con la misma identidad y fingerprint retornan el mismo vínculo/Project; fingerprint incompatible, doble correspondencia o cross-tenant generan conflicto explicable (p.ej. HTTP 409). Nunca deduplicar por título solamente.

**Reversibilidad:** poder revocar el vínculo documental sin borrar historia. Si ya hay Assignment u otras dependencias, no suprimir Project ni deshacer progresos automáticamente; escalar a una corrección humana auditada. Toda revocación mantiene los IDs y evidencia histórica.

### 3.5 Transaction boundaries

- `LINK_EXISTING`: validar WorkItem, Project, tenant, Challenge y rol; confirmar alineamiento; escribir vínculo y meta asociada solo si no existe conflicto, con auditoría e idempotencia.
- `REGISTER_EXISTING`: validar lo mismo y el no-duplicado; crear Project sin Steps, su tenant explícito, el vínculo documental y su meta en una transacción; recibo durable con `projectId/linkId`.
- `CREATE_ASSIGNMENT`: segundo comando existente en estado `CREATED` y target `EXISTING_INITIATIVE`, con `briefVersionId` exacta si parte del Brief confirmado; no Invitation, Send, Accept ni Start.
- Si el usuario incorpora pero sale antes de asignar, Project y vínculo confirmados persisten; la UI lo explica.
- Si una operación falla o es cancelada antes de confirmación, no persiste media incorporación.

## 4. Experiencia MVP propuesta (sin pantallas de gobernanza extensas)

1. **Agregar asignación** (CTA principal visible).
2. Elegir una iniciativa realmente asignable o un registro identificado en documentos; si el registro es documental, mostrar **breve revisión de identidad/procedencia y confirmación** de vincular/incorporar (sin callejón de botones inactivos).
3. Elegir correo del responsable y hasta dos colaboradores; cuando falta cuenta aceptada, marcar destinatario previsto y estado de aceptación pendiente, no owner operativo confirmado.
4. Revisar la información precargada del Challenge, BriefVersion exacta, iniciativa, evidencia disponible y gaps; personalizar `contextNote` sin mutar Brief.
5. Guardar `CREATED`; repetición incremental, sin cuotas ni envío.

La vista puede informar «5 registros relacionados identificados; todavía por incorporar» sin confundirlos con cinco Projects asignables. Revisar su fuente de clasificación y distinguir los otros tres.

## 5. Orden de implementación propuesto, condicionado a GO

**S0a — ADR aprobado y S0_GO de reconciliación**: la autoridad humana de producto confirma ownership pendiente, pertenencia tenant explícita, modalidad sin Steps, estados de assessment y cardinalidad/revocación. Codex verificará el contrato vigente del checkout, plan de migración y consumidores. Solo en ausencia de contradicción material se habilitan escrituras focales EN BASE DE DATOS DESECHABLE (nunca tenant visual original).

**S1 — modelo/persistencia**: migración focal con backfill `organizationId` de Projects existentes, sin cambiar semánticas de otros tenants; entidad lineage, representación del owner pendiente y evaluación retroactiva; tests de datos y rollback plan. Cualquier inconsistencia de backfill bloquea migración.

**S2 — backend/commands**: LINK_EXISTING y REGISTER_EXISTING humanos e idempotentes, tenancy, transacciones, auditoría y garantías de que no se crean Steps. Tests de concurrencia, dedup y error.

**S3 — experiencia integrada PL-06A**: selector y revisión mínima, confirmación humana de incorporación y formulario/bandeja existentes, guardado exacto, re-entry.

**S4 — pruebas E2E disposable**: trabajo documental→Project→Assignment, vinculación a Project preexistente, abandono tras incorporar, cancelación, duplicados, cross-tenant, recipient sin cuenta, 0 Steps/Invitations/Emails, 1440/768/390/360, multi-Brief y regreso.

**S5 — aceptación humana**: demo en un tenant aislado con un WorkItem realista y un Project importado auténtico. No convertir los ocho WorkItems del tenant visual original sin autorización específica de datos. PL-06B sigue fuera de alcance.

## 6. Decisiones aprobadas por la autoridad humana de producto

1. Owner obligatorio vs provisional: **aprobada ausencia de owner operativo hasta aceptación** (requiere adaptar `Project.ownerId` y consumidores; no asignar falso owner).
2. Project con 0 Steps: **sí**, exclusivamente como iniciativa importada todavía no activada.
3. Gating: **assessment retroactivo pendiente** y estado de activación distinto del Step.
4. Cardinalidad: **WorkItem → máximo 1 Project activo; Project ← múltiples WorkItems documentales**, respetando la cardinalidad vigente Project↔Challenge.
5. Reversibilidad: **revocación auditada del vínculo**, no borrado destructivo del Project.
6. Tenant: **organización explícita en Project**, no inferida solo de owner.

## 7. Límites y control de aprobación

- Este ADR **está aprobado en producto**. Autoriza implementación y migraciones focales únicamente en DB disposable *después* de que S0 confirme compatibilidad con los contratos vigentes y los consumidores. Cualquier conflicto material nuevo detiene ese subalcance y requiere una nueva decisión.
- Hay una tensión material por resolver en código entre `ownerId` obligatorio y la decisión recomendada de owner pendiente; requiere inventario de consumidores, compatibilidad y plan de migración antes de implementar.
- Leer y reconciliar las versiones realmente vigentes de Core/ADRs/Handoff en el checkout; la copia del Core disponible en esta revisión se identifica como **v0.3 candidata** y no sustituye la autoridad actual del repositorio.
- No staging/commit/push/PR/merge/deploy/RC; no reset/clean/restore/stash destructivo, no seeds ni migrations en bases persistentes del usuario; preservar WIP P12-R1.
- PL-05 frozen, PL-06B/Send excluido, aceptación visual humana separada, `STARTERIA_E2E=NOT_DONE`.

### Gate explícito necesario

**Autoridad de producto ya confirmada en este ADR.**

`ADR009_PRODUCT_APPROVED / S0_GO_RECONCILIATION`

`CANONICAL_WRITE_AUTHORIZED_FOR_DISPOSABLE_ENV_ONLY` se aplica al subalcance compatible después de la verificación S0 del checkout y su plan de migración/backfill. Si S0 descubre un conflicto con Core o ADRs superiores, detener la escritura afectada y documentar el cambio de autoridad requerido.

La autorización de operar sobre el tenant P12-R1 original es **otra aprobación de datos**, independiente; ninguna instrucción de este ADR permite alterarlo.
