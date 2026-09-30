# Starteria — Public Landing UX Spec

**Documento:** `docs/experience/public-landing/STARTERIA_PUBLIC_LANDING_UX_SPEC_v0.1.md`
**Versión:** v0.1
**Estado:** DOCUMENTAL ONLY / LISTA PARA REVISIÓN DE PRODUCTO Y DISEÑO
**Scope:** `/` — Landing pública de Starteria
**Implementación autorizada:** NO

Esta especificación traduce ADR-006 y los contratos de experiencia vigentes a una propuesta UX
implementable para la Landing. No modifica frontend, backend, rutas, APIs, persistencia, Portfolio
Entry runtime, Handoff runtime, Core ni Step 0–4.

## 0. Autoridad, fuentes y límites

La lectura se realizó en este orden:

1. `docs/STARTERIA_AUTHORITY.md`.
2. Core activo: `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`.
3. `doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md`.
4. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`.
5. `docs/experience/commercial/EARLY_ACCESS_EXPERIENCE_CONTRACT_v0.1.md`.
6. `docs/experience/commercial/DEMO_REQUEST_EXPERIENCE_CONTRACT_v0.1.md`.
7. `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_ACCEPTANCE_CHECKLIST_v0.1.md`.
8. `docs/design-system/STARTERIA_PUBLIC_LANDING_PORTFOLIO_ENTRY_CONTINUATION_ARCHITECTURE_v0.1.md`.
9. `docs/design-system/STARTERIA_E2E_VISUAL_EXPERIENCE_ARCHITECTURE_v0.1.md`.
10. `docs/design-system/STARTERIA_DESIGN_SYSTEM_CONTRACT_v0.1.md`, `STARTERIA_PAGE_ANATOMY_SYSTEM_v0.1.md`
    y primitives/tokens presentes en `front/src/`.

`docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` no se usa como autoridad funcional: el Authority Map lo
declara candidato v0.3 no materializado/promovido. Esta spec conserva Core v0.2 como base factual.

## 1. Page job

La Landing debe permitir que una persona, sin introducir datos ni aprender la ontología interna:

- entienda qué es Starteria;
- entienda qué beneficio obtiene: más claridad sobre qué mover, qué trabajo seguir, qué evidencia
  falta y qué decisión preparar;
- vea el sistema de trabajo que conecta estrategia o necesidad → iniciativas → evidencia y avance →
  decisiones;
- entienda cómo puede comenzar por tres caminos equivalentes en intención, aunque no idénticos en
  tratamiento: Early Access, Demo Starteria u orientación opcional mediante Portfolio Entry;
- sepa que Portfolio Entry no es obligatorio y no representa todo Starteria;
- distinga una demo del producto de una revisión del resultado de Portfolio Entry;
- no confunda una preview ilustrativa con análisis real, datos propios ni promesa de acceso.

La Landing no debe ejecutar análisis sobre la persona sin una acción explícita, crear objetos Core,
activar Steps ni presentar al Copilot como el producto completo.

## 2. Primary mental model

### 2.1 Modelo que debe quedar

> Starteria es una plataforma/sistema de trabajo para conectar estrategia o necesidades con
> iniciativas, evidencia y avance, y decisiones humanas mejor sustentadas.

La secuencia visible y repetible es:

```text
ESTRATEGIA / NECESIDAD
        →
INICIATIVAS
        →
EVIDENCIA + AVANCE
        →
DECISIONES
```

### 2.2 Modelo que debe evitarse

Starteria no debe percibirse como:

- un chatbot de estrategia;
- una caja de texto que produce una respuesta y termina;
- un dashboard operativo completo;
- un formulario que hay que completar antes de entender el producto;
- una IA que decide por la organización;
- Portfolio Entry como sinónimo de Starteria.

La IA puede mencionarse como asistencia para ordenar y proponer, pero la arquitectura visual debe
dar más peso a la plataforma, el trabajo estructurado, la evidencia y la decisión humana.

## 3. Information architecture aprobada para esta spec

Se mantienen seis bloques, con una decisión explícita sobre su necesidad:

| Orden | Sección | Necesidad | Job |
|---|---|---|---|
| 01 | Hero | Obligatoria | Nombrar la promesa y ofrecer los caminos de entrada. |
| 02 | How Starteria works | Obligatoria | Explicar el sistema en una lectura de cuatro pasos. |
| 03 | Product preview | Obligatoria | Hacer visible qué se estructura y qué se decide dentro. |
| 04 | Optional Portfolio Entry | Obligatoria | Ofrecer orientación sin convertirla en gate. |
| 05 | Continuation / commercial paths | Obligatoria | Separar Early Access de Demo y habilitar conversión directa. |
| 06 | Final CTA / footer | Recomendada | Cerrar con una elección repetida, compacta y no redundante; incluir footer mínimo. |

No se añade una sección autónoma de “trust”, “clientes”, “testimonios”, “pricing” o “capacidades”:
no hay evidencia documental autorizada para claims sociales o comerciales y sus contenidos pueden
disolverse en la explicación del sistema, la preview y los principios de confianza.

La secuencia narrativa es:

```text
Promesa de plataforma
→ cómo conecta el trabajo
→ qué se puede leer dentro
→ orientación opcional si falta claridad
→ dos caminos comerciales directos
→ cierre con elección
```

### 3.1 Above the fold

Debe contener, en desktop y mobile:

- marca y navegación mínima;
- headline y supporting copy;
- representación breve de la cadena estrategia/necesidad → iniciativas → evidencia/avance →
  decisiones o un fragmento de preview;
- CTA de Early Access y CTA de Demo visibles sin abrir Portfolio Entry;
- como máximo una mención secundaria, no dominante, a “ordenar mi situación”.

El textarea de Portfolio Entry no debe ocupar la primera lectura en mobile. La primera viewport debe
explicar producto y beneficio antes de pedir contexto personal.

## 4. Section 01 — Hero

### 4.1 Estructura

Composición editorial de dos zonas en desktop:

- izquierda: eyebrow opcional, headline, supporting copy, CTA group y microcopy;
- derecha: expresión visual compacta de la cadena de trabajo o una mini-preview estática;
- mobile: contenido en una sola columna, texto y CTAs primero, visual debajo.

No se muestra un panel persistente de Copilot ni un formulario conversacional como visual principal.

### 4.2 Copy

**Eyebrow — COPY TO TEST**

> Plataforma para conectar iniciativas, evidencia y decisiones

Puede omitirse si el headline y la preview ya hacen inequívoca la categoría. No debe usarse como
claim de liderazgo de mercado ni como etiqueta de IA.

**Headline — FINAL COPY BASELINE**

> Convierte estrategia e iniciativas en decisiones sustentadas.

**Supporting copy — FINAL COPY BASELINE**

> Starteria ayuda a estructurar qué quieres mover, convertirlo en iniciativas accionables, seguir
> evidencia y bloqueos, y preparar mejores decisiones.

**CTA primario propuesto — COPY TO TEST / hipótesis de jerarquía**

> Solicitar early access

Razón: es una acción de bajo compromiso que permite manifestar interés sin prometer acceso automático.
El botón debe llevar al flujo de solicitud posterior, cuya ruta concreta no se congela aquí.

**CTA secundario visible — FINAL COPY BASELINE**

> Agendar una demo de Starteria

Debe ser un botón secundario o enlace de alto contraste. La palabra “Starteria” es necesaria para
evitar interpretar Demo como revisión de la entrada del visitante.

**Acceso terciario — FINAL COPY BASELINE**

> ¿Todavía no tienes claro por dónde empezar?
> Ayúdame a ordenar mi situación

Se presenta como enlace o acción ghost junto a una explicación breve, no como tercer botón primario.
Abre Portfolio Entry sólo tras una acción explícita.

**Microcopy — FINAL COPY BASELINE**

> Puedes conocer Starteria o solicitar orientación sin registrarte para esta primera entrada.

La parte “sin registrarte” aplica a la orientación inicial; no debe sugerir que los caminos comerciales
no solicitarán los datos mínimos o consentimiento definidos por sus contratos.

### 4.3 Jerarquía CTA del Hero

Propuesta inicial, **hipótesis pendiente de testing**:

1. Early Access: primary.
2. Demo de Starteria: secondary visible.
3. Portfolio Entry: tertiary/ghost, con framing de orientación opcional.

No se debe presentar Portfolio Entry como CTA primaria del Hero. Si la investigación demuestra que la
Demo es el mejor primer paso para la audiencia prioritaria, se podrá experimentar con un intercambio
de primary/secondary sin cambiar los tres caminos ni su semántica.

## 5. Section 02 — How Starteria works

### 5.1 Presentación

Un bloque escaneable de cuatro etapas, conectadas por una línea, flechas o ritmo visual equivalente.
No usar como labels públicos `StrategicFront`, `Challenge`, `Step`, `Portfolio Lead` ni otra
taxonomía interna.

| Etapa | Label público | Explicación, máximo una línea | Valor que aporta |
|---|---|---|---|
| 01 | Estrategia / necesidad | Define qué quieres mover o qué necesitas entender. | Da un punto de partida comprensible aunque el contexto esté incompleto. |
| 02 | Iniciativas | Convierte esa intención en trabajo que puede enfocarse y seguirse. | Hace visible qué se está intentando mover y con qué prioridad. |
| 03 | Evidencia + avance | Sigue lo que ocurre, lo que falta y dónde aparecen bloqueos. | Separa actividad de señales útiles para continuar, ajustar o pausar. |
| 04 | Decisiones | Reúne el contexto necesario para decidir el siguiente movimiento. | Ayuda a que las personas decidan con más claridad y trazabilidad. |

**Heading — FINAL COPY**

> De lo que quieres mover a la decisión que puedes sostener.

**Supporting copy — COPY TO TEST**

> Starteria conecta el trabajo cotidiano con la conversación que necesita una decisión.

Cada etapa muestra una sola idea visual y un máximo de dos líneas secundarias. No añadir una segunda
taxonomía paralela como “alinear / entender / seguir / decidir” en el mismo bloque.

## 6. Section 03 — Product preview

### 6.1 Job y límites

La preview debe comunicar que Starteria contiene estructura de trabajo, iniciativas, estados,
evidencia, bloqueos y decisiones. Es una ilustración estática o controlada:

- debe llevar una etiqueta persistente: `Ejemplo ilustrativo`;
- no reacciona al input público;
- no analiza el contexto del visitante;
- no afirma que los datos pertenecen a una organización real;
- no muestra un dashboard completo ni todos los objetos del producto;
- no usa una animación que parezca procesamiento real;
- no oculta que las decisiones siguen siendo humanas.

### 6.2 Contenido conceptual

**Cabecera de preview — FINAL COPY**

> Así puede verse el trabajo cuando está conectado

**Etiqueta — FINAL COPY**

> Ejemplo ilustrativo · no es un análisis real

**Prioridad — FINAL COPY**

> Mejorar adopción del canal digital

**Iniciativas — FINAL COPY BASELINE**

- Rediseño onboarding · `En validación`
- Automatización soporte · `Bloqueada`
- Nuevo flujo de activación · `Lista para decisión`

**Lectura Starteria — FINAL COPY**

- 1 bloqueo
- 1 gap de evidencia
- 1 decisión preparada

**Nota de autoridad — FINAL COPY**

> La preview muestra cómo organizar la lectura. No sustituye la revisión ni la decisión de las
> personas.

Los estados son ejemplificativos. La UI futura debe usar estados semánticos y no comunicar que
“En validación” equivale a “confirmado”, ni que “Lista para decisión” equivale a una decisión tomada.

### 6.3 Jerarquía visual y componentes conceptuales

La preview debe leerse en este orden:

1. prioridad/contexto;
2. lista corta de iniciativas;
3. estados y bloqueos;
4. evidencia faltante;
5. decisión preparada.

Estructura recomendada: una superficie editorial con un panel de contexto, una lista compacta de tres
iniciativas y una franja de lectura con tres señales. Usar una card estructural, no un mosaico de cards
anidadas. Los badges se reservan para estado; no se usan para cada etiqueta decorativa.

## 7. Section 04 — Optional Portfolio Entry

### 7.1 Framing obligatorio

Esta sección debe estar claramente separada de la preview del producto mediante espacio, color de
superficie o un encabezado de orientación. No debe parecer el siguiente paso necesario para continuar.

**Título — FINAL COPY BASELINE**

> ¿Todavía no tienes claro por dónde empezar?

**Supporting copy — FINAL COPY BASELINE**

> Esta orientación te ayuda a ordenar tu objetivo, necesidad, problema, oportunidad, iniciativa y
> decisión antes de elegir cómo continuar.

**Label de contexto — COPY TO TEST**

> Orientación opcional

### 7.2 Input y CTA

El bloque puede mostrar el input conceptual existente, sin rediseñar aquí el journey interno:

**Label/input — FINAL COPY BASELINE**

> ¿Qué necesitas conseguir, resolver o entender?

**CTA — FINAL COPY BASELINE**

> Ayúdame a ordenar mi situación

**Microcopy — FINAL COPY BASELINE**

> No necesitas registrarte para usar esta primera orientación.

La implementación futura debe conservar la lógica, estados, provenance, clarification y Handoff del
Portfolio Entry Contract. Esta spec define únicamente su framing y posición en `/`.

### 7.3 Acceso alternativo equivalente

En la misma sección, visible sin rellenar el input:

> ¿Ya sabes cómo quieres continuar?

- `Solicitar early access`
- `Agendar una demo de Starteria`

Estos accesos deben tener peso visual equivalente entre sí y no quedar subordinados a completar el
textarea. Son destinos conceptualmente independientes del Portfolio Entry.

## 8. Section 05 — Continuation / commercial paths

### 8.1 Patrón compartido

Dos cards hermanas, con la misma anatomía, tokens, densidad y nivel de peso. Cada una contiene:

- intención del visitante;
- beneficio concreto;
- microcopy semántico;
- una CTA propia;
- aviso breve de lo que no significa el envío, cuando sea necesario.

No usar cards para sugerir que Early Access y Demo son productos separados. Son dos formas de
continuar desde la Landing.

### 8.2 Early Access

**Label — FINAL COPY**

> EARLY ACCESS

**Intent — FINAL COPY**

> Quiero seguir probando Starteria.

**Benefit — FINAL COPY**

> Participa como early user y utiliza Starteria con casos reales.

**CTA — COPY TO TEST**

> Solicitar early access

Alternativa testeable: `Quiero seguir probando`.

**Microcopy — FINAL COPY BASELINE**

> Revisaremos tu interés y te explicaremos los próximos pasos posibles. La solicitud no concede acceso
> automáticamente.

No prometer aceptación, fecha, pricing, piloto ni acceso concedido. El detalle del formulario,
consentimiento, estados, persistencia y confirmación pertenece al Early Access Contract y queda fuera
de esta spec.

### 8.3 Demo Starteria

**Label — FINAL COPY**

> DEMO STARTERIA

**Intent — FINAL COPY**

> Quiero evaluar Starteria para mi equipo u organización.

**Benefit — FINAL COPY**

> Conoce el producto y explora cómo podría aplicarse a la forma de gestionar iniciativas y decisiones.

**CTA — FINAL COPY BASELINE**

> Agendar una demo de Starteria

**Microcopy — FINAL COPY BASELINE**

> Hablaremos de Starteria como plataforma completa y de su posible aplicación a tu contexto. Una demo
> no es un piloto.

No usar:

> ¿Quieres verlo con tu equipo?

Puede interpretarse como compartir el resultado de Portfolio Entry. Demo no equivale a revisar sólo
la lectura de entrada, no es un piloto y no inicia trabajo.

### 8.4 Jerarquía entre caminos

Las dos cards deben compartir jerarquía visual y no competir con el framing opcional de Portfolio
Entry. En desktop pueden aparecer en dos columnas; en mobile se apilan sin esconder la segunda. El
orden inicial recomendado es Early Access y después Demo, sujeto a testing de audiencia y conversión.

## 9. Section 06 — Final CTA y footer

### 9.1 Final CTA

Se recomienda porque evita que la persona tenga que volver al Hero y ofrece una última elección
compacta después de comprender el producto. No introduce información nueva.

**Heading — COPY TO TEST**

> Elige cómo quieres conocer o continuar con Starteria.

**Supporting copy — FINAL COPY BASELINE**

> Puedes solicitar early access, agendar una demo o empezar por una orientación opcional.

**Actions — reuse, no nuevas semantics**

- `Solicitar early access` — primary.
- `Agendar una demo de Starteria` — secondary.
- `Ayúdame a ordenar mi situación` — tertiary/ghost.

### 9.2 Footer

Footer mínimo, sin navegación compleja:

- marca Starteria;
- enlace a login si existe y continúa siendo válido;
- enlaces legales o de privacidad sólo si ya están disponibles y gobernados por la aplicación;
- no añadir sitemap, blog, pricing, partners o social proof sin autoridad de contenido.

## 10. UX writing system

### 10.1 Principios

- beneficios antes que features;
- frases cortas y una idea por bloque;
- distinguir plataforma, orientación y conversión;
- usar lenguaje público: “prioridad”, “situación”, “trabajo”, “evidencia”, “decisión”;
- no exigir ni enseñar la ontología interna;
- no presentar IA como producto completo;
- no prometer resultados, acceso, disponibilidad, pricing, piloto o encaje;
- evitar “integración” cuando se quiere decir “aplicación al contexto”;
- usar “Demo Starteria” para distinguir producto completo de Portfolio Entry;
- no repetir el headline en cada CTA;
- marcar explícitamente ejemplos, estados y datos ilustrativos.

### 10.2 Copy final vs copy to test

**Final baseline de esta spec:** headline, supporting copy del Hero, labels del flujo, copy de
Portfolio Entry solicitado, microcopy sin registro, contenido semántico de Early Access y Demo, y
label de preview ilustrativa.

**Copy to test:** eyebrow, CTA primary del Hero entre Early Access y Demo, wording alternativo de
Early Access, heading de How it works, label “Orientación opcional”, heading del cierre y orden de
las dos cards comerciales.

“Final” significa baseline aprobado para implementación documental, no claim de lenguaje validado con
usuarios. Todo copy to test debe poder variarse sin crear componentes duplicados.

## 11. Visual hierarchy

### 11.1 Mirada y peso

1. Hero: promesa de plataforma y beneficio.
2. Cadena de trabajo: estrategia/necesidad → iniciativas → evidencia/avance → decisiones.
3. Preview: prueba visual de estructura, no dashboard.
4. Commercial paths: conversión directa.
5. Portfolio Entry: orientación opcional, peso menor que producto y conversión.

Portfolio Entry debe tener suficiente contraste para ser encontrado, pero no el mayor contraste ni el
mayor bloque de la página. La preview debe contrastar producto/estructura con la orientación mediante
superficie y label, no mediante saturación decorativa.

### 11.2 Densidad y ritmo

- una acción primaria por superficie o zona decisional;
- máximo tres acciones visibles en una zona;
- máximo tres iniciativas en la preview;
- máximo cuatro etapas en How it works;
- cards con borde y sombra mínima, evitando card dentro de card;
- whitespace generoso entre secciones, con ritmo basado en tokens `8/12/16/24/32/48/64`;
- radius grande sólo en superficies editoriales de Landing;
- 80–85% de la superficie en neutrales; brand/accent y estados sólo con semántica;
- iconos Lucide o equivalentes para apoyar lectura, nunca como único portador de significado;
- badges sólo para estados/categorías, no para adornar cada elemento.

### 11.3 Tokens y componentes

Usar tokens existentes y semánticos: `brand.primary`, `brand.primary.subtle`, superficies/neutrales,
estados workflow/review/feedback, tipografía Inter, escala de spacing, radius DS y focus ring. No
introducir HEX nuevos, una escala tipográfica paralela ni un segundo Design System.

## 12. Header y navegación

### 12.1 Auditoría actual

La Landing actual tiene navegación ancla `Problema`, `Como funciona`, `Confianza` y un único acceso a
login/panel. También embebe Portfolio Entry en el Hero. El `PublicLayout` de `/public/start` tiene un
header distinto, propio de la entrada pública, y no debe reutilizarse como header de la Landing sin
revisar sus responsabilidades.

Esto evidencia una divergencia con ADR-006: falta exposición directa de Early Access y Demo, y la
orientación ocupa la posición dominante del primer bloque. El código no redefine la autoridad; queda
registrado como conflicto para una futura slice frontend.

### 12.2 Navegación mínima propuesta

Desktop:

- logo Starteria → inicio;
- `Cómo funciona` → Section 02;
- `Ver producto` → Section 03;
- `Orientación opcional` → Section 04;
- `Solicitar early access` → camino comercial directo;
- `Agendar una demo` → camino comercial directo;
- `Iniciar sesión` o `Ir al panel`, sólo si el estado existente lo requiere.

No añadir `Problema`, `Confianza`, `Para empresas` o categorías adicionales como navegación si no
corresponden a una sección estable y útil. La navegación debe poder reducirse a logo, dos anclas,
dos acciones comerciales y login.

Mobile:

- logo;
- login si sigue siendo válido;
- menú accesible o acciones inline que no escondan Early Access/Demo;
- no depender sólo de un menú colapsado para hacer visibles los dos caminos comerciales.

## 13. Responsive

### Desktop

- Hero en dos columnas, con copy dominante y preview/chain visual lateral.
- How it works en cuatro columnas o timeline horizontal legible.
- Product preview con contexto a la izquierda y lectura de señales a la derecha.
- Early Access/Demo en dos columnas.
- Portfolio Entry puede usar una composición de copy + orientación, con los accesos alternativos a la
  vista.

### Tablet

- Hero puede mantener dos columnas sólo si el headline no pierde ancho legible; si no, apilar copy y
  visual.
- How it works en dos por dos o timeline vertical corto.
- Preview en una columna con señales debajo.
- Cards comerciales en dos columnas si cada CTA conserva ancho táctil suficiente; si no, apilar.

### Mobile

- Producto y beneficio antes del textarea.
- Hero: headline, supporting copy, Early Access y Demo visibles; Portfolio Entry como acción
  secundaria/terciaria claramente opcional.
- Cadena de trabajo apilada verticalmente con conectores simples; no reducir labels a iconos.
- Preview en una sola superficie, con tres iniciativas y señales apiladas; no mostrar tablas densas ni
  múltiples paneles.
- Portfolio Entry conserva título, microcopy y CTA; no se presenta como siguiente paso automático.
- Early Access y Demo permanecen visibles sin scroll horizontal y con botones de altura táctil adecuada.
- CTA hierarchy: una primary, una secondary y una tertiary; el orden visual no debe cambiar el
  significado.
- No critical state sólo en hover, tooltip o animación.

## 14. Estados de Landing

Sólo se definen estados de esta página, no los flujos internos de Early Access o Demo.

### 14.1 Default

Contenido completo, preview marcada como ilustrativa, links y CTAs activos. No hay análisis de input ni
estado de sesión conversacional en la Landing.

### 14.2 Loading de elementos, si aplica

Sólo para una navegación o carga de recurso que realmente lo necesite. Mantener el layout estable con
Skeleton en preview o estado `aria-busy`; no mostrar spinner como si Starteria estuviera analizando al
visitante. Copy contextual permitido: `Cargando ejemplo ilustrativo…`.

### 14.3 Link/action unavailable

Si un camino aún no está disponible, no mostrar una CTA que falle silenciosamente. Usar estado disabled
con explicación breve y accesible, o retirar la acción del bloque hasta que exista un destino gobernado.
Nunca redirigir a Portfolio Entry como fallback de Early Access/Demo.

### 14.4 Responsive

Responsive no es un estado de negocio: debe conservar la misma semántica, etiquetas, orden lógico y
accesibilidad en todos los tamaños.

### 14.5 No-JS/fallback

Si la aplicación ya tiene patrón de fallback, los enlaces semánticos deben conservar navegación a los
destinos gobernados. El contenido editorial, la cadena de trabajo, la preview ilustrativa y el framing
opcional deben seguir siendo comprensibles sin interacción JS. No diseñar una experiencia alternativa
completa en esta spec.

## 15. Accessibility

- un solo `h1` en Hero;
- `h2` por sección y `h3` por etapa/card cuando corresponda;
- landmarks `header`, `nav`, `main`, `section`, `footer` con labels sólo cuando aporten contexto;
- todos los botones y enlaces con nombres que describen destino/acción;
- labels visibles para el textarea; el placeholder no sustituye al label;
- foco visible con el token existente y orden de teclado coincidente con el orden de lectura;
- contraste WCAG AA como baseline; no depender de color para estados;
- badges de estado acompañados por texto, no sólo color o icono;
- `aria-live` sólo para cambios reales de navegación/estado, no para contenido estático;
- imagen/ilustración decorativa con `aria-hidden`; preview informativa con alternativa textual suficiente;
- no autoplay, parallax o movimiento continuo; respetar `prefers-reduced-motion`;
- botones táctiles y enlaces con área suficiente en mobile;
- menú mobile, si existe, con foco, nombre, cierre y relación semántica accesible;
- la distinción “ejemplo ilustrativo / no es análisis real” debe estar en texto, no sólo en badge.

## 16. Component inventory conceptual

Nombres técnicos definitivos quedan para el audit/plan de implementación. La clasificación siguiente es
de diseño y reutilización.

| Elemento | Clasificación | Tratamiento |
|---|---|---|
| Header / navegación pública | ADAPT | Separar responsabilidades del header actual y añadir los dos caminos directos sin crear navegación compleja. |
| Hero | ADAPT | Reordenar el Landing actual: plataforma primero, Portfolio Entry opcional y CTAs comerciales directas. |
| Button | KEEP | Reutilizar primitive vigente y sus variantes primary/secondary/ghost/link con focus. |
| Link / anchor navigation | KEEP / ADAPT | Mantener patrón accesible; reducir anclas a secciones útiles. |
| Badge | KEEP | Usar para eyebrow, `Ejemplo ilustrativo` y estados; no como decoración masiva. |
| Card | KEEP / ADAPT | Usar como estructura para preview y caminos comerciales, sin anidamiento innecesario. |
| Product preview | NEW (pattern) | Crear una composición estática específica de Landing, sin lógica de análisis ni dashboard completo. |
| How Starteria works | ADAPT / NEW (pattern) | Reutilizar primitives y crear sólo el patrón editorial de cuatro etapas. |
| PortfolioEntryBlock | ADAPT (framing) | Mantener runtime y contrato; adaptar presentación pública para que sea opcional. |
| ContinuationChoice | NEW (pattern) | Patrón visual compartido para Early Access/Demo; no implementa sus flujos. |
| Final CTA / footer | ADAPT | Reutilizar Button/Link y mantener footer mínimo. |
| Textarea / Label | KEEP | Sólo para la entrada opcional; conservar accesibilidad y no cambiar lógica. |
| Status presentation | KEEP / ADAPT | Preferir `DomainStatusBadge` sólo cuando semánticamente corresponda; preview puede usar una presentación ilustrativa explícita. |
| Copilot panel | KEEP / OMIT | No mostrar panel persistente en Landing; la IA sólo puede aparecer como apoyo conceptual. |

## 17. Analytics requirements — conceptual only

No se implementan eventos en esta ejecución. El modelo conceptual debe medir comprensión y funnel sin
capturar texto sensible innecesario.

### 17.1 Eventos mínimos

- `landing_view` — carga de la Landing; incluir variante experimental si existe.
- `product_preview_seen` — la preview entra en viewport o se considera vista según criterio de medición.
- `early_access_click` — click en Early Access; distinguir `hero`, `portfolio_entry_block`,
  `commercial_paths`, `final_cta`, `header` y origen `LANDING_DIRECT`.
- `demo_click` — click en Demo Starteria con las mismas posiciones/origen.
- `portfolio_entry_view` — la sección opcional entra en viewport o se muestra en la página.
- `portfolio_entry_start` — acción explícita para comenzar la orientación; no equivale a analizar ni a
  completar una sesión.

### 17.2 Eventos comparativos recomendados

Para comparar conversión directa, uso de orientación y comprensión del funnel, considerar además:

- `landing_cta_impression` con `cta_kind` y `placement`;
- `landing_scroll_depth` por umbrales, sin texto de usuario;
- `landing_path_selected` con `path = EARLY_ACCESS | DEMO | PORTFOLIO_ENTRY`;
- `landing_return_to_choice` si la persona vuelve al bloque de elección;
- resultado posterior de los contratos comerciales sólo con sus eventos propios, distinguiendo
  `LANDING_DIRECT` de `PORTFOLIO_ENTRY_CONTINUATION`.

No interpretar `click` como `submitted`, `scheduled`, `access_granted`, `demo_completed` o
`pilot_started`.

## 18. UX test hypotheses

| Hipótesis | Qué observar | Señal de éxito | Señal de fallo |
|---|---|---|---|
| H1. Se entiende Starteria como plataforma/sistema y no como chatbot. | Primera explicación espontánea tras ver Hero + preview. | La persona menciona trabajo/iniciativas/evidencia/decisiones y no sólo “hablar con una IA”. | Describe Starteria como chatbot, formulario o respuesta automática. |
| H2. Portfolio Entry se entiende como opcional. | Qué acción cree que debe hacer para conocer o continuar. | Puede nombrar Early Access o Demo sin completar el textarea y entiende que la orientación es una alternativa. | Cree que debe escribir una situación antes de acceder o evaluar Starteria. |
| H3. Early Access y Demo se distinguen. | Clasificación de intención y beneficio de cada card. | Identifica Early Access como interés/prueba y Demo como conversación para evaluar el producto. | Usa los CTAs indistintamente o cree que ambos conceden acceso. |
| H4. Demo se interpreta como demo del producto, no revisión del resultado. | Qué espera que ocurra después de click en Demo. | Espera conocer Starteria completo y explorar aplicación al contexto. | Espera que alguien revise o comparta su resultado de Portfolio Entry. |
| H5. La preview explica qué ocurre dentro de Starteria. | Lectura de prioridad, iniciativas, estados, evidencia y decisión. | Puede explicar el flujo y señalar bloqueo/gap/decisión sin creer que son datos suyos. | Ve un dashboard genérico, no entiende las señales o toma el ejemplo como análisis real. |
| H6. La jerarquía de CTA resulta clara. | Primer click y recuerdo de alternativas tras recorrer la página. | Elige un camino coherente sin que Portfolio Entry opaque Early Access/Demo; puede encontrar la alternativa después. | Hay tres acciones que parecen primarias o Portfolio Entry domina la elección. |

El testing debe incluir desktop y mobile, y una variante con el orden Early Access/Demo invertido si se
quiere validar la hipótesis de CTA primaria.

## 19. Acceptance traceability

| Requisito de esta spec | ADR-006 | Portfolio Entry Contract | Early Access Contract | Demo Contract | Checklist | Design System |
|---|---|---|---|---|---|---|
| Landing explica plataforma sin interacción | §§4.1, 6 | §5 PE-LANDING-01 | §3.1 | §3.1 | A1–A3, B | PublicLandingPage; product-first |
| Estrategia/necesidad → iniciativas → evidencia/avance → decisiones | §§4.1, 4.5 | §1 / §3, sin canonicalizar | §1 | §1, §4 | A2 | E2E Landing; Core v0.2 INV-01 |
| Preview ilustrativa, no análisis real | §§4.5, 6, 10 | §21 preview de valor | no canonicalización | no canonicalización | A4–A6 | Editorial preview; no dashboard |
| Portfolio Entry opcional y sin gate | §§4.2, 5, 6 | §5 PE-LANDING-01, §22 | §3.2 | §3.2 | B3–B4, C | Optional block; first viewport product |
| Input/CTA/microcopy de orientación | §5 | §§4, 7, 21 | contexto opcional | contexto opcional | C2–C6 | Textarea, Button, Label |
| Early Access directo | §§4.3–4.4, 8 | §22 | §§1–4, 8–10 | — | B1, G | One primary CTA; semantic states |
| Demo directa y del producto completo | §§4.3–4.4, 8 | §22 | — | §§1–4, 8–11 | B2, H1–H4 | Continuation pattern; copy rules |
| Demo ≠ Pilot | §8, §10 | §22 | — | §11 | H3–H4 | No unsupported claim |
| Tres caminos visibles y separados | §§4.4, 8–9 | §5 PE-LANDING-01 | §§3, 8 | §§3, 8 | B3–B5, I | Action hierarchy |
| No cambia Core, Handoff ni Step 0–4 | §§9–10, 16–18 | §§15, 22, 26 | §§0, 12, 16 | §§0, 13, 16 | D, J | No-regression principles |
| Accesibilidad y responsive | ADR §17 implication | §26 UX | §13 | §15 | Evidencia futura | DS §§28–31; Page Anatomy §§2, 18 |
| Eventos conceptuales por origen | ADR §8 | eventos propios del contrato | §14 | §14 | Evidencia futura | Experimentation/content separation |

## 20. Out of scope

Esta spec no define:

- pricing;
- pilot contract;
- CRM;
- calendar provider;
- email provider;
- implementación de autenticación;
- persistencia;
- backend APIs;
- rutas técnicas o nombres productivos nuevos;
- formulario detallado de Early Access;
- scheduling flow detallado de Demo;
- Workspace redesign;
- Portfolio Home redesign;
- Step redesign;
- cambios de Core, Adaptive Cycle, gates o autoridad de IA;
- cambios de Portfolio Entry runtime, Clarification, Handoff o Continuation runtime;
- analytics runtime;
- claims de clientes, métricas o disponibilidad comercial.

## 21. Conflictos y decisiones abiertas

### CONFLICT-01 — Landing runtime actual vs autoridad documental

```text
Contract: ADR-006 §§4–9; Portfolio Entry Acceptance Checklist A–C.
Requirement: Landing debe explicar Starteria sin depender de Portfolio Entry y ofrecer Early Access,
Demo y Portfolio Entry como caminos separados.
Current implementation: front/src/app/pages/LandingPage.tsx embebe PortfolioEntryExperience en el
Hero, no expone Early Access/Demo directos y mantiene la orientación como acción dominante.
Observed mismatch: el runtime actual conserva el framing anterior de Landing → Portfolio Entry.
Risk: Portfolio Entry parece obligatorio; el Copilot parece el producto; Demo y Early Access quedan
subordinados o ausentes.
Recommended treatment: UPDATE mediante una futura slice frontend autorizada; conservar Portfolio
Entry runtime sin modificar su lógica.
Requires ADR: no; ADR-006 ya está ACCEPTED. Requiere HU/slice, guardrail check y evidencia.
```

### CONFLICT-02 — Navegación actual vs navegación mínima requerida

```text
Contract: ADR-006 §6 y arquitectura de Landing §§2, 5.
Requirement: facilitar comprensión de producto y acceso directo a Early Access y Demo, además de login
si sigue válido.
Current implementation: navegación de anclas Problema / Cómo funciona / Confianza y login; no hay
acciones directas Early Access/Demo.
Observed mismatch: la navegación prioriza una narrativa de problema/confianza no definida por esta
arquitectura y no expone los caminos comerciales requeridos.
Risk: conversión directa difícil de descubrir y posible confusión entre orientación y producto.
Recommended treatment: ADAPT la navegación en la futura slice de Landing.
Requires ADR: no.
```

### Decisiones abiertas sin conflicto

- Qué CTA será primary entre Early Access y Demo: requiere UX testing, no ADR.
- Orden de las cards comerciales: requiere UX testing, no ADR.
- Disponibilidad real de destinos y copy legal: requiere dueño comercial/legal y los contratos
  posteriores; no se inventa en la implementación.

## 22. Readiness para frontend audit / implementation planning

Es seguro pasar a un **frontend audit / implementation planning** documental y de alcance, con estas
condiciones:

- la implementación no empieza sólo por esta spec: requiere HU de Jira, slice explícito y
  `V2_CHANGE_GUARDRAIL_CHECK`;
- Early Access y Demo deben tener destinos/contratos de implementación aprobados antes de conectar
  CTAs productivas;
- Portfolio Entry se adapta sólo en framing y composición, conservando runtime y su contrato;
- deben planificarse tests de no regresión de Portfolio Entry, Handoff y destinos prohibidos;
- la jerarquía CTA, el peso de Portfolio Entry y la comprensión de Demo quedan como hipótesis a validar;
- el audit debe revisar rutas disponibles sin asumir rutas nuevas, y debe comprobar el estado real de
  auth/login.

No es seguro declarar frontend “listo para implementar” ni crear código con esta spec sola.

## 23. Definition of Done documental

- [x] Page job y mental model definidos.
- [x] IA de seis bloques justificada sin sección de completitud.
- [x] Hero con copy, CTA, microcopy y jerarquía marcada como hipótesis donde corresponde.
- [x] How Starteria works sin taxonomía interna.
- [x] Preview estática, ilustrativa y no reactiva al input público.
- [x] Portfolio Entry explícitamente opcional, con copy baseline y acceso alternativo.
- [x] Early Access y Demo definidos como dos caminos separados.
- [x] Demo diferenciada de Portfolio Entry y Pilot.
- [x] Responsive, estados y accesibilidad de Landing definidos.
- [x] Component inventory KEEP / ADAPT / NEW.
- [x] Analytics conceptuales e hipótesis UX definidos.
- [x] Traceability y out of scope documentados.
- [x] Conflictos actuales registrados sin modificar runtime.
