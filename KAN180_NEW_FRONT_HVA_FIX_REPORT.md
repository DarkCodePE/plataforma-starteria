# KAN-180 — corrección de nuevo frente — reporte HVA

Fecha: 2026-10-25  
Autoridad: contrato funcional aprobado `STARTERIA_KAN180_NUEVO_FRENTE_CONTRATO_APROBADO_v0.1.md` y Jira KAN-180, comentario 10498.  
Worktree: `C:\Users\User\proyect-starteria\starteria-KAN-180-portfolio-lead-integration`  
Rama local: `feat/KAN-180-portfolio-lead-integration`  
HEAD sin modificar: `d72223150fffa2b54082c2496f1f1b854334b090`

## Resultado

La creación deliberada de un frente abre ahora una `PortfolioBootstrapSession` propia en `B1_ANCHOR`, mostrada como **1 de 7 — Contexto**, sin confirmaciones heredadas. El contexto organizacional confirmado sigue disponible, pero sólo bajo `sourceRefs.organizationalContextReference` con `reviewStatus: reference_only`.

El CTA único **«+ Crear nuevo frente estratégico»** está en el encabezado de Portfolio Overview: a la derecha en desktop y debajo del título, dentro del primer viewport, en tablet/mobile. No hay CTA primario duplicado al final.

La reentrada no se confundió con creación: reload, deep link y logout/login del mismo `bootstrapSessionId` recuperan su avance persistido. Una nueva intención genera otro ID; doble clic/retry de la misma intención converge en uno.

## Causa raíz comprobada

El snapshot WIP previo, preservado antes de esta corrección, demuestra dos causas en `backend/modules/portfolio-bootstrap/portfolio-setup-completion.service.ts`:

1. Líneas 104–116 del snapshot: `openAdditionalFront` recuperaba cualquier sesión incompleta reciente del actor/organización. No distinguía reentrada de una intención nueva.
2. Líneas 132–157 del snapshot: una sesión creada arrancaba directamente con `status: awaiting_work_intake` y `bootstrapPhase: B2_WORK_INTAKE`; además copiaba `contextSummary`, `businessSignalStatus`, `confirmedBy` y `confirmedAt`, y creaba el ancla como `anchor_confirmed`.

El front calcula el stage a partir de ese estado real. Por eso mostraba 3/7: no era un fallo puramente visual ni un `bootstrapSessionId` viejo; el backend persistía el scope nuevo ya en B2 y con Contexto/Objetivo confirmados por herencia.

La implementación corregida está en el mismo servicio, líneas 90–210: requiere una clave de intención, crea un ID determinístico scoped por actor + organización + intención, persiste `B1_ANCHOR`/`anchor_insufficient`, deja `contextSummary`, `confirmedBy` y `confirmedAt` nulos y conserva la información previa exclusivamente como referencia. El ID anterior nunca se sobrescribe.

## Cambios focales

| Archivo | Cambio |
|---|---|
| `backend/modules/portfolio-bootstrap/portfolio-setup-completion.service.ts` | Separación create/resume, B1 real, referencia organizacional no confirmada, aislamiento actor/tenant e idempotencia durable ante carrera. |
| `backend/modules/portfolio-bootstrap/portfolio-bootstrap.controller.ts` | Transporta `Idempotency-Key` al caso de uso. |
| `backend/modules/portfolio-bootstrap/__tests__/portfolio-bootstrap.router.test.ts` | Contrato HTTP de la clave de intención. |
| `backend/modules/portfolio-bootstrap/__tests__/portfolio-setup-completion.service.test.ts` | Scope nuevo 1/7, referencia sin confirmar, replay misma intención e IDs distintos para intenciones distintas. |
| `backend/modules/portfolio-bootstrap/__tests__/portfolio-setup-completion.http.e2e.test.ts` | PostgreSQL real: tenant, idempotencia y ausencia de Front/Project/Step/BriefVersion/Assignment/email implícitos. |
| `front/src/app/pages/PortfolioLeadHomePage.tsx` | Mantiene la misma clave en retry incierto; la limpia sólo tras éxito. |
| `front/src/features/portfolio-lead/bootstrap/services/portfolioBootstrapClient.ts` | Envía la clave de intención al endpoint canónico. |
| `front/src/features/portfolio-lead/home/PortfolioOverviewHome.tsx` | CTA único en header y breakpoints 1440/768/390/360 sin compresión ni overflow. |
| `front/src/features/portfolio-lead/bootstrap/components/PortfolioBootstrapHome.tsx` | Presenta el contexto global como referencia, explicita que aún no está confirmado para el frente y bloquea la navegación local a etapas futuras para que el sidebar no pueda fabricar progreso. |
| Tests front asociados | Posición/unicidad del CTA, 1/7 sin checks, imposibilidad de adelantar el progreso sólo desde UI, reentrada 3/7 y retry con la misma intención. |
| `front/e2e/kan180-new-front-fix-acceptance.cjs` | HVA real específica de la corrección. |
| `front/e2e/kan171-home-visual-acceptance.cjs` | Alinea la regresión existente con el contrato aprobado: nuevo frente 1/7 y referencia organizacional. |

No se cambió Core, ADR, esquema Prisma, migraciones, Manifest ni `CURRENT_STATE.md`. Tampoco se tocó KAN-179 Owner→Steps.

## Estado persistido observado

Infraestructura desechable KAN-180: organización `pl06b-e2e-org`, PostgreSQL `starteria_kan180` en puerto 55452 y Mailpit en 1030/8030. Los puertos protegidos 55434/55444 no se usaron.

| Caso | bootstrapSessionId real | Fase/estado persistido | Confirmación del scope |
|---|---|---|---|
| Scope histórico cerrado | `pl06b-e2e-bootstrap` | `B5_FIRST_READING`, `reading_published`, materialización intacta | `anchor_confirmed`, confirmador y fecha preservados |
| Scope creado y luego avanzado explícitamente | `portfolio-additional-02eebab535cb28ad15868f8eab409cbf` | nace en `B1_ANCHOR` 1/7; tras respuesta + confirmación queda `B2_WORK_INTAKE` 3/7 | confirmación nueva del propio scope; referencia al histórico sigue `reference_only` |
| Segundo clic deliberado | `portfolio-additional-81df9104142b2210606d01c10ad479e4` | `B1_ANCHOR`, `awaiting_anchor_review`, 1/7 | `anchor_insufficient`; `contextSummary`, `confirmedBy`, `confirmedAt` nulos |
| Activación por teclado y cierre canónico | `portfolio-additional-aae99782c46084a73f98afb5ccf87f2a` | nace en `B1_ANCHOR` 1/7 y termina por acciones explícitas en `B5_FIRST_READING`, `reading_published` | confirmaciones pertenecen al scope nuevo; materializa un frente adicional sin alterar el histórico |

Los scopes nuevos tenían `existingWorkStatus: unknown`, cero fuentes de incorporación y cero materializaciones al abrir. La integración HTTP tomó contadores antes/después y verificó igualdad para StrategicFront, Project, Step, Challenge, TeamMember, ChallengeActivationBriefVersion y PortfolioHandoffAssignment. El scope histórico siguió accesible y completo. El acceso cruzado devolvió 403; un actor de otra organización no pudo leer el scope nuevo.

El cierre canónico del scope activado por teclado creó primero el análisis `cmvmyetuj0071vxkc2r9byk1f`, resolvió sus propuestas y publicó la lectura v1 `cmvmyeu1k0085vxkcsvivju1b`. Sólo después materializó de forma explícita el frente `cmvmyeu33008cvxkcnxt3rw70`, su Challenge `cmvmyeu39008evxkcto1ge5mn`, Brief `cmvmyeu42008ivxkc9en81x8y`, BriefVersion `cmvmyeu4e008kvxkcfgc1uu1o` y Assignment `cmvmyeu6r008qvxkc6mu0rr9e`. Portfolio Overview mostró después **3 frentes visibles**, 2 Projects canónicos y 6 Assignments persistidos, incluyendo el frente histórico intacto y los artefactos de las ejecuciones anteriores en la base desechable.

## Evidencia visual y de navegador

URL: `http://127.0.0.1:5198/portfolio/inicio`  
Credenciales efímeras, sin secretos en este reporte: `C:\Users\User\proyect-starteria\kan180-runtime\credentials.env`

Evidencia estructurada: `artifacts/KAN-180/new-front-fix/kan180-new-front-fix-evidence.json`

Capturas:

- `01-overview-header-cta-desktop-1440.png`: CTA único en header, visible sin scroll.
- `02-new-scope-1-of-7-desktop-1440.png`: Contexto 1/7 y referencia organizacional sin checks heredados.
- `03-existing-draft-3-of-7.png`: el mismo ID reanudado en su progreso auténtico.
- `04-overview-header-cta-tablet-768.png`: header legible y CTA dentro del card.
- `05-overview-header-cta-mobile-390.png` y `06-overview-header-cta-mobile-360.png`: CTA visible bajo el título y sin overflow.
- `07-overview-multi-front-after-second-close.png`: el frente histórico y el segundo frente materializado conviven en Overview.

El recorrido final produjo 13 checks verdes: CTA único, creación 1/7, doble clic idempotente, reload, nueva intención distinta, reentrada 3/7, logout/login, responsive, teclado, cero correo implícito, transición real B3 análisis → B4 revisión → B5 lectura publicada y convivencia multi-frente. Los dos 401 registrados son el refresh esperado antes de cada login; se validaron como no relevantes. Mailpit permaneció en `5 → 5` durante creación/reentrada y pasó a `6` únicamente al ejecutar el envío explícito del flujo canónico.

La regresión HVA completa del mismo worktree permanece en `artifacts/KAN-180/portfolio-lead-integration/`: cierre humano 7/7, cancelación/confirmación por teclado, Overview real, reload, logout/login, navegación Portfolio Lead y estado `2 SENT + 2 CREATED`. El recorrido focal sí completó además un segundo scope de punta a punta para demostrar con datos reales la convivencia de dos frentes y una única invitación solicitada explícitamente.

## Verificación ejecutada

| Comando/recorrido | Resultado |
|---|---|
| Tests focales backend | PASS — 22/22 |
| Tests focales front | PASS — incluye 29/29 del componente bootstrap |
| `npm run test:backend` | PASS — 186 archivos; 1648 tests passed, 29 archivos/134 tests skipped por flags |
| `npm run test:front` | PASS — 123 archivos, 967 tests |
| HTTP + PostgreSQL + Mailpit de nuevo scope | PASS — 3/3 |
| Chromium HVA corrección | PASS — 13 checks, 7 capturas, 1440/768/390/360 |
| `node --check front/e2e/kan180-new-front-fix-acceptance.cjs` | PASS |
| `npm run typecheck:front` | PASS |
| `npm run typecheck:backend` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; sólo warnings conocidos de chunks/imports dinámicos |
| `npm run build:backend` | PASS |
| `npx prisma validate` con DB desechable | PASS |
| `npx prisma migrate status` con DB desechable | PASS — 62 migraciones, esquema al día |
| `git diff --check` | PASS |

Un primer `prisma validate` sin `DATABASE_URL` terminó con P1012 por configuración del CLI; se repitió con la URL de la DB desechable y quedó verde. No fue un fallo de schema ni produjo cambios.

## Revisión independiente

El revisor Starteria de sólo lectura aprobó en ronda 3 (`verdict approved`) sin hallazgos bloqueantes, altos, medios ni bajos. Las rondas anteriores detectaron y permitieron corregir antes de la entrega: navegación local capaz de aparentar progreso, evidencia incompleta de convivencia multi-frente, contadores DB insuficientes y un cierre de prueba que inicialmente omitía Análisis/Primera lectura. La evidencia final verificada en PostgreSQL dejó el scope `portfolio-additional-aae99782c46084a73f98afb5ccf87f2a` en `B5_FIRST_READING`, `reading_published`, con un análisis, una lectura y `setupCompletedAt`.

## Protección del WIP y Git

El backup previo sigue verificable en `C:\Users\User\proyect-starteria\kan180-snapshots\20261024-pl06-d1-d10`:

- `tracked-wip.patch`: SHA-256 `D056E3BE928F7A28BF484F5E135205D2564E7148CA57EFD14205BB8C5BA2DEDF`
- `untracked-wip.tar.gz`: SHA-256 `BACD4C9F457952070237FADF711528647955244DF7285395BF820EDC276E0962`

Estado final:

- el HEAD sigue en `d72223150fffa2b54082c2496f1f1b854334b090`;
- `git diff --cached --name-only` está vacío;
- el worktree conserva todos los cambios tracked/untracked PL06-D1-D10 y los artefactos KAN-180;
- no se ejecutó reset, clean, rebase ni checkout destructivo;
- no se hizo staging, commit, push, PR, merge ni deploy;
- los demás worktrees protegidos sólo se listaron, sin escrituras.

## V2_CHANGE_CLOSURE_CHECK — preaceptación

- Slice/autoridad: KAN-180, contrato aprobado y comentario Jira 10498.
- Semántica: nuevo scope contextual real; organización global sólo como referencia; autoridad humana preservada.
- Invariantes: sin creación implícita de Challenge, BriefVersion, Assignment, Project o Step; sin correo al abrir/reentrar; única entrega al solicitarla explícitamente; tenant server-side.
- Contratos/migraciones: compatibles; no se requirió Core, ADR ni Prisma.
- Evidencia: unit/contract/integration/build/browser disponible en este reporte y `artifacts/KAN-180/new-front-fix`.
- Revisión: `approved` en la tercera ronda, sin hallazgos abiertos.
- Estado: listo para aceptación visual humana local; no integrado ni desplegado.
