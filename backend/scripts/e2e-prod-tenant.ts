/**
 * e2e-prod-tenant.ts — usuario y organización dedicados para correr el E2E Job-Driven en producción.
 * Runbook: docs/e2e-job-driven/prod-dedicated-user.md
 *
 * En producción el registro va a waitlist y no hay API para crear organizaciones, así que el tenant
 * de prueba se crea con este script, que corre quien tiene acceso a la base. Crea (idempotente):
 *   - la organización `org-e2e-prod` ("Starteria E2E (prueba)");
 *   - un Portfolio Lead y un participante dedicados en esa organización, activos y fuera de waitlist;
 *   - cuatro miembros más, uno por rol de plataforma, para el swarm de roles
 *     (docs/e2e-job-driven/prod-role-swarm.md). Comparten la contraseña E2E_PROD_MEMBER_PASSWORD.
 * Con `cleanup` borra TODO lo que esos usuarios crearon (frentes con sus retos, proyectos y
 * aprendizajes en cascada). Nunca toca datos de otras organizaciones ni de otros usuarios.
 *
 * Seco por defecto; `--apply` escribe. Contraseñas por env, nunca en el repo:
 *   E2E_PROD_LEAD_PASSWORD, E2E_PROD_PARTICIPANT_PASSWORD, E2E_PROD_MEMBER_PASSWORD
 *
 * Uso (desde front/, con DATABASE_URL de producción):
 *   npx tsx ../backend/scripts/e2e-prod-tenant.ts setup            # ver qué haría
 *   npx tsx ../backend/scripts/e2e-prod-tenant.ts setup --apply
 *   npx tsx ../backend/scripts/e2e-prod-tenant.ts cleanup          # listar lo que borraría
 *   npx tsx ../backend/scripts/e2e-prod-tenant.ts cleanup --apply
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../modules/auth/password.service';

const prisma = new PrismaClient();
const [command] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const apply = process.argv.includes('--apply');

export const E2E_PROD_ORG_ID = 'org-e2e-prod';
export const E2E_PROD_LEAD_EMAIL = process.env.E2E_PROD_LEAD_EMAIL ?? 'e2e-lead@starteria.test';
export const E2E_PROD_PARTICIPANT_EMAIL = process.env.E2E_PROD_PARTICIPANT_EMAIL ?? 'e2e-participante@starteria.test';
// Un miembro por rol de plataforma: en el equipo de una iniciativa cada uno entra como EDITOR o VIEWER.
export const E2E_PROD_MEMBERS = [
  { email: 'e2e-participante-2@starteria.test', name: 'E2E Participante 2', role: 'participante' as const },
  { email: 'e2e-colaborador@starteria.test', name: 'E2E Colaborador', role: 'colaborador' as const },
  { email: 'e2e-viewer@starteria.test', name: 'E2E Viewer', role: 'viewer' as const },
  { email: 'e2e-sponsor@starteria.test', name: 'E2E Sponsor', role: 'sponsor' as const },
];
const SEAT_LIMIT = 2 + E2E_PROD_MEMBERS.length;

function requirePassword(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 12) throw new Error(`${name} es obligatoria (mínimo 12 caracteres) y no se guarda en el repo.`);
  return value;
}

async function setup() {
  const org = await prisma.organization.findUnique({ where: { id: E2E_PROD_ORG_ID } });
  console.log(`${org ? 'existe' : apply ? 'crear' : 'crearía'} organización ${E2E_PROD_ORG_ID}`);
  if (apply && !org) {
    await prisma.organization.create({ data: { id: E2E_PROD_ORG_ID, name: 'Starteria E2E (prueba)', slug: 'starteria-e2e-prueba', seatLimit: SEAT_LIMIT } });
  }
  if (org && org.seatLimit < SEAT_LIMIT) {
    console.log(`${apply ? 'subir' : 'subiría'} seatLimit de ${org.seatLimit} a ${SEAT_LIMIT}`);
    if (apply) await prisma.organization.update({ where: { id: E2E_PROD_ORG_ID }, data: { seatLimit: SEAT_LIMIT } });
  }
  const users = [
    { email: E2E_PROD_LEAD_EMAIL, name: 'E2E Portfolio Lead', role: 'portfolio_lead' as const, passwordEnv: 'E2E_PROD_LEAD_PASSWORD', member: 'admin' },
    { email: E2E_PROD_PARTICIPANT_EMAIL, name: 'E2E Participante', role: 'participante' as const, passwordEnv: 'E2E_PROD_PARTICIPANT_PASSWORD', member: 'member' },
    ...E2E_PROD_MEMBERS.map((m) => ({ ...m, passwordEnv: 'E2E_PROD_MEMBER_PASSWORD', member: 'member' })),
  ];
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    console.log(`${existing ? 'actualizar' : apply ? 'crear' : 'crearía'} ${u.email} (${u.role}) en ${E2E_PROD_ORG_ID}`);
    if (!apply) continue;
    const passwordHash = await hashPassword(requirePassword(u.passwordEnv));
    const data = { name: u.name, role: u.role, roles: [u.role], organizationId: E2E_PROD_ORG_ID, isActive: true, passwordHash } as any;
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data: { ...data, email: u.email, initials: 'E2' } });
    await prisma.organizationMember.deleteMany({ where: { userId: user.id, organizationId: E2E_PROD_ORG_ID } });
    await prisma.organizationMember.create({ data: { organizationId: E2E_PROD_ORG_ID, userId: user.id, role: u.member } });
  }
  if (!apply) console.log('\nModo seco: no se escribió nada. Repetir con --apply.');
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: [E2E_PROD_LEAD_EMAIL, E2E_PROD_PARTICIPANT_EMAIL, ...E2E_PROD_MEMBERS.map((m) => m.email)] } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  // Sólo lo que está en la organización de prueba o pertenece a los usuarios de prueba.
  const fronts = await prisma.strategicFront.findMany({ where: { OR: [{ organizationId: E2E_PROD_ORG_ID }, { ownerId: { in: ids } }] }, select: { id: true, name: true, organizationId: true } });
  const foreign = fronts.filter((f) => f.organizationId && f.organizationId !== E2E_PROD_ORG_ID);
  if (foreign.length > 0) throw new Error(`Abortado: ${foreign.length} frente(s) de los usuarios de prueba están en otra organización: ${foreign.map((f) => f.id).join(', ')}`);
  const projects = await prisma.project.findMany({ where: { ownerId: { in: ids } }, select: { id: true, name: true } });
  console.log(`${apply ? 'borrar' : 'borraría'} ${fronts.length} frente(s) (con sus retos en cascada) y ${projects.length} proyecto(s):`);
  for (const f of fronts) console.log(`  frente ${f.id} ${f.name}`);
  for (const p of projects) console.log(`  proyecto ${p.id} ${p.name}`);
  if (!apply) return console.log('\nModo seco: no se borró nada. Repetir con --apply.');
  await prisma.$transaction([
    prisma.project.deleteMany({ where: { id: { in: projects.map((p) => p.id) } } }),
    prisma.strategicFront.deleteMany({ where: { id: { in: fronts.map((f) => f.id) } } }),
  ]);
  console.log('Listo.');
}

const run = command === 'setup' ? setup : command === 'cleanup' ? cleanup : null;
if (!run) {
  console.error('Uso: e2e-prod-tenant.ts <setup|cleanup> [--apply]');
  process.exitCode = 1;
} else {
  run()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
