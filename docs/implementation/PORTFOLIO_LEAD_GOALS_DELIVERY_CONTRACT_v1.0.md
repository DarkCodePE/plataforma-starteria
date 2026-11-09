# STARTERÍA — Portfolio Lead · Programa de entrega por Goals v1.0

**Fecha de corte:** 2026-11-09  
**Estado:** operativo como propuesta de ejecución; no se promueve ningún contrato Core/ADR ni autoriza deploy.  
**Alcance:** Portfolio Lead Inicio → E1/E2 → E3/E7 → gobernanza continua.  
**Autoridad:** `docs/STARTERIA_AUTHORITY.md`; Core factual v0.2, ADR aprobados, Experience Contracts aprobados. Los PRDs/HTML son referencias subordinadas.

## Cambio de metodología

El resultado de trabajo ya no es «PR fusionado» ni «componente presente». Es un **Goal funcional aprobado** a través de una experiencia E2E reproducible. Se permite que un Goal incluya varios commits y PR; no se permite dividir la responsabilidad de su resultado entre tickets sin evidencia integrada.

Codex/agente puede: auditar, planificar, implementar, probar, corregir, publicar PR y proponer merge. No puede: ratificar ADR por sí mismo, habilitar un proveedor de IA sin autorización, promover Core candidato, desplegar sin autorización, crear iniciativas o Steps automáticamente ni declarar QA de navegador inexistente.

## Goals y dependencias

| Goal | Issue | Resultado de negocio verificable | Dependencia |
| --- | --- | --- | --- |
| G01 Consolidación estable | [#291](https://github.com/DarkCodePE/plataforma-starteria/issues/291) | Toda la nueva E2 en main, CI PASS y autoridad conciliada | Ninguna |
| G02 Inicio/E1/E2/E3 usable | [#292](https://github.com/DarkCodePE/plataforma-starteria/issues/292) | Conversación funcional con revisión y handoff E3 | G01 |
| G03 E3/E7 ejecución | [#293](https://github.com/DarkCodePE/plataforma-starteria/issues/293) | Iniciativas y no-work hasta briefs/asignación real | G02 |
| G04 seguimiento | [#294](https://github.com/DarkCodePE/plataforma-starteria/issues/294) | Portafolio gobernable con alertas y resultados medidos | G03 |

Los preparativos de tests/UX pueden solaparse; la declaración DONE no.

## Estado factual al arranque

- main: `dfd1ac44bf6e21ff56f2c5de14326e0b687a5358` (KAN-250/251/252, KAN-253 B1–B3, UX-01; flags B3 OFF por defecto).
- PR #281 abierto DRAFT, base main, contiene UX-02, #282 UX-03 y #283 B4-A.
- PR #284 abierto DRAFT, base rama #281; contiene B4-B, #285 C1, #286 C2A, #287 C2B, #288 C2C y #289 C2D.
- PR #290 abierto DRAFT, base rama #284. Test PostgreSQL E1→E2→E3 añadido. CI [42627424815](https://github.com/DarkCodePE/plataforma-starteria/actions/runs/42627424815) SUCCESS en su rama; NO browser QA.
- PR #281 y #284: ninguna review registrada en consulta. `doc/product-adr/ADR-010-portfolio-e2-goal-turn-ledger.md` sigue `PROPUESTO / PENDIENTE DE RATIFICACIÓN`.
- CI de #284 rama HEAD `f68f4ba26848762d42f299cb84f0bff136b5cf85`: SUCCESS [42626047150](https://github.com/DarkCodePE/plataforma-starteria/actions/runs/42626047150).
- Merge en rama != merge en main != CD != QA UX real. No hay evidencia del rollout de flags ni semántica live E2.

## Contrato de ejecución de cada Goal

### 0. AS-IS real y autoridad
- Leer Core/ADRs/Experience Contracts y ADR abiertos; no escoger silenciosamente una fuente contradictoria.
- Localizar componentes frontend, endpoints, modelos, flags, migraciones, hooks y tests.
- Capturar pruebas visuales reales, si hay navegador autenticado; etiquetar lo no verificable.
- Prohibido presentar el HTML prototipo o datos demo como pantalla o resultado de negocio en producción.

### 1. TO-BE visual por tarea
- Antes de modificar UX, producir una comparación AS-IS → TO-BE comprensible.
- Explicar la acción del usuario, transición de estado, fuente de datos, permisos, feedback y recuperación.
- Aplicar los diez principios de Nielsen (heurística, severidad 0–4, evidencia, remediación); no confundir inspección con testing de usuarios.

### 2. Implementación integral con guardrails
- Trabajar sobre una sola base gobernada y ramas de PR limpias, sin worktrees innecesarios.
- Preservar Inicio overview-first y reentrada; no forzar siete pasos cuando no aportan valor.
- Diferenciar declarado, inferido, provisional, confirmado, rechazado, stale y desconocido.
- Backend valida permisos, versiones, idempotencia, provenance y reentrada; frontend no inventa preguntas ni estado.
- E2 nunca crea automáticamente Front, Challenge, Project, Initiative, Step o asignación.

### 3. QA técnico + funcional + UX
- Lint/typecheck/test unitarios backend/frontend; integración PostgreSQL; E2E autenticado en entorno controlado; regresiones.
- Pruebas sobre los tres perfiles: emprendedor sin equipo/iniciativas, pyme con pocas, corporate con muchas.
- Rutas alternativas: corrección, no lo sé, no aplica, rechazo, caída de red, reentrada, multi-tab/CAS, permisos, sin iniciativas.
- Nielsen: completar una matriz por Goal con los 10 hallazgos o N/A justificados, sin severidades altas abiertas.
- Medidas UX: task success, errores bloqueantes, tiempo hasta comprensión del siguiente paso y accesibilidad básica (teclado, focus, labels y alertas).
- Referencia visual: `STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html`, subordinada a contratos y al código validado.

### 4. Definición objetiva de DONE

Un Goal solo puede cerrarse si:
1. Escenarios definidos pasan en pruebas reales, con evidencia y SHA.
2. Funcionalidad integrada en main; CI post-merge verde; revisión independiente y aprobación humana necesarias.
3. Reentrada y control humano verificados sin escrituras no autorizadas.
4. QA visual AS-IS/TO-BE y checklist NN/g sin hallazgos críticos abiertos.
5. Entorno claramente indicado: **main integrado**, **staging verificado**, o **producción verificada**. No inferir despliegue de merge.
6. Reporte de entrega: `IMPLEMENTED`, `VERIFIED`, `DEPLOYED`, `UX_ACCEPTED` con sus evidencias o `BLOCKED` con causa exacta.

## Ejecución concreta de G01

**Trabajo inmediatamente ejecutable:**
1. Reconciliar ADR-010 como propuesta que exige ratificación humana. Registrar gap de autoridad y no activar flags.
2. PR #281: revisión del diff contra main, CI, y solicitar review. Resolver hallazgos. Fusionar solo si merge autorizado.
3. PR #284: después de #281, actualizar base a main, comparar SHA/diff y CI completos. Solicitar review y fusionar si aprobado.
4. PR #290: después de #284, actualizar base a main; ejecutar integración PostgreSQL en CI, review y fusionar.
5. Verificar estado postmerge de main: CI, backend/frontend, baseline, flags OFF, operaciones de E1→E3.
6. Producir informe actual vs objetivo, bloqueo, y plan de smoke autenticado antes de activar nada.

**Dependencias de salida no satisfechas en el corte:** 2 PR DRAFT sin reviews, ADR-010 no ratificado, falta QA navegador autenticado y evidencia CD.

## Quality gate explícito

Ninguna funcionalidad queda marcada como terminada por:
- UI mock/fake o respuesta sintética.
- Test unitario sin prueba de integración cuando existe escritura.
- CI verde de rama que no sea main.
- Merge a rama padre.
- Toggle experimental encendido sin verificación de compatibilidad backend y rollout.
- Prototipo visual sin persistencia.

## Formato de reporte después de cada Goal

```text
GOAL:
MAIN_SHA:
IMPLEMENTED: yes/no + paths/PR
VERIFIED: unit/integration/e2e/browser/NNg + evidence
DEPLOYED: no/staging/production + environment evidence
UX_ACCEPTED: yes/no + findings
BLOCKERS: exact authorization, ADR, CI, product, UX
NEXT_GOAL:
```
