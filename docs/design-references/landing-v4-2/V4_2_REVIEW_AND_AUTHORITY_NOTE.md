# Startería V4.2 — Revisión de Públicos y Propósito

**Estado actualizado:** `READY_FOR_HUMAN_VISUAL_REVIEW / IMPLEMENTATION_BLOCKED`  
**Autoridad productiva:** sin cambios; KAN-257 continúa con `Proceed:NO`.

La revisión inicial detectó contraste insuficiente en la nota final de Públicos y varios elementos heredados de V4. Esos hallazgos están corregidos en la referencia consolidada. El paquete vigente, con ratios, capturas, Lighthouse, QA, archivos productivos previstos y texto de ratificación, es [`KAN-257_V4_2_VISUAL_APPROVAL_PACKAGE.md`](./KAN-257_V4_2_VISUAL_APPROVAL_PACKAGE.md).

## Resultado visual

- Públicos conserva la nueva jerarquía asimétrica: innovación y transformación como módulo protagonista; pequeños negocios y pymes como puntos de entrada diferenciados, no como tres productos ni etapas obligatorias.
- Propósito conserva el manifiesto editorial numerado y elimina la composición orbital de círculos.
- El conjunto preserva hero V4.1, demostración Estrategia/Ejecución/Resultados, impacto, Fab, FAQ y CTA.
- La FAQ, ausente accidentalmente del primer HTML V4.2 pese a que el handoff exigía preservarla, fue restaurada; con ello se eliminaron los enlaces internos muertos a `#confianza`.

## QA final

- 1440×1000, 1024×900, 768×900 y 390×844: sin overflow horizontal ni errores JavaScript.
- Teclado: tabs, foco visible, menú móvil y FAQ pasan.
- `prefers-reduced-motion`: pasa.
- Cero enlaces a `/public/start`.
- Lighthouse en móvil y escritorio, para Estrategia, Ejecución y Resultados: **100 Accessibility / 100 Best Practices / 100 SEO / 100 Agentic Browsing**, cero fallos.
- Nota final de Públicos: `#5f5c73` sobre `#fbfaff`, ratio **6.19:1**.

Comando reproducible:

```powershell
rtk node docs/design-references/landing-v4-2/qa-v4-2-reference.mjs
```

## Autoridad

El kit sigue siendo `DESIGN_REFERENCE_ONLY`. No ratifica KAN-257, no modifica ADR-011 y no crea una entrada activa en `STARTERIA_V2_MANIFEST.md`. No se modificaron `front/`, tests productivos, contratos, Jira ni workflows. No se abrió PR, no se hizo merge y no se ejecutó CD.
