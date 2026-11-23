# Startería — V4.2: Públicos y Propósito · Prototipo para revisión

Estado: `DESIGN_REFERENCE_ONLY`; no se modifica `front/`, `main`, ni KAN-257. Requiere revisión visual humana antes de trasladarlo a React.

## Base

Partimos del HTML completo `Starteria_Landing_V4_1_Centered_Hero.html`. En la V4.2 solo se modificaron dos secciones: `#para-quien` y el bloque de propósito (`#proposito`). Se preservaron el hero V4.1 centrado, la demo Estrategia/Ejecución/Resultados, Fab, impacto, FAQ y CTA. Esta referencia no implica aprobación de nuevos claims ni funcionalidades.

## 1. Público y madurez — nuevo tratamiento

**Encabezado:** `Empieza donde estás. Avanza a tu manera.`

**Subtítulo:** `Desde una mejora puntual hasta iniciativas entre distintas áreas, Startería adapta el acompañamiento a tus necesidades y recursos.`

**Composición:** espacio editorial de dos columnas en desktop; módulo oscuro protagonista para equipos de innovación y transformación, con representación de áreas alrededor de una visión de portafolio; a la derecha dos superficies compactas para pequeños negocios y pymes, cada una con un icono semántico de trazo SVG y una mini-secuencia propia. En móvil los tres casos se apilan con la misma jerarquía de información; no se presenta progresión obligatoria de madurez.

**Copys:**
- *Equipos de innovación y transformación*: `Conecta más equipos. Sin perder el foco.` + `Alinea objetivos, coordina iniciativas entre áreas y convierte los avances en decisiones compartidas.`
- *Pequeños negocios*: `Una necesidad. Una prueba concreta.` + `Empieza con una mejora acotada y una ruta sencilla para comprobar si funciona.`
- *Pymes en crecimiento*: `De la mejora a una solución real.` + `Ordena prioridades, prueba alternativas y suma capacidad de desarrollo cuando haga falta.`

## 2. Propósito — nuevo tratamiento

**Titular:** `Que innovar no dependa de tener un gran equipo.`

**Subtítulo:** `Queremos que más empresas puedan poner sus oportunidades a prueba, desarrollar soluciones y aprender de sus resultados, con orientación y criterio.`

**Firma:** `Democratizar la innovación desde el hacer.`

**Visual:** manifiesto editorial en tres franjas numeradas, sin círculos orbitales ni métricas inventadas:
1. `Más personas que pueden proponer.`
2. `Más equipos capaces de probar.`
3. `Más aprendizaje que permanece.`

## Decisiones de diseño

- Evitar tres tarjetas repetidas y símbolos decorativos que nadie comprende.
- Elegir una pieza protagonista y dos complementarias **porque** el primer foco comercial definido son equipos corporativos con iniciativas existentes; no excluir pymes ni pequeños negocios.
- Usar la diferencia de escala para aportar jerarquía, no para sugerir tres productos ni tres fases de adopción.
- No introducir logos falsos de clientes, cifras, resultados garantizados ni integraciones no verificadas.
- Mantener coherencia del color violeta Startería; el propósito tiene un ritmo editorial diferente del bloque técnico Fab y del CTA final.
- Hacer la UI con CSS y SVG editables, sin imágenes de texto ni nuevas librerías.

## Verificación realizada

Playwright Chromium con contenido HTML inline, capturas de ambas secciones en 1440 / 1024 / 768 / 390. `document.documentElement.scrollWidth == viewport width` en los cuatro tamaños. Cero errores JS observados. Para las capturas de las secciones se desactivó temporalmente el sticky header **solo en la página de pruebas**, a fin de evitar que tapara el contenido; el archivo HTML distribuido conserva su header.

Pendiente: auditoría formal axe/WCAG de contraste y tests de comprensión con usuarios; revisión visual humana; decisión de aplicación a React y autorización del slice correspondiente. No se revisó directamente la página `oneads.ai/early-bird`, cuya carga no estaba disponible: se tomó su intención visual como referencia expresada por producto y se contrastaron patrones generales con la home pública de OneAds.

## Para Codex, después de aprobación visual

1. Leer `AGENTS.md`, ADR-011, KAN-257 y Manifest; confirmar autorización de esta iteración.
2. Transferir solo las dos secciones a la landing React; no copiar todo el HTML V4.2 sobre `LandingPage.tsx`.
3. Preservar ID/anchors, navegación, CTA existente y ausencia de `/public/start`.
4. React accesible + CSS scoped + SVG semánticos + responsive 390, 768, 1024, 1440.
5. Generar capturas y comparar contra `v42_segmentos_*.png` y `v42_proposito_*.png` antes de PR.
6. No merge ni CD automático.
