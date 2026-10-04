# P-01 — Incorporar el E2E Job-Driven como Experience Contract

**Estado:** Propuesto · 2026-10-04 · requiere decisión de producto

## Contexto

`doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md` describe la experiencia de punta a punta desde los
Jobs de la persona. Está en el árbol de trabajo pero **no versionado** y **no figura** en
`doc/STARTERIA_AUTHORITY.md`; su propio estado es "propuesto para contraste y validación".

Aun así, ya gobierna código: la suite `front/e2e/job-driven/` (29+ tests) y las olas 1–6 lo citan por
sección, y `front/e2e/job-driven/COVERAGE.md` mapea cada sección a un test. Sin estado de autoridad,
cualquier contradicción con un contrato activo se resuelve contra él por omisión.

## Decisión propuesta

1. Versionar el doc en `doc/experience/` como **Experience Contract v0.2 — estado: propuesto**.
2. Sumarlo a `STARTERIA_AUTHORITY.md` en el nivel de Experience Contracts, subordinado al Core v0.2
   y a los ADRs de producto, por debajo del Portfolio Entry Logic Contract en lo que toca a la
   entrada pública (ver P-02).
3. Declarar sus cinco escenarios como **fixtures E2E**, no entradas canónicas (lo dice su §2).

## Consecuencias

- Las olas implementadas quedan trazables a un contrato con estado explícito.
- Los conflictos ya detectados (P-02, P-03) se deciden contra una autoridad conocida.
- Si no se adopta, la suite sigue siendo útil como regresión, pero sus aserciones dejan de tener
  respaldo contractual y deberían revisarse.
