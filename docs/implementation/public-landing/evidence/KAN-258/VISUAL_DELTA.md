# KAN-258 — Visual delta V4.2

Baseline: `docs/design-references/landing-v4-2/Starteria_Landing_V4_2_Secciones.html` y sus capturas
consolidadas aprobadas.

| Área | 1440 | 1024 | 768 | 390 | Resultado |
| --- | --- | --- | --- | --- | --- |
| Hero centrado | Misma jerarquía de tres líneas | Tres líneas como baseline compacto | Reflow de dos líneas equivalente | Reflow móvil equivalente | PASS |
| Mapa amplio | Nodos, hub, conexiones y retorno preservados | Composición completa | Escala sin recorte | Flujo vertical legible | PASS |
| Demo Estrategia | Canvas, tabs y contenido equivalentes | Dos columnas | Dos columnas | Una columna | PASS |
| Ejecución | Guía contextual, equipo/Fab y autoridad humana | Equivalente | Equivalente | Apilado legible | PASS |
| Resultados | Métricas ficticias, decisión y memoria | Equivalente | Equivalente | Apilado legible | PASS |
| Impacto/Fab | Jerarquía y contraste equivalentes | Equivalente | Dos columnas Fab | Una columna | PASS |
| Públicos/FAQ/Propósito | Asimetría y ritmo equivalentes | Asimetría adaptada | Reflow aprobado | Una columna | PASS |
| Conversión/footer | CTA y cierre equivalentes | Equivalente | Equivalente | Sin overflow | PASS |

## Correcciones realizadas tras comparar

1. El estado capturado se fijó en Estrategia para compararlo con las capturas full del baseline.
2. Se añadieron capturas focales de Ejecución y Resultados en 1440 y 390.
3. Se fijaron saltos editoriales distintos para escritorio ancho y compacto, reproduciendo las tres
   líneas exactas del baseline a 1440 y 1024 sin alterar el reflow natural de dos líneas a 768.

## Diferencias residuales aceptadas

- Puede existir variación subpíxel de rasterizado y antialiasing entre el HTML de referencia y
  Chromium/Vite con la fuente disponible en la aplicación.
- Los controles React son funcionales y mantienen estado, mientras que la captura de referencia es
  un artefacto estático; la geometría y la semántica visibles se conservan.

No queda ninguna diferencia visual material conocida en los viewports contratados.

