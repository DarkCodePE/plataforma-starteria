# MVP-INT-01 — Git delta manifest

## Destino aislado

- Worktree: `C:\Users\User\proyect-starteria\starteria-mvp-integrated-qa-20261026`
- Rama local: `feat/mvp-integrated-qa-20261026`
- Base local/remota verificada: `fd0757ea93470a6d1ec0ac7faf6734fd7fc97a2f`
- Base remota: `origin/feat/KAN-180-portfolio-lead-integration`
- Index: vacío (`git diff --cached --name-status` sin salida)
- `git diff --check`: PASS

## Fuentes protegidas

| Fuente | HEAD preservado | Uso |
|---|---:|---|
| KAN-178 owner continuity | `d72223150fffa2b54082c2496f1f1b854334b090` | Transplante selectivo de continuidad post-start |
| Steps UX-02B | `270e6fbe12dd143c5c312fb238790a9405bd3ab7` | AI-01/AI-02 + UX-02B compatibles |
| KAN-180 publicado | `fd0757ea93470a6d1ec0ac7faf6734fd7fc97a2f` | Base autoritativa |
| PL06 WIP | `d72223150fffa2b54082c2496f1f1b854334b090` | Inventario/protección; no se sobreescribió KAN-180 |
| AI-01/AI-02 WIP | `270e6fbe12dd143c5c312fb238790a9405bd3ab7` | Implementación Step reasoning |

Los HEAD y estados de las cinco fuentes se verificaron nuevamente después de la integración. No se ejecutaron comandos de escritura Git sobre ellas.

## Copias de seguridad externas

Ruta: `C:\Users\User\proyect-starteria\_codex-backups\MVP-INT-01-20261026`

Contiene por fuente: `head.txt`, `status.txt`, patch de tracked, tar de untracked y `SHA256SUMS.json`. Ejemplos de hashes SHA-256:

- `KAN178-tracked.patch`: `C1DC9F06ECBDAC26210837E0F380ACDC9E544E325DDF214FB227048B1D2C166D`
- `UX02B-tracked.patch`: `6D929395E4D16FCB9B6EA0A092768AFFBB90606F39E28A718CD449DC70EEC603`
- `KAN180-local-tracked.patch`: `9964BB9CE5021FDA10227D69AC8E2FDAA904F9C81D3250B19BBCC50BDA8BC191`

## Familias de delta integradas

- `ai-service`: agente, prompt, schemas, router, model router y tests de Step reasoning.
- `backend/modules/step-reasoning`: contexto, persistencia, servicio, controller, router y tests.
- `backend/modules/portfolio-handoff`: continuidad post-start KAN-178 y tests.
- `front/src/features/step-reasoning` y `Step0Page`: AI-01/AI-02/UX-02B.
- `HandoffInvitationPage` y `OwnerPostStartContinuity`: reentrada Owner.
- Prisma: modelos/migración de Step reasoning, reconciliados con KAN-180.
- `scripts/mvp-integration`: arranque/parada QA y stub IA.
- `artifacts/mvp-integration`: capturas y evidencia de fallos reproducibles.

Los artefactos y entregables permanecen untracked junto al código integrado. No existe commit de integración.
