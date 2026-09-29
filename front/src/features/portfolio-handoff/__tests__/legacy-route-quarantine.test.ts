import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_CHALLENGE_PROJECT_ROUTE,
  LEGACY_CHALLENGE_PROJECT_ROUTE_CLASSIFICATION,
} from '../../../app/routes/legacy-route-boundary';

const root = resolve(process.cwd(), '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const handoffFiles = [
  'front/src/app/pages/HandoffInvitationPage.tsx',
  'front/src/app/routes.ts',
  'front/src/features/portfolio-handoff/components/HandoffShell.tsx',
  'front/src/features/portfolio-handoff/services/handoffInvitationService.ts',
];

const forbiddenHandoffReferences = [
  '/projects/new?challengeId=',
  'buildLegacyChallengeProjectPath',
  'createProjectFromPublicDraft',
  'ProjectService.createProject',
  'updateStep0',
];

describe('H-TECH-09 legacy route quarantine', () => {
  it('classifies the Challenge -> Project route as compatibility-only and non-canonical', () => {
    expect(LEGACY_CHALLENGE_PROJECT_ROUTE).toBe('/projects/new');
    expect(LEGACY_CHALLENGE_PROJECT_ROUTE_CLASSIFICATION).toEqual({
      canonical: false,
      compatibilityOnly: true,
      deprecationTarget: true,
    });
  });

  it('keeps the canonical Handoff surface free of the legacy route and materialization calls', () => {
    for (const file of handoffFiles) {
      const source = read(file);
      for (const forbidden of forbiddenHandoffReferences) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('keeps Handoff navigation on the invitation route and out of Step navigation', () => {
    const routes = read('front/src/app/routes.ts');
    expect(routes).toContain("path: '/handoff/invitations/:token'");
    expect(routes).not.toContain("path: '/handoff/invitations/:token/step");
    expect(read('front/src/features/portfolio-handoff/components/HandoffShell.tsx')).not.toContain('currentStep');
  });

  it('preserves explicitly inventoried unrelated legacy consumers', () => {
    expect(read('front/src/app/pages/PortfolioLeadChallengesPage.tsx')).toContain('buildLegacyChallengeProjectPath');
    expect(read('front/src/app/pages/ParticipantChallengeDetailPage.tsx')).toContain('buildLegacyChallengeProjectPath');
  });
});
