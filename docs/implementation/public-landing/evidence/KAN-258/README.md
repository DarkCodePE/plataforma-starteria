# KAN-258 — Evidencia de implementación Landing V4.2

## Resultado

La landing React reproduce el baseline aprobado V4.2 de
`docs/design-references/landing-v4-2/` como una única narrativa editorial:

1. hero V4.1 centrado y mapa amplio Contexto/Oportunidades/Trabajo → Startería → Foco/Ejecución/Aprendizaje;
2. una única demostración interactiva con tres perspectivas: Estrategia, Ejecución y Resultados;
3. Fab como capacidad técnica complementaria, con revisión y decisión humanas explícitas;
4. públicos asimétricos, FAQ y propósito editorial;
5. conversión mediante el destino comercial configurado, sin enlace ni formulario hacia `/public/start`.

El cambio se limita a frontend, pruebas directas y esta evidencia. No modifica backend, Core,
Steps 0–4, IA productiva, autenticación, permisos, persistencia ni infraestructura.

## TDD y regresión KAN-255

- RED: los siete tests de `LandingPage.test.tsx` fallaron contra la implementación KAN-255 porque
  todavía exigía cuatro etapas y la composición anterior.
- GREEN focal: `LandingPage.test.tsx` y `routes.public-entry.test.tsx`, 10/10.
- La primera suite frontend completa detectó dos expectativas residuales KAN-255 en routing
  (headline y ancla antiguos); se actualizaron al contrato V4.2 y la repetición completa pasó.
- El E2E legacy de Portfolio Entry conserva `/public/start` como ruta aislada, pero actualiza su
  comprobación de landing al headline V4.2. La landing sigue exponiendo cero enlaces a esa ruta.

## Verificación ejecutada

| Gate | Resultado |
| --- | --- |
| Tests focales Landing + routing | PASS — 10/10 |
| Suite frontend completa | PASS |
| Cobertura frontend | PASS — umbrales del repositorio satisfechos |
| `typecheck:front` | PASS |
| Lint baseline | PASS |
| Build de producción | PASS; permanecen los avisos basales de import dinámico y tamaño de bundle |
| Playwright Landing V4.2 | PASS — 2/2 sobre PostgreSQL desechable |
| Viewports | PASS — 1440×900, 1024×900, 768×900 y 390×844 sin overflow horizontal |
| Interacción accesible | PASS — tabs con flechas/Home/End, foco visible, skip link y reduced motion |
| Conversión y separación | PASS — CTA HTTPS configurado y cero `href="/public/start"` |

Los `401` de `/api/v1/auth/refresh` observados durante el E2E son la respuesta esperada al cargar
una ruta pública sin sesión; no afectan la landing ni producen fallo de test.

## Capturas React

- `react-v42-1440x900.png`
- `react-v42-1024x900.png`
- `react-v42-768x900.png`
- `react-v42-390x844.png`
- `react-v42-ejecucion-1440.png`
- `react-v42-ejecucion-390.png`
- `react-v42-resultados-1440.png`
- `react-v42-resultados-390.png`

Las referencias comparadas son `v42_consolidated_{1440,1024,768,390}_full.png` y las capturas
focales de Estrategia, Ejecución y Resultados del paquete aprobado V4.2.

## Aplicación de skills

- `frontend-design-direction` fijó dirección editorial calmada, jerarquía, estados y evidencia
  renderizada en los cuatro viewports.
- `accessibility` guio semántica de tabs, navegación de teclado, foco, contraste y reduced motion.
- `browser-qa` estructuró el recorrido Playwright, los asserts de overflow y las capturas por estado.

El detalle de diferencias está en `VISUAL_DELTA.md` y el registro comprobable en
`design-evidence.json`.

