/**
 * Fixed administrative operation for the persistent Startería Internal Lab.
 *
 * Safe by default: without --apply it executes a read-only inspection. The
 * production workflow supplies actors explicitly and stores the resulting
 * organizationId only in a short-lived private artifact.
 */
import { chmod, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import {
  INTERNAL_LAB_CONFIRMATION,
  inspectStarteriaInternalLab,
  InternalLabAdminError,
  provisionStarteriaInternalLab,
} from './starteria-internal-lab-admin.service';

const prisma = new PrismaClient();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = {
    custodianUserId: required(args, 'custodian-user-id'),
    approvedByUserId: required(args, 'approved-by-user-id'),
    approvalReference: required(args, 'approval-reference'),
  };
  const reportFile = required(args, 'report-file');
  const apply = args.has('apply');
  if (apply && args.get('confirm') !== INTERNAL_LAB_CONFIRMATION) {
    throw new InternalLabAdminError(
      'INTERNAL_LAB_EXPLICIT_CONFIRMATION_REQUIRED',
      `La escritura requiere --confirm ${INTERNAL_LAB_CONFIRMATION}.`,
    );
  }

  const result = apply
    ? await provisionStarteriaInternalLab(prisma, command)
    : await inspectStarteriaInternalLab(prisma, command);
  const report = {
    schemaVersion: 'starteria.internal-lab.admin-report.v1',
    mode: apply ? 'APPLY' : 'READ_ONLY_PREFLIGHT',
    generatedAt: new Date().toISOString(),
    result,
  };
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(reportFile, 0o600);
  console.log(`Startería Internal Lab ${apply ? 'operation' : 'preflight'} completed; private report contents omitted.`);
}

function parseArgs(values: string[]): Map<string, string> {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) throw new InternalLabAdminError('INTERNAL_LAB_ARGUMENT_INVALID', 'Argumento administrativo inválido.');
    const key = value.slice(2);
    if (key === 'apply') {
      parsed.set(key, 'true');
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith('--')) throw new InternalLabAdminError('INTERNAL_LAB_ARGUMENT_VALUE_REQUIRED', `Falta valor para --${key}.`);
    parsed.set(key, next);
    index += 1;
  }
  return parsed;
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key)?.trim();
  if (!value) throw new InternalLabAdminError('INTERNAL_LAB_ARGUMENT_REQUIRED', `Falta --${key}.`);
  return value;
}

main()
  .catch((error) => {
    const code = error instanceof InternalLabAdminError ? error.code : 'INTERNAL_LAB_ADMIN_OPERATION_FAILED';
    const message = error instanceof Error ? error.message : 'Fallo administrativo no identificado.';
    console.error(`${code}: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
