/**
 * backfill-initiative-governance.ts — P-04 (docs/e2e-job-driven/adr-propuestas).
 *
 * Las iniciativas ligadas a un Reto creadas antes de la ola 7 no tienen InitiativeGovernance, así que
 * no pueden recibir una decisión organizacional (DECISION_AUTHORITY_REQUIRED). Este script les aplica
 * la misma regla que el flujo nuevo: portfolio_governed, con el owner del Reto o del Frente como
 * Portfolio Lead (initiative-governance.ts).
 *
 * Seco por defecto: lista lo que haría. Con --apply escribe. Idempotente: sólo crea filas que faltan;
 * nunca toca una governance existente. Retos sin owner quedan con lead null, que el resolver de
 * autoridad reporta como `unassigned` hasta que un lead lo asigne por API.
 *
 * Uso (desde front/, donde viven el cliente de prisma y el .env):
 *   cd front && npx tsx ../backend/scripts/backfill-initiative-governance.ts          # ver
 *   cd front && npx tsx ../backend/scripts/backfill-initiative-governance.ts --apply  # escribir
 */
import { PrismaClient } from '@prisma/client';
import { governanceForChallengeInitiative } from '../modules/adaptive-core/initiative-governance';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const metas = await prisma.initiativePortfolioMeta.findMany({
    where: { project: { initiativeGovernance: null } },
    select: {
      projectId: true,
      challenge: { select: { id: true, title: true, ownerId: true, strategicFront: { select: { ownerId: true } } } },
    },
  });
  const byProject = new Map(metas.map((meta) => [meta.projectId, meta.challenge]));

  let withLead = 0;
  for (const [projectId, challenge] of byProject) {
    const governance = governanceForChallengeInitiative(challenge);
    if (governance.portfolioLeadUserId) withLead += 1;
    console.log(`${apply ? 'crear' : 'crearía'} ${projectId} ← reto "${challenge.title}" lead=${governance.portfolioLeadUserId ?? '(sin asignar)'}`);
    if (apply) {
      await prisma.initiativeGovernance.upsert({ where: { projectId }, update: {}, create: { projectId, ...governance } });
    }
  }
  console.log(`\n${byProject.size} iniciativa(s) sin governance; ${withLead} con lead derivado, ${byProject.size - withLead} sin asignar.`);
  if (!apply) console.log('Modo seco: no se escribió nada. Repetir con --apply para crear las filas.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
