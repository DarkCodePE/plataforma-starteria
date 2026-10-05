# KAN-112 — Landing L3 Visual Freeze v0.1

**Estado del documento:** AUDIT + VISUAL FREEZE ONLY
**HU:** KAN-112 — Public Landing L3 — Visual Product Preview & Conversion Polish
**Fecha de auditoría:** 2026-10-05
**Superficie:** ruta pública /
**Alcance:** definición visual y plan de componentes, tokens, responsive, accesibilidad y pruebas.
**Implementación en esta fase:** NO. No se cambió código, copy congelado, rutas, Portfolio Entry, Core ni Steps.

## A. PRECONDITION

| Comprobación | Resultado |
|---|---|
| KAN-112 | En curso |
| HEAD | 90c44cf084b7035f128843f3cb56d0f141e581bd |
| origin/main | 90c44cf084b7035f128843f3cb56d0f141e581bd |
| HEAD == origin/main | Sí |
| Rama activa | feat/KAN-112-landing-l3-visual |
| Working tree antes del informe | Limpio |

La rama activa conserva el commit de origin/main; no había cambios previos en el árbol de trabajo.

## B. CURRENT_STATE

### Estado runtime observado

LandingPage compone la ruta pública con una sola página. Su estructura visible actual es:

1. Header sticky, navegación por anclas en desktop y acceso a /auth o /dashboard según autenticación.
2. Hero con el headline y los dos apoyos congelados, CTA directo existente a /auth y el modelo L2 debajo.
3. Bloque secundario de Portfolio Entry con copy opcional y CTA a /public/start. No monta el formulario dentro de la Landing.
4. Problema presentado como tres filas de texto en una superficie.
5. Value flow en cuatro cajas.
6. Impact cues en una zona oscura con cuatro cards.
7. Confianza en cuatro cards.
8. CTA final redundante al acceso existente.
9. No hay footer propio de Landing.

La composición transmite la tesis por texto, chips y cards. No presenta una lectura reconocible de un workspace que conecte una prioridad con trabajo, señales/evidencia, bloqueos y una decisión a preparar.

### Estado y límites de autoridad

- Jira KAN-112 y este encargo congelan los textos y relaciones indicados en la sección E. La tarea ordena respetarlos sin edición.
- ADR-006 está ACCEPTED y separa Landing, conversión comercial y Portfolio Entry. No autoriza por sí mismo cambios runtime ni rutas.
- El Core factual sigue siendo v0.2, Base fundacional revisada / Por validar. docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md está marcado candidato v0.3 por STARTERIA_AUTHORITY.md; no se usa como autoridad de producto.
- El Manifest menciona STARTERIA_LANDING_V4_IMPLEMENTATION_SPEC.md, pero el archivo no existe en este checkout. No se infiere ni se reutiliza contenido de esa referencia.
- La UX Spec está marcada DOCUMENTAL ONLY / Implementación autorizada: NO. Su copy y su orden no se promueven automáticamente por estar en el repo.
- El Design System Contract y Page Anatomy System consultados son drafts para validación; sus foundations y primitives existentes sirven como guía de diseño, no como promoción de autoridad de negocio.
- Los destinos de Demo y Early Access siguen RUNTIME_PENDING / BLOCKED_BY_DESTINATION. Se reserva un espacio en este documento; no se diseñan enlaces, botones deshabilitados ni rutas ficticias.

### Contenido congelado a preservar literalmente

- Hero: “Haz que la estrategia se haga realidad.”
- Apoyo principal: “Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.”
- Apoyo secundario: “Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.”
- Entry opcional: “Aclara qué quieres conseguir antes de decidir qué hacer.”
- CTA de Entry: “Quiero alinear mi objetivo primero”
- Value flow: “Define la meta → Alinea el trabajo → Hazlas realidad → Decide”
- Modelo L2: “Objetivos / Necesidades / Iniciativas / Equipos → Starteria → Foco / Coordinación / Evidencia / Decisión”

El CTA actual del camino Starteria a /auth (“Ya tengo claro qué quiero mover”) también permanece. El CTA de Entry sigue yendo a /public/start.

### Reconciliación de evidencias

**CONFLICT — copy y orden de la Landing**

- Contrato o requisito: KAN-112 congela el contenido anterior y fija el orden de la sección G.
- Documento actual: la UX Spec propone otro headline/supporting copy, presenta CTAs de Early Access/Demo y coloca Portfolio Entry antes de los caminos comerciales.
- Mismatch observado: ese copy, orden y destinos no coinciden con el alcance congelado de KAN-112.
- Riesgo: reemplazar copy congelado o renderizar destinos comerciales inexistentes.
- Tratamiento recomendado: KEEP para los textos congelados de KAN-112; seguir el orden de este freeze; reservar la zona comercial solo en documentación hasta que exista destino.
- Requiere ADR: no para el freeze visual acotado; cualquier cambio del contrato documental de Landing requiere decisión funcional separada.

**CONFLICT — auditor de estado anterior desactualizado**

- Contrato o requisito: KAN-102 y el runtime actual muestran Entry como CTA opcional hacia /public/start.
- Documento actual: STARTERIA_PUBLIC_LANDING_FRONTEND_CURRENT_STATE_AUDIT_v0.1.md describe el montaje de PortfolioEntryExperience en el Hero y afirma que no existía LandingPage.test.tsx.
- Mismatch observado: LandingPage actual no monta ese formulario y sí existe LandingPage.test.tsx, además de front/e2e/public-landing-l1.spec.ts.
- Riesgo: planificar una extracción o una migración de Entry que ya no corresponde al runtime.
- Tratamiento recomendado: KEEP el comportamiento actual de CTA y ruta; este informe toma código y tests actuales como evidencia factual y registra la obsolescencia del audit sin modificarlo.
- Requiere ADR: no; la reconciliación del documento histórico queda fuera del único archivo autorizado para esta fase.

## C. SECTION_AUDIT

| Sección | Clasificación | Problema actual | Objetivo visual | Riesgo semántico | Relación con Design System | ¿Componente nuevo? |
|---|---|---|---|---|---|---|
| A. Header | ADAPT | Header sticky genérico; anclas a secciones actuales que cambiarán de posición; navegación desaparece en móvil. | Marca y acceso existentes, navegación breve por anclas reales y foco claro sin competir con el Hero. | No ocultar el acceso real ni hacer que una ancla sugiera una ruta nueva. El sticky no debe tapar el foco al navegar. | Reusar Button y tokens neutrales/focus. Una acción dominante por superficie. | No se requiere primitive. Extraer LandingHeader solo si simplifica composición y tests. |
| B. Hero | ADAPT | Copy correcto, pero el área es una columna de texto; el CTA existente domina antes de que haya prueba visual del producto. | Mantener copy congelado, acción existente a /auth y jerarquía editorial. Reservar espacio para que el usuario vea producto cerca del primer pliegue. | No elevar Portfolio Entry a producto principal ni atribuir análisis al visitante. | Tipografía Display/Heading, spacing amplio, neutrales, brand-primary para una acción; foco visible. | LandingHero puede extraerse por composición y pruebas, sin API de contenido experimental. |
| C. PlatformStructure | ADAPT | L2 está expresado como ocho cajas pequeñas alrededor de Starteria; explica conceptos, no enseña el trabajo conectado. | Conservar los cuatro conceptos de entrada y cuatro resultados, en una composición simple y legible distinta del preview. | No convertir sus nodos en estado real, entidad canónica, Step o claim de automatización. | Mantener contenido estático, conectores neutrales e indigo muy limitado. No usar badges para cada etiqueta. | Puede conservarse como sección PlatformStructure/StarteriaModel; no es el preview nuevo. |
| D. Portfolio Entry opcional | ADAPT | Ya está separado y enlaza a /public/start, pero aparece antes de problema, flujo, señales y confianza, por lo que gana peso temprano. | Mover al final de las opciones; superficie compacta, secundaria y explícitamente opcional. Mantener ambos textos congelados y CTA actual. | Cambiar copy, ruta, interacción, lógica, analytics o framing de Entry excede alcance. No volver a embeber el formulario. | Surface neutral, un borde, CTA secondary/ghost; evitar gran bloque oscuro o un segundo botón primario. | OptionalPortfolioEntry como composición fina; no extraer ni cambiar PortfolioEntryExperience. |
| E. Problem section | ADAPT | Tres problemas son filas de texto en una card grande: lectura correcta, ritmo denso y poco visual. | Una sola ProblemFrame editorial con tres filas/señales conectadas; recortar ornamento, no añadir métricas. | No afirmar resultados de negocio ni nuevos claims verificables. | Card única estructural, divider, cuerpo legible y sin cards anidadas. | ProblemFrame local solo si hace la sección comprobable y simple. |
| F. Value flow | ADAPT | Cuatro cajas con flechas funcionan, pero se leen como cards repetidas y ocupan demasiado foco. | Mantener exactamente las cuatro etiquetas; conectarlas con una línea/ritmo visual y llevarlas a lectura de cadena. | No mapear a Steps 0–4 ni implicar una secuencia metodológica obligatoria. | Reusar spacing, border y text tokens. Números no necesarios; no usar progress UI. | ValueFlow pequeño; no crear StepProgress ni componente de workflow. |
| G. Impact cues | REMOVE | La sección oscura agrega cuatro cards y repite atención/evidencia/alineación/decisión sin demostrar el producto. | Quitarla como sección autónoma. Representar señales, gaps y bloqueo dentro del preview ilustrativo, con etiquetas de ejemplo. | No mostrar “cuentas”, métricas o estado calculado que parezca analítica real. | Evitar un mosaico de cards cyan. El color de estado nunca sustituye texto/procedencia. | No. Su job lo absorbe StarteriaProductPreview sin conservar la sección de cards. |
| H. Trust section | ADAPT | Cuatro principios son tiles equivalentes; compiten con la narrativa y parecen feature cards. | Una franja o bloque editorial breve que enfatice revisión y autoridad humana, sin logos/testimonios ni claims sociales. | La IA propone; no toma decisiones ni convierte observaciones en hechos confirmados. | Neutrales dominantes, texto explícito, acento reservado; sin señal solo por color/icono. | TrustPrinciples como subcomponente solo si mejora composición; no requiere primitive. |
| I. Final CTA | REMOVE | CTA “Ir a Starteria” repite el destino /auth ya presente en Hero/header. | Retirar el bloque duplicado en el diseño final; conservar el camino /auth arriba y la salida a /public/start en Entry. El cierre no crea un nuevo funnel. | No reemplazarlo por Demo/Early Access inventados ni eliminar el camino /auth. | Una CTA primaria dominante; sin grupo de botones espejo al final. | No; el cierre se resuelve con LandingClosing/footer mínimo. |
| J. Footer / closing state | NEW | No existe footer propio; el documento termina inmediatamente tras CTA final. | Añadir cierre mínimo con marca y únicamente enlaces gobernados ya existentes; mantener orden de tabulación y contraste. | No inventar legales, social links, Demo, Early Access o rutas. | Reusar tokens de texto y borde; densidad baja, sin bloque promocional nuevo. | LandingClosing puede contener footer y estado final; no necesita un componente complejo. |
| K. Mobile behavior | ADAPT | Header oculta anclas, el contenido apila largos bloques y el valor aparece como tiles. No hay evidencia actual en esta ejecución de QA visual de L3. | Acción /auth visible; contenido en una columna, preview completa apilada, Entry secundaria, ninguna información crítica escondida. | Evitar overflow, estado solo hover, compresión de texto o prioridad accidental del Entry. | Responsive según jerarquía, foco visible y tokens, sin variante mobile paralela. | No requiere componente; responsive pertenece a las composiciones anteriores. |

## D. VISUAL_GAPS

### PRODUCT PROBLEM

La página no demuestra visualmente cómo el producto sostiene una relación entre intención prioritaria, trabajo conectado, evidencia y preparación de decisión. Esto describe una brecha de comprensión en la superficie pública; no afirma que el producto runtime carezca de estas capacidades.

### VISUAL PROBLEM

La mayor parte de la página se lee como texto, filas y cards. PlatformStructure presenta conceptos como etiquetas separadas y no como un workspace. Impact cues y Trust repiten patrones equivalentes, con poco cambio de escala o densidad. Navy y cyan ocupan una sección de tarjetas, no una lectura concreta del producto.

### CONTENT PROBLEM

Los textos congelados están presentes y coinciden con KAN-112; deben quedar intactos. Hay copy de soporte alrededor de ellos que repite beneficios o taxonomía. La UX Spec contiene una alternativa de copy/orden y ejemplos de comerciales que no gobierna este freeze. El nuevo contenido ficticio queda limitado a la preview, se especifica literalmente en F y se etiqueta como ficticio.

### CONVERSION PROBLEM

El acceso directo existente a Starteria (/auth) y la ruta opcional /public/start sí funcionan. No existe destino autorizado para Demo ni Early Access; no corresponde tratar su ausencia como CTA roto ni dibujar controles falsos. La fricción actual es jerárquica: el Entry aparece antes de que termine la explicación del producto y la acción /auth se repite al cierre.

## E. TARGET_COMPOSITION

### Composición visual congelada

1. **Hero:** headline y los dos párrafos congelados, CTA existente de Starteria a /auth. Composición editorial con buen espacio negativo; el preview empieza a aparecer cerca del pliegue en desktop.
2. **Product/value chain:** modelo L2 y cadena de valor en una composición corta, sin cajas pequeñas de igual peso. La cadena mantiene orden, textos y relación exactos.
3. **Product Preview:** un solo shell ilustrativo, con contexto de workspace y una lectura vertical de prioridad → relaciones de trabajo → señales/evidencia/bloqueo → decisión a preparar. No es dashboard real ni interactivo.
4. **Product value / problem:** tres problemas existentes como marco editorial breve que conecta trabajo, evidencia y decisión; sin sumar claims cuantitativos.
5. **Trust / human authority:** bloque compacto con principios existentes de revisión y autoridad humana; sin prueba social fabricada.
6. **Commercial paths:** posición reservada solo en este documento. Si Demo/Early Access aún no tienen destinos autorizados, no renderizar sección, botones, enlaces, disabled CTAs ni URLs. No sustituirlos por /auth.
7. **Optional Portfolio Entry:** bloque final de menor peso visual; conservar exactamente el título y CTA congelados, la ruta /public/start y el framing de opción.
8. **Closing/footer:** cierre semántico mínimo después de las secciones anteriores; marca y enlaces existentes únicamente.

Orden semántico y de lectura para teclado/lector: Hero → producto/value chain → preview → problem/value → trust → slot comercial (solo cuando tenga destino autorizado) → optional Entry → footer. En esta fase no se agrega un destino.

### Pliegue desktop

A 1440 px y 1280 px, el primer viewport presenta promesa, acción existente y el inicio reconocible del preview. El ValueFlow ocupa poco alto y no fuerza un panel promocional duplicado. El primer fragmento visible del preview incluye etiqueta ilustrativa, prioridad y comienzo de sus relaciones. La etiqueta no depende de scroll, hover ni tooltip.

### Límites visuales

- No mockup de Steps, barras de progreso, analytics o porcentajes inventados.
- No kanban genérico, chatbot central, panel de Copilot, logos/testimonios ni claims sociales.
- No afirmar que la ilustración representa datos del visitante, un cliente o estado productivo.
- No cambiar Portfolio Entry, Core, Steps 0–4, ciclo adaptativo ni rutas existentes.
- Una superficie estructural para el preview; filas y divisores, no un tablero de microcards.

### Visual language

- **Jerarquía:** promesa congelada primero; acceso existente a Starteria claro; cadena conceptual; preview; problem/value; autoridad humana; Entry opcional al final.
- **Grid:** contenedor semántico content.wide; composición de 12 columnas en desktop/laptop, con texto/editorial y preview usando el ancho sin panel lateral de Copilot. ValueFlow usa cuatro tramos alineados en desktop; problem/trust pueden usar dos zonas. Tablet y móvil pasan a una columna antes de reducir texto.
- **Whitespace:** secciones amplias con el spacing scale existente; espacio generoso alrededor de Hero y preview, separaciones más cortas dentro de sus grupos. Evitar que cada renglón tenga su propia tarjeta.
- **Density:** editorial fuera del preview; preview compacto pero legible, con cuatro niveles y hasta tres iniciativas. Ningún contenido crítico depende de labels microscópicos.
- **Contrast:** superficies claras dominantes, texto slate/navy con contraste AA; dark navy queda como acento estructural pequeño dentro del shell, no como sección de tarjetas. No usar texto de bajo contraste sobre transparencias.
- **Borders/cards:** border-default/strong y elevation-none; esquinas según ds-radius-md/lg. Un shell para el preview, divisores entre bandas y ninguna anidación decorativa.
- **Typography:** H1 en escala Display (40–48 px según viewport); títulos de sección Heading L/XL; texto explicativo 16 px o 14 px en agrupaciones densas; disclaimer al menos del cuerpo legible, no caption tenue. Label/caption se reservan para metadatos secundarios.
- **Accent:** indigo para la acción primaria y algunos conectores; cyan puede aparecer solo como detalle puntual. La proporción permanece neutral-dominant, alineada al 80–85% neutral y ~5% marca del Design System Contract.
- **Light/dark balance:** base blanca/off-white; texto y estructura navy/slate; máximo un tratamiento navy delimitado para dar profundidad al preview. No crear una sección dark completa de cuatro cards.
- **Interaction hints:** preview sin botones ni estados hover; navegación y CTAs solo parecen interactivos cuando tienen destino real. Sin progreso animado, autoplay o tooltip necesario para entender la muestra.
- **Responsive collapse:** cuatro tramos pasan a wrap/stack; agrupaciones de preview se apilan conservando conectores, disclaimer y orden de lectura; ninguna columna fuerza scroll horizontal.

## F. PRODUCT_PREVIEW_SPEC

Todo el contenido de esta muestra es ficticio. El shell incluye la etiqueta persistente “Ejemplo ilustrativo · no es un análisis real” y la nota “Contenido, nombres, relaciones y estados ficticios.” Ninguna fila se hidrata desde datos del visitante, API, entidades del portfolio o analytics.

### A. Outer shell

- Una superficie amplia única, clara y de borde fino; sin shadow stack.
- El cuerpo se divide por bandas y separadores. No anidar tarjetas por cada relación.
- Se lee como espacio de trabajo con contexto y jerarquía; no como una captura de dashboard operacional.
- El shell no acepta input ni tiene controles, hover de acción o estados animados.

### B. Top context bar

Texto exacto permitido:

- Etiqueta persistente: “Ejemplo ilustrativo · no es un análisis real”
- Aviso secundario: “Contenido, nombres, relaciones y estados ficticios.”
- Contexto: “Lectura de prioridad”
- Identidad visual: Starteria

No incluir nombre de organización, persona, cliente, periodo, recuento, fecha o dato de uso real.

### C. Strategic objective / priority

- Etiqueta: “Prioridad”
- Texto ejemplo: “Mejorar adopción del canal digital”

El objetivo aparece como contexto de la lectura, sin baseline, target, KPI, porcentaje, ranking ni afirmación de que sea una prioridad confirmada.

### D. Portfolio / work relationships

Representar la relación en orden y con conectores visibles:

- Frente — “Experiencia digital”
- Reto — “Facilitar la activación inicial”
- Iniciativas — “Rediseño onboarding”, “Automatización soporte” y “Nuevo flujo de activación”

Son nombres ficticios. Se muestran como jerarquía y lista compacta, no como kanban. No agregar owner, fecha, porcentaje, esfuerzo, riesgo calculado o vínculo a una entidad real.

### E. Signals / evidence

Texto ejemplo permitido:

- “Señal a revisar: uso después del primer acceso”
- “Evidencia pendiente: qué facilita la activación inicial”

Son etiquetas de información por observar, no mediciones ni resultados. No se dibujan gráficas, valores, tendencias ni conteos.

### F. Attention / gap state

Texto ejemplo permitido:

- “Bloqueo ilustrativo: dependencia de soporte por aclarar”
- “Gap de evidencia: falta entender qué ocurre después del primer acceso”

Usar texto y un tratamiento neutral/semántico legible. No depender de rojo, badges de workflow ni una alerta alarmista. No declarar cobertura, severidad o estado confirmado.

### G. Decision block

Texto exacto de ejemplo:

- Etiqueta: “Decisión a preparar”
- Pregunta: “¿Continuar, ajustar o pausar la prueba?”
- Autoridad: “La decisión sigue siendo de las personas.”

Se presenta como contexto para deliberar. No marcar una opción como recomendada/seleccionada ni dar a la preview una acción de decisión.

### H. Provenance / illustrative disclaimer

- La etiqueta “Ejemplo ilustrativo · no es un análisis real” permanece visible en la cabecera del shell y en su lectura accesible.
- “Contenido, nombres, relaciones y estados ficticios.” aclara el alcance de la muestra.
- Añadir como pie: “La preview muestra cómo organizar la lectura. No sustituye la revisión ni la decisión de las personas.”
- No basta color, icono, tooltip, alt text, hover o nota fuera del preview para comunicar que es una ilustración.
- Los nombres y estados de ejemplo no se usan fuera del shell como evidencia, social proof o claim de producto.

### I. Responsive behavior

- Desktop: shell con bandas jerárquicas; relaciones agrupadas; señales y bloqueos pueden compartir una fila ancha, manteniendo lectura vertical.
- Laptop/tablet: shell ocupa el ancho disponible; relaciones y señales se apilan cuando pierden legibilidad.
- Mobile: una columna, texto íntegro, listas simples y conectores verticales; no reducir a microcards ni introducir scroll horizontal.
- No ocultar disclaimer, evidencia faltante, bloqueo ni decisión al colapsar.

### J. Accessibility

- Usar section/figure con encabezado y figcaption o descripción asociada.
- El orden DOM sigue prioridad → frente/reto/iniciativas → señales/evidencia/bloqueo → decisión.
- Las listas reflejan agrupaciones; conectores decorativos llevan aria-hidden.
- El preview es estático, sin elementos tabbables ni aria-live.
- El texto de procedencia está visible y asociado al preview. No depender de contraste cromático o metadata.

## G. SECTION_ORDER

| Orden | Sección | Tratamiento congelado |
|---:|---|---|
| 1 | Hero | Copy exacto de KAN-112; conservar el CTA existente a /auth. |
| 2 | Product/value chain | Conservar el L2 model y el Value flow exactos. |
| 3 | Product Preview | Nuevo shell ilustrativo según F, visible cerca del pliegue. |
| 4 | Product value / problem | Adaptar la sección actual de problemas en una lectura editorial. |
| 5 | Trust / human authority | Adaptar principios existentes; no inventar validación social. |
| 6 | Commercial paths | Slot solo documental hasta que haya destinos autorizados; sin UI falsa. |
| 7 | Optional Portfolio Entry | Copy y CTA congelados; ruta actual /public/start; menos peso visual que producto. |
| 8 | Closing/footer | Marca y navegación existente; no crea destino comercial. |

El acceso directo /auth sigue disponible en Hero/header aunque el slot comercial no se renderice. El bloque Entry no funciona como gate ni se mueve a Hero.

## H. RESPONSIVE

| Viewport | Comportamiento objetivo |
|---|---|
| Desktop 1440 | Contenedor editorial centrado, máximo del token content.wide. Hero dominante y CTA a /auth; cadena compacta; preview empieza a asomar en el primer viewport. Shell con espacio para relaciones y señales sin mosaico de cards. |
| Laptop 1280 | Mantener el mismo orden y jerarquía; reducir márgenes laterales antes de comprimir texto; preview sigue reconocible, sin cortes de disclaimer. |
| Tablet | Header simplificado con marca y acceso existentes; Hero a una columna si no caben dos zonas; value chain se envuelve con conectores entendibles; preview refluye a una columna antes de usar tipografía pequeña. |
| Mobile 390 | Marca/acceso y CTA /auth claros; Hero primero; value flow legible en secuencia; preview apilado y totalmente comprensible; Entry al final y secundaria; footer simple. Sin overflow horizontal ni microcards. |

A 390 px no se oculta el apoyo secundario del Hero, las señales, el gap, el bloqueo, la decisión humana ni la nota ilustrativa. No se exige mostrar el preview completo en la primera pantalla móvil; se prioriza lectura y acción clara antes de la composición apilada.

## I. ACCESSIBILITY

- Una jerarquía: un h1 para el Hero; h2 para cada sección; h3 solo para subgrupos semánticos.
- Landmarks: header, nav con nombre accesible, main y footer. Cada sección tiene encabezado asociado.
- Contraste WCAG AA como objetivo: 4.5:1 para texto normal y 3:1 para texto grande/controles. El disclaimer es contenido crítico y no se reduce a caption tenue.
- Foco visible con el focus ring existente y offset; tab order refleja el orden de lectura. No hay controles falsos dentro del preview.
- Links reales para navegar a rutas existentes; no usar click handler de botón para fingir un link. Mantener /auth y /public/start sin cambiar rutas.
- Orden de teclado: marca → anclas visibles que correspondan a secciones existentes → acceso del header → CTA del Hero a /auth → controles reales posteriores en orden DOM → CTA opcional a /public/start → enlaces ya existentes del footer. El preview no añade paradas de tabulación.
- Movimiento no es necesario en el preview. Si se introduce transición en implementación, respetar prefers-reduced-motion y no animar progreso.
- Flechas y adornos son decorativos y se ocultan a lectores; el contenido y los estados se expresan en texto.
- El disclaimer ilustrativo se lee de forma inmediata, permanece visible y queda asociado semánticamente al shell.
- Anclas con destino visible bajo el header sticky; los elementos interactivos deben ser operables solo con teclado.
- No usar color como único indicador ni una región live para contenido estático.

## J. COMPONENT_PLAN

Arquitectura propuesta, dentro de front/src/app/components/landing/:

- LandingHeader — marca, anclas existentes y acceso existente; no crea rutas.
- LandingHero — copy congelado y CTA vigente hacia /auth.
- PlatformStructure — conservar/adaptar el modelo L2 estático de ocho conceptos; no es el workspace preview.
- ValueFlow — cuatro etiquetas congeladas, presentadas como cadena conceptual; no reutiliza StepProgress.
- StarteriaProductPreview — componente nuevo requerido, estático, accesible y con todo el contenido ficticio/disclaimer de F.
- ProblemFrame — una composición editorial que reutiliza los tres puntos actuales sin cards anidadas.
- TrustPrinciples — presentar el contenido existente sobre revisión/autoridad humana de forma compacta.
- OptionalPortfolioEntry — solo framing y CTA actual a /public/start; sin importar ni alterar la lógica de Entry.
- LandingClosing — footer mínimo con marca/enlaces existentes; no repetir CTA comercial.

LandingPage queda como orquestador de secciones. No crear CommercialPaths ni controles visuales mientras falte destino autorizado. No introducir una abstracción general de card/landing para resolver una única página.

## K. TOKEN_PLAN

| Categoría | Decisión |
|---|---|
| REUSE TOKEN | Reusar variables y utilidades mapeadas desde theme.css: background-default/subtle, surface-default/elevated, border-default/strong, text-primary/secondary/muted/inverse, brand-primary/hover/subtle, focus-ring/offset/shadow, escala type-display/heading/body/label, space-2 a space-16, ds-radius-sm/md/lg y elevation-none. |
| REUSE TOKEN — acento | Brand indigo solo para acción primaria y conectores/énfasis breves. Cyan/accent no debe llenar superficies ni repetir los puntos cyan actuales. Navy/charcoal se compone con neutrales ya existentes; no introducir hexes ad hoc. |
| REUSE PRIMITIVE | Button existente (primary/secondary/ghost); Badge solo si una etiqueta comunica categoría necesaria, nunca para adornar cada fila; Card como shell estructural con borde y elevation-none. |
| LOCAL COMPOSITION | Grid del Hero, bandas separadas por divider, árbol de relaciones, ValueFlow y composición editorial de Problem/Trust. Son layouts de Landing, no nuevas reglas DS. |
| NEW TOKEN REQUIRED | Ninguno identificado por este freeze. Si la validación de contraste revela un gap, abrirlo como follow-up de Design System; no crear tokens paralelos aquí. |
| NEW PRIMITIVE REQUIRED | Ninguno. StarteriaProductPreview es una composición de dominio/landing, no un primitive reutilizable general. |

No se prescribe nueva escala, color de estado, sombra, radius ni familia tipográfica. Inter y los tamaños/tokens disponibles en theme.css son la base observada; el Design System Contract permanece draft.

## L. TEST_PLAN

Solo planificación. No se añadieron ni ejecutaron pruebas en esta fase.

### Unit/component

- Cubrir presencia y literalidad de cada texto congelado.
- Comprobar el orden Hero → modelo/value flow → preview → problem → trust → Entry → closing.
- Comprobar que el preview muestra la etiqueta de ejemplo, las relaciones y el contenido ficticio especificado.
- Comprobar ausencia de barras de progreso, porcentajes, analytics, conteos, controles operables y CTA Demo/Early Access sin destino.
- Comprobar que los dos destinos actuales continúan visibles en sus roles: CTA Starteria a /auth; CTA opcional a /public/start.
- Asegurar que PlatformStructure conserva el modelo L2 y que la cadena no presenta Steps 0–4.
- Verificar semántica de headings, landmarks, lista/figcaption y disclaimer asociado.

### Landing E2E y route preservation

- Ampliar front/e2e/public-landing-l1.spec.ts o crear un spec L3, manteniendo prueba de KAN-102.
- Desde / como visitante, verificar Hero, value flow, preview ilustrativo, sección Entry secundaria y sus dos rutas existentes.
- Seguir el CTA Entry hasta /public/start; confirmar que la pantalla directa y su comportamiento permanecen iguales.
- Verificar que no aparece formulario/interacción de Entry embebida en Landing ni se inicia análisis antes de una acción explícita.
- Confirmar acceso existente /auth y destino autenticado existente /dashboard según estado; no cambiar rutas.
- Verificar que no hay enlaces/botones comerciales inventados.

### Viewports y visual browser QA

- Desktop 1440 px y laptop 1280 px: jerarquía del pliegue, promesa, acción /auth, cadena y comienzo reconocible del preview.
- Tablet: 1024 px y 768 px; comprobar reflow, relaciones y navegación.
- Mobile 390 px: orden de lectura, CTA principal visible, preview apilado, Entry secundaria y ausencia de overflow horizontal.
- Capturar y revisar screenshots reales; inspeccionar legibilidad, alineación, densidad, cortes y persistencia del disclaimer. La captura no sustituye revisión visual humana.

### Accessibility

- Teclado end-to-end: foco, orden, anclas, links y navegación a rutas existentes.
- Revisar contraste WCAG AA, foco visible, encabezados/landmarks, nombre accesible de navegación y descripción del preview.
- Probar reducción de movimiento si la implementación agrega transiciones.
- Usar automatización de accesibilidad disponible en el repo y una revisión manual de lector/teclado; esta auditoría no confirma que axe esté instalado.

## M. FILES_CHANGED

Único archivo creado en esta fase:

- docs/implementation/public-landing/KAN-112_LANDING_L3_VISUAL_FREEZE_v0.1.md

No se modificó código, contratos en doc/, rutas, Portfolio Entry, Core, Steps, Manifest o CURRENT_STATE. No se ejecutaron tests ni se creó commit.

## N. REPORT_PATH

docs/implementation/public-landing/KAN-112_LANDING_L3_VISUAL_FREEZE_v0.1.md

## O. STATUS

LANDING_L3_VISUAL_FREEZE_READY

Los destinos comerciales faltantes están aislados en el slot documental de la sección comercial. No bloquean congelar la composición visual; sí bloquean cualquier CTA, ruta o integración de Demo/Early Access.

## P. SAFE_TO_IMPLEMENT

YES — para la composición visual descrita aquí, respetando copy y destinos actuales, y manteniendo Demo/Early Access fuera del render hasta que tengan destino autorizado.

Esta marca no autoriza implementación en esta fase. Antes de tocar código productivo, la siguiente fase debe emitir su V2_CHANGE_GUARDRAIL_CHECK y verificar criterios visuales/accesibles.
