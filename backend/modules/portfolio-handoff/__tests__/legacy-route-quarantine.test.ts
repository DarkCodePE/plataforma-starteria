import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '..');
const handoffRoot = resolve(root, 'backend/modules/portfolio-handoff');
const handoffFiles = [
  'application/portfolio-handoff-assignment.service.ts',
  'application/portfolio-handoff-delivery.service.ts',
  'application/portfolio-handoff-invitation.service.ts',
  'application/portfolio-handoff-response.service.ts',
  'application/portfolio-handoff-semantic-event.projector.ts',
  'portfolio-handoff-invitation.router.ts',
];

describe('H-TECH-09 backend quarantine', () => {
  it('keeps every Handoff application/router free of Project and Step materialization', () => {
    const forbidden = [
      'ProjectService.createProject',
      'createProjectFromPublicDraft',
      'updateStep0',
      'InitiativePortfolioMeta',
      'Step 0',
    ];
    for (const relative of handoffFiles) {
      const source = readFileSync(resolve(handoffRoot, relative), 'utf8');
      for (const value of forbidden) {
        expect(source, `${relative} contains ${value}`).not.toContain(value);
      }
    }
  });

  it('preserves the Challenge start boundary with no Initiative reference', () => {
    const source = readFileSync(resolve(handoffRoot, 'application/portfolio-handoff-response.service.ts'), 'utf8');
    expect(source).toContain('initiativeId: updated.initiativeId');
    expect(source).toContain('targetKind: updated.targetKind');
  });
});
