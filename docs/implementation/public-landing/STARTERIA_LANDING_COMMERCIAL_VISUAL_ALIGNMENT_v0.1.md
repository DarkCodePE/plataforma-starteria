# STARTERIA_LANDING_COMMERCIAL_VISUAL_ALIGNMENT_v0.1

**Estado:** PROPOSED / READY_FOR_SHAPING  
**Superficie:** Public Landing `/`  
**Base:** `main` posterior a KAN-112 / PR #134  
**Tipo de cambio:** Alineación comercial + composición visual  
**Cambio funcional nuevo:** únicamente `Reservar demo`  
**No cambia:** Portfolio Entry, Core, Steps, API de negocio, persistencia, auth, lógica de Copilot

---

## 1. Objetivo

Alinear la Public Landing implementada con la propuesta visual aprobada, corrigiendo especialmente la jerarquía comercial:

1. `Reservar demo` pasa a ser el CTA comercial principal.
2. `Quiero alinear mi objetivo primero` permanece como CTA secundario y conduce a `/public/start`.
3. `Iniciar sesión` permanece como acción utilitaria de acceso.
4. El resto del cambio es visual/editorial: composición, jerarquía, iconografía, layout, superficies, conectores y responsive.

La Landing debe explicar y vender Starteria antes de ofrecer la entrada opcional al Copilot.

---

## 2. Decisión de jerarquía de acciones

| Acción | Rol | Prioridad | Destino |
|---|---|---:|---|
| `Reservar demo` | Conversión comercial | Primaria | `DEMO_BOOKING_URL` autorizado |
| `Quiero alinear mi objetivo primero` | Exploración guiada / Portfolio Entry | Secundaria | `/public/start` |
| `Iniciar sesión` | Acceso de usuario existente | Utilitaria | `/auth` o `/dashboard` si autenticado |

### Regla

`Reservar demo` no puede apuntar a `/auth`, `/public/start` ni a una URL ficticia.

Hasta disponer del destino real, el cambio se considera `BLOCKED_BY_DEMO_DESTINATION` para producción, aunque toda la composición visual puede implementarse y validarse.

---

## 3. Cambio funcional único: Reserva de demo

### 3.1 Configuración

Añadir una configuración explícita, por ejemplo:

```text
VITE_DEMO_BOOKING_URL=<url autorizada>
```

No hardcodear una URL comercial directamente dentro de `LandingPage.tsx`.

### 3.2 Comportamiento

- Header: `Reservar demo` visible como CTA primario.
- Hero: `Reservar demo` visible como CTA primario.
- Ambos usan el mismo destino autorizado.
- Si el destino es externo:
  - usar un enlace real;
  - conservar navegación accesible;
  - definir conscientemente si abre en la misma pestaña o nueva pestaña;
  - si abre nueva pestaña, usar `rel="noopener noreferrer"`.
- No crear backend de booking salvo que el proveedor elegido lo requiera.
- No almacenar datos de reserva en Starteria en este alcance.

### 3.3 Fuera de alcance

- CRM.
- lead scoring.
- calendar sync propio.
- webhook comercial.
- automatización de emails.
- tracking publicitario.
- persistencia de formularios de demo en Starteria.

---

## 4. Alineación exacta por sección

### A. Header

**Actual**
- Starteria.
- Cómo funciona.
- Producto.
- Confianza.
- Iniciar sesión.

**Nuevo**
- Marca Starteria.
- Producto.
- Cómo funciona.
- Confianza.
- `Iniciar sesión` como secundaria/utilitaria.
- `Reservar demo` como CTA primario.

**Cambio funcional:** sí, solamente el destino de demo.  
**Resto:** visual.

---

### B. Hero

**Mantener tesis principal**
- `Haz que la estrategia se haga realidad.`

**Jerarquía propuesta**
- eyebrow editorial similar a `DE LA ESTRATEGIA AL IMPACTO REAL`.
- supporting copy orientado a conectar intención, trabajo, personas y evidencia.
- CTA primario: `Reservar demo`.
- CTA secundario: `Quiero alinear mi objetivo primero`.

**Eliminar del Hero como acción dominante**
- `Ya tengo claro qué quiero mover` hacia `/auth`.

El acceso a usuarios existentes ya está cubierto por `Iniciar sesión` en Header.

#### Visual derecho

Transformar el modelo conceptual actual en la composición del mockup:

```text
Objetivos
Necesidades
Iniciativas
Equipos
      → Starteria →
Foco
Coordinación
Evidencia
Decisión
```

Esto es una representación conceptual estática, no una visualización de datos reales.

**Posible:** sí, completamente con React + CSS/Tailwind + SVG/Lucide.  
**No requiere:** backend, canvas, WebGL ni nueva arquitectura.

---

### C. Beneficios rápidos bajo Hero

Representar tres beneficios cortos:

- Más claridad en menos tiempo.
- Equipos alineados.
- Decisiones con evidencia.

Tratarlos como mensajes de valor, no como resultados medidos.

**No introducir números, porcentajes o tiempos garantizados sin evidencia.**

---

### D. Cómo te ayuda Starteria

Recomponer el `VALUE_FLOW` existente como secuencia visual numerada:

1. Define la meta.
2. Alinea el trabajo.
3. Hazlas realidad.
4. Decide.

Cada etapa incluye icono, título y una explicación breve.

**Cambio:** visual/editorial.  
**Lógica:** ninguna.

---

### E. Ejemplo ilustrativo de producto

Adaptar `StarteriaProductPreview` hacia la lectura visual propuesta:

```text
Meta → Alineación → Ejecución → Decisión
```

Debe seguir siendo inequívocamente ficticio.

#### Permitido

- objetivo hipotético;
- iniciativas conectadas;
- personas/equipos representados de forma ilustrativa;
- tareas, bloqueos o documentos ficticios;
- opciones de decisión como ejemplos visuales sin acción.

#### Guardrail

La preview no debe parecer un dashboard real ni una simulación funcional.

Botones como `Invertir`, `Iterar`, `Pivotar`, `Cerrar` son únicamente etiquetas de ejemplo:
- sin `onClick`;
- fuera del tab order;
- sin estado seleccionado;
- con disclaimer visible.

#### Sobre `Reducir 30% el tiempo operativo`

Técnicamente puede renderizarse, pero se debe presentar como **meta hipotética del caso**, no como resultado de Starteria.

Formato recomendado:

```text
Caso ilustrativo
Meta hipotética: “Reducir 30% el tiempo operativo en 6 meses”
```

Nunca:
`Starteria reduce 30% el tiempo operativo`.

---

### F. La brecha estrategia ↔ ejecución

Reemplazar la sección textual de problemas por la composición visual:

**Hoy: fragmentado**
- Objetivos aislados.
- Equipos desconectados.
- Contexto perdido.
- Decisiones tardías.

**Con Starteria: conectado**
- Foco compartido.
- Trabajo coordinado.
- Evidencia conectada.
- Decisiones trazables.

Centro:
`La brecha`.

Esto es una infografía estática.

**Posible:** sí.  
**Funcionalidad:** ninguna.

---

### G. Confianza / autoridad humana

Mantener la semántica actual y llevarla al layout del mockup:

- Puedes empezar con contexto incompleto.
- Nada se convierte en trabajo formal sin revisión.
- La IA estructura y propone; las decisiones siguen siendo humanas.
- Tu entrada pública no crea iniciativas automáticamente.

**Posible:** sí, reutilizando contenido y guardrails ya existentes.

---

### H. CTA final

Recomponer Optional Portfolio Entry como cierre visual:

**Mensaje**
`Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.`

**CTA**
`Analizar mi situación` → `/public/start`

Este CTA permanece secundario respecto de `Reservar demo` en la jerarquía global.

No embebe el Copilot en la Landing.

---

### I. Footer

- Marca.
- Producto.
- Cómo funciona.
- Confianza.
- Acceso.
- Sin CTA comercial duplicado si ya existe inmediatamente antes.

---

## 5. Matriz: propuesta visual vs. factibilidad

| Elemento del mockup | ¿Se puede implementar? | Tratamiento |
|---|---|---|
| Fondo claro u oscuro | Sí | Elegir una variante como autoridad visual; no mantener ambas en runtime |
| Gradientes suaves | Sí | CSS, usando tokens o composición local |
| Hero en dos columnas | Sí | Responsive grid |
| Modelo con nodos y líneas | Sí | CSS/SVG decorativo accesible |
| Iconos por concepto | Sí | Reutilizar Lucide / iconografía DS |
| Flechas manuscritas | Sí | SVG decorativo o eliminarlas en móvil |
| Puntos decorativos | Sí | CSS/SVG, `aria-hidden` |
| Secuencia 01–04 | Sí | Composición estática |
| Preview Meta→Decisión | Sí | Rehacer `StarteriaProductPreview` |
| Avatares | Sí, con límite | Mejor avatares ficticios/abstractos; no personas reales sin permiso |
| Estados/tareas/bloqueos | Sí | Siempre etiquetados como ilustrativos |
| Botones de decisión dentro del mockup | Sí visualmente | No interactivos |
| Diagrama de “La brecha” | Sí | SVG/CSS estático |
| Reserva de demo | Sí | Requiere URL/proveedor real |
| Calendario embebido | Sí técnicamente | Fuera de alcance salvo decisión explícita |
| Métricas reales de impacto | No sin evidencia | No inventar resultados |
| Testimonios/logos de clientes | No sin autorización | No inventar social proof |
| Animación compleja | Posible, no necesaria | Evitar hasta validar conversión |
| Memoria/vector DB/IA nueva | No necesaria | No pertenece a este cambio |

---

## 6. Light vs. Dark

Las dos propuestas compartidas muestran la misma arquitectura en tema claro y oscuro.

### Recomendación

Para este cambio seleccionar **una sola variante como baseline productivo**.

No convertir esta HU en implementación de theming completo.

La variante no elegida puede mantenerse como referencia visual futura.

### Si se elige Light
- menor distancia respecto del runtime actual;
- menor riesgo de contraste;
- menor retrabajo del Design System.

### Si se elige Dark
- mayor impacto visual/comercial;
- exige una revisión más profunda de tokens, contraste, estados y superficies.

---

## 7. Archivos esperados

### Modificar

```text
front/src/app/pages/LandingPage.tsx
front/src/app/pages/__tests__/LandingPage.test.tsx
front/e2e/public-landing-l1.spec.ts
front/e2e/portfolio-entry-conversion.spec.ts   # solo si cambia la semántica del CTA que protege
front/src/app/components/landing/StarteriaProductPreview.tsx
```

### Probables componentes locales

```text
front/src/app/components/landing/LandingHeader.tsx
front/src/app/components/landing/LandingHero.tsx
front/src/app/components/landing/StarteriaConceptMap.tsx
front/src/app/components/landing/LandingValueFlow.tsx
front/src/app/components/landing/StrategyExecutionGap.tsx
front/src/app/components/landing/LandingTrustPrinciples.tsx
front/src/app/components/landing/LandingClosingCta.tsx
```

No convertirlos en primitives globales del Design System salvo evidencia real de reutilización.

---

## 8. Tests requeridos

### Unit / component

Validar:

- `Reservar demo` existe en Header y Hero.
- ambos CTA de demo comparten el destino autorizado.
- `Quiero alinear mi objetivo primero` sigue en `/public/start`.
- `Iniciar sesión` sigue en `/auth`.
- no existe formulario de Portfolio Entry embebido.
- Preview continúa marcada como ilustrativa.
- botones visuales de decisión no son interactivos.
- heading hierarchy y accessible names son estables.

### E2E

1. `/` carga correctamente.
2. CTA secundario Landing → `/public/start`.
3. KAN-102 Landing → Entry continúa verde.
4. demo CTA tiene destino válido.
5. 1440 / 1280 / 1024 / 768 / 390 sin overflow.
6. navegación por teclado.
7. mobile preserva jerarquía:
   - Hero;
   - demo;
   - alineación;
   - explicación;
   - preview;
   - brecha;
   - confianza;
   - CTA final.

---

## 9. Criterios de aceptación

- [ ] `Reservar demo` es la acción visual principal en Header y Hero.
- [ ] `Quiero alinear mi objetivo primero` permanece claramente secundaria.
- [ ] `/public/start` no cambia funcionalmente.
- [ ] `/auth` no cambia funcionalmente.
- [ ] Landing refleja la arquitectura visual del mockup aprobado.
- [ ] Modelo conceptual se integra visualmente en Hero.
- [ ] Value flow se presenta como proceso 01–04.
- [ ] Preview adopta la lectura Meta → Alineación → Ejecución → Decisión.
- [ ] La brecha estrategia/ejecución se presenta visualmente.
- [ ] Principios de autoridad humana permanecen explícitos.
- [ ] No se inventan resultados, clientes, testimonios ni métricas de éxito.
- [ ] No hay nuevas dependencias de IA, memoria o backend para ejecutar la Landing.
- [ ] Responsive y accesibilidad pasan validación.
- [ ] Tests existentes de Portfolio Entry continúan verdes.
- [ ] CI completo queda verde.

---

## 10. Guardrails

### No tocar

- Core.
- Steps 0–4.
- Portfolio Lead.
- Persistencia.
- Portfolio Entry runtime.
- agentes de Portfolio Entry.
- contratos de IA.
- modelos de datos.
- backend salvo una decisión posterior explícita para booking.

### No introducir

- nueva vector DB;
- memoria de agentes;
- LLM adicional;
- MCP adicional;
- analytics inventados;
- feature flags innecesarias;
- rutas ficticias.

---

## 11. Dependencia para implementación

### `DEMO_BOOKING_URL`

Antes de cerrar productivamente esta mejora debe existir una decisión sobre el destino real de `Reservar demo`.

Opciones compatibles:

- Calendly.
- Cal.com.
- HubSpot Meetings.
- Google Calendar appointment schedule.
- otra URL autorizada.

La selección del proveedor no altera el diseño de la Landing.

---

## 12. Evaluación de herramientas externas propuestas

### ECC (`ecc-universal`)

**Útil para el proceso de desarrollo, no para la Landing en runtime.**

Puede ayudar a:
- planificación;
- TDD;
- code review;
- build fixes;
- guardrails del agente.

No añade ninguna capacidad visual o funcional necesaria a Starteria.

Si se adopta:
1. hacerlo en una tarea separada;
2. ejecutar primero `--dry-run`;
3. revisar hooks y archivos que pretende escribir;
4. no mezclar su instalación con el PR de Landing.

### Pi

**Es otro harness de agente de desarrollo.**

Puede ser útil si se decide usar Pi como entorno/harness para trabajo local, pero no mejora la Landing ni es requisito para implementarla.

No conviene instalar Pi solo para resolver este cambio.

### RuVector

**No aplica a esta Landing.**

RuVector puede tener interés futuro para:
- memoria persistente de agentes;
- recuperación semántica;
- clasificación/decisiones locales acotadas;
- relaciones y provenance de memoria.

Eso pertenece a arquitectura de IA/aprendizaje de Starteria, no a la superficie comercial `/`.

Incluir RuVector en este cambio aumentaría dependencias, gobierno de datos y superficie de prueba sin aportar valor al objetivo.

---

## 13. Decisión recomendada

**Implementar la alineación visual con el stack actual de Starteria.**

Para esta HU:

```text
ECC       OPTIONAL / DEV-HARNESS ONLY
Pi        NOT REQUIRED
RuVector  OUT OF SCOPE
```

No instalar ninguna de estas herramientas como dependencia del producto para conseguir fidelidad al mockup.

---

## 14. Definition of Done

El cambio termina cuando:

1. la Landing se parece estructural y visualmente al diseño aprobado;
2. `Reservar demo` es el CTA principal y tiene destino real;
3. `/public/start` permanece como vía complementaria;
4. no existe regresión sobre Portfolio Entry;
5. tests y CI pasan;
6. el cambio continúa siendo esencialmente frontend, salvo la configuración del destino de demo.
