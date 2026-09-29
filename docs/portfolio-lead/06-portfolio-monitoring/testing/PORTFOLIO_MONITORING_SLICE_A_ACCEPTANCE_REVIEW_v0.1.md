# Portfolio Monitoring — Slice A First Value
# Product / UX Acceptance Review v0.1

**Estado:** REVIEW DOCUMENTAL  
**Branch:** `feat/portfolio-monitoring-product-definition`  
**Reviewed SHA:** `61636e8d210af7d402257c70500983f3e0da6532`  
**Ruta revisada:** `/portfolio/setup`

## 1. Journey executed

Se ejecutó el journey real P0–P3 sin continuar a P4:

```text
P0 Primera visita
→ Preparar mi espacio
→ P1 definir objetivo estratégico
→ P2 añadir trabajo existente
→ Usar ejemplo NovaGrowth
→ procesamiento mock
→ P3 First Analytical Value
```

El CTA `Revisar cómo se relaciona` no se pulsó durante la revisión funcional. Se verificó su presencia, pero la revisión se detuvo antes del placeholder P4 como se solicitó.

## 2. Screens reviewed

Las capturas se generaron fuera del árbol versionado para mantener esta ejecución documental limitada al reporte:

- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S1-P0-first-visit.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S2-P1-strategic-intent.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S3-P2-existing-work.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S4-processing.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S5-P3-first-analytical-value-full.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S6-rationale-open.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S7-guide-2-of-5.png`
- `C:\Users\User\AppData\Local\Temp\starteria-slice-a-acceptance\S5-P3-mobile-390.png`

S5, S6 y S7 se generaron en página completa para revisar la jerarquía que continúa bajo el primer viewport. La comprobación mobile a 390px no detectó overflow horizontal (`overflow: 0`).

## 3. Acceptance criteria AC-SA-01 → AC-SA-15

| AC | Resultado | Evidencia observada |
|---|---|---|
| AC-SA-01 | PASS | P0 muestra `Preparar mi espacio` como CTA visual dominante. |
| AC-SA-02 | REVIEW | El cuerpo no exige taxonomía, pero el sidebar visible conserva Frentes, Retos e Iniciativas desde el primer momento. |
| AC-SA-03 | PASS | P1 ofrece textarea libre con la pregunta estratégica y no exige campos estructurados. |
| AC-SA-04 | PASS | P2 explica `No necesitas ordenarlo antes` y acepta texto pegado. |
| AC-SA-05 | PASS | `Usar ejemplo NovaGrowth` produce salida determinista con 7 iniciativas, 5 responsables y 3 agrupaciones. |
| AC-SA-06 | PASS | First Analytical Value aparece antes de confirmar estructura, ownership o setup completo. |
| AC-SA-07 | PASS | En P3 la interpretación y la lectura dominan visualmente sobre counts e inventario. |
| AC-SA-08 | PASS | Las agrupaciones están dentro de `Lectura Startería` y rotuladas `Propuesta Startería · no es una estructura confirmada`. |
| AC-SA-09 | PASS | Cada agrupación tiene `¿Por qué?`; el rationale es breve y no muestra chain-of-thought. |
| AC-SA-10 | PASS | Se usa `Responsables mencionados` y `Responsable mencionado`; no se presentan como confirmados. |
| AC-SA-11 | PASS | Se muestran exactamente 3 señales y la UI explicita `Máximo tres señales iniciales`. |
| AC-SA-12 | PASS | `Corregir lo que entendió Startería` devuelve al input para editar y regenerar el output provisional. |
| AC-SA-13 | PASS | P3 muestra `Tu guía de inicio · 2 de 5` con los dos primeros pasos completados. |
| AC-SA-14 | PASS | La CTA principal de salida es `Revisar cómo se relaciona`. |
| AC-SA-15 | PASS | La revisión no observó cambios en Core, Steps 0–4, Handoff, backend ni persistencia. |

**Resumen:** 14 PASS · 1 REVIEW · 0 FAIL.

## 4. Visual hierarchy assessment

### P0

`Preparar mi espacio` es inequívocamente el CTA principal. El copy explica correctamente que se empieza por lo que se quiere conseguir. `Empezar una iniciativa` existe como alternativa secundaria y no compite visualmente.

Hallazgo: el shell lateral muestra navegación de Frentes, Retos, Iniciativas, Actores y Reportes antes de iniciar el journey. No bloquea el flujo, pero mantiene un modelo mental paralelo al intent-first del prototipo.

### P1

La pregunta es clara, el input permite lenguaje natural y no aparecen campos de Frente, Reto o Initiative dentro del contenido principal. La guía lateral es compacta y comprensible.

### P2

La instrucción `No necesitas ordenarlo antes` es visible. Pegar información es el camino natural porque el textarea ocupa la superficie principal. `Subir información` aparece deshabilitado y se distingue visualmente como no disponible, aunque no explica el motivo con suficiente detalle.

### P3

La jerarquía observada es:

```text
Lo que entendió Startería
→ Lectura Startería / tres formas de mover el objetivo
→ Contexto detectado y señales
→ Trabajo detectado como inventario de apoyo
```

La superficie no se percibe principalmente como dashboard ni como formulario corporativo. Sí conserva una apariencia de prototipo guiado por la combinación de shell estratégico, guía 2/5 y fixture visible, pero esto es coherente con el contexto de testing.

La densidad es razonable en el primer viewport. La pantalla completa requiere scroll para revisar todo el inventario y todas las señales; esto es aceptable para desktop, pero debe validarse antes de usarla con portfolios mayores.

### Responsive y Design System

- 390px: sin overflow horizontal.
- Cards, botones, textarea, tipografía, spacing y estados mantienen consistencia con los primitives existentes.
- En mobile la revisión detallada de la lectura se vuelve más larga verticalmente; no se observó ruptura funcional.
- No se creó un Design System paralelo.

## 5. First Value assessment

**Clasificación: STRONG_FIRST_VALUE**

En P3 el usuario ve información que no estaba explícita como estructura en su input:

- una lectura de tres momentos: generar, trabajar y convertir oportunidades;
- una distribución interpretada de las 7 iniciativas en esos momentos;
- una señal de concentración cuya intencionalidad queda abierta;
- dos iniciativas sin responsable claro;
- la dependencia de Lead Assistant con datos CRM;
- rationale auditable para cada agrupación.

La UI separa razonablemente:

- `Declarado por ti` para la intención;
- `Encontrado en la información` para señales, counts e inventario;
- `Lectura Startería` para interpretación y grouping.

La combinación `Declarado por ti · Basado en lo que añadiste` podría ser más nítida, pero no impide comprender la diferencia entre dato e interpretación.

## 6. Deviations assessment

| Desviación | Clasificación | Observación |
|---|---|---|
| `/portfolio/setup` aislada | ACCEPTABLE_FOR_PROTOTYPE | Protege `/portfolio/iniciar` y la Home existente mientras se valida el journey. |
| Upload disabled | ACCEPTABLE_FOR_PROTOTYPE | El camino canónico de test es pegar o usar NovaGrowth; conviene explicar mejor la indisponibilidad antes de un test amplio. |
| Copilot omitido | ACCEPTABLE_FOR_PROTOTYPE | P0–P3 se puede validar sin dependencia de chat; el spec permite profundidad progresiva. |
| P4 placeholder | ACCEPTABLE_FOR_PROTOTYPE | Slice A termina explícitamente antes de Relationship Review. |

Ninguna desviación es blocker para la revisión de Slice A.

## 7. UX issues

1. La navegación lateral heredada expone Frentes, Retos e Iniciativas durante un journey que pretende retrasar esa taxonomía.
2. El botón `Subir información` disabled no comunica por qué no está disponible ni si se habilitará más adelante.
3. La provenance es correcta, pero el label combinado de la interpretación podría separar mejor `Declarado por ti`, `Encontrado` y `Lectura Startería`.
4. La P3 completa exige scroll; el orden es correcto, pero el bloque de señales y el inventario deben seguir subordinados cuando crezca el volumen.

## 8. Functional issues

No se observaron fallos funcionales en P0–P3.

Observación no bloqueante: la implementación no añade instrumentación de eventos del prototipo (`first_value_started`, `goal_submitted`, `existing_work_submitted`, `first_value_rendered`, `rationale_opened`, `relationship_review_clicked`). Para pruebas cualitativas puede bastar Playwright; para comparar sesiones deberá definirse antes de ampliar el prototipo.

## 9. Accessibility observations

- El textarea tiene label accesible real.
- Las acciones son botones semánticos y la rationale expone `aria-expanded`.
- El estado de procesamiento usa `aria-live`.
- El foco visible depende de los primitives existentes y no se realizó una auditoría automatizada axe en esta ejecución.
- El upload disabled se comunica visualmente por estado del botón; conviene añadir explicación textual o ayuda contextual si se mantiene.
- La guía usa color y texto/icono, por lo que el estado no depende únicamente del color.

## 10. Prototype-test readiness

**READY_WITH_FIXES**

Razón: el path P0–P3 es estable, reproducible y entrega First Value fuerte; no hay blockers. Antes de usarlo como base de Slice B conviene decidir cómo aislar la navegación heredada y mejorar la claridad de provenance/upload.

## 11. Exact fixes required before Slice B

No se aplican en esta ejecución. Para la siguiente decisión se requieren exactamente estas definiciones:

1. Decidir si el prototipo debe ocultar o reemplazar temporalmente el sidebar ontology-first en `/portfolio/setup`.
2. Añadir una explicación explícita al upload disabled o cambiarlo por una affordance de mock claramente etiquetada.
3. Separar visualmente los tres niveles de provenance sin aumentar ruido técnico.
4. Validar P3 con un fixture de mayor volumen y confirmar que insight > estructura > inventario se mantiene.
5. Decidir si Slice B necesita hooks de instrumentación del prototipo antes de incorporar Relationship Review.
6. Ejecutar una comprobación de accesibilidad automatizada antes de ampliar la superficie.

No se recomienda implementar Slice B hasta cerrar estas decisiones de aceptación. No se implementó P4 durante esta revisión.
