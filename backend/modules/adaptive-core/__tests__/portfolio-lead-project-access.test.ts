import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { createCycleStore, makeCyclePrisma, seedCycleProject } from './cycle-test-utils';

// El Portfolio Lead asignado en InitiativeGovernance decide sin ser miembro del equipo (§23,
// ADR-025). Antes, getAccessibleProject sólo dejaba pasar admin, mentor o miembros, y en
// producción el lead recibía PROJECT_ACCESS_DENIED al pedir la readiness (2026-10-07).
function seed(governance?: { mode: string; portfolioLeadUserId: string | null }) {
  const store = createCycleStore();
  const project = seedCycleProject(store, { currentStep: 4 });
  store.user.push(
    { id: 'lead-1', organizationId: project.organizationId },
    { id: 'lead-2', organizationId: project.organizationId },
  );
  store.initiativeCycle.push({ id: 'cycle-1', projectId: project.id, cycleNumber: 1, startStep: 0, currentStep: 4, status: 'active' });
  if (governance) store.initiativeGovernance.push({ id: 'gov-1', projectId: project.id, ...governance });
  return { service: new AdaptiveCoreService(makeCyclePrisma(store) as any), projectId: project.id };
}

describe('Acceso del Portfolio Lead asignado a la iniciativa', () => {
  it('el Portfolio Lead asignado lee la readiness sin ser miembro del equipo', async () => {
    const { service, projectId } = seed({ mode: 'portfolio_governed', portfolioLeadUserId: 'lead-1' });
    const assessment = await service.getDecisionReadiness(projectId, 'lead-1', 'portfolio_lead', 'continue_experimenting');
    expect(assessment.projectId).toBe(projectId);
  });

  it('otro Portfolio Lead que no está asignado sigue sin acceso', async () => {
    const { service, projectId } = seed({ mode: 'portfolio_governed', portfolioLeadUserId: 'lead-1' });
    await expect(service.getDecisionReadiness(projectId, 'lead-2', 'portfolio_lead', 'continue_experimenting'))
      .rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('sin governance, un no miembro sigue sin acceso', async () => {
    const { service, projectId } = seed();
    await expect(service.getDecisionReadiness(projectId, 'lead-1', 'portfolio_lead', 'continue_experimenting'))
      .rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});

describe('Acceso de mentor limitado por asignacion real', () => {
  it('rechaza al mentor global no asignado', async () => {
    const { service, projectId } = seed();
    await expect(service.getState(projectId, 'mentor-global', 'mentor'))
      .rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('permite leer al mentor expresamente miembro del proyecto', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store, { currentStep: 0 });
    const mentor = { userId: 'mentor-assigned', projectId: project.id, role: 'VIEWER', status: 'ACTIVE' };
    project.teamMembers.push(mentor);
    store.teamMember.push(mentor);
    store.user.push({ id: mentor.userId, organizationId: project.organizationId });
    store.initiativeCycle.push({ id: 'cycle-mentor', projectId: project.id, cycleNumber: 1, startStep: 0, currentStep: 0, status: 'active' });

    await expect(new AdaptiveCoreService(makeCyclePrisma(store) as any).getState(project.id, mentor.userId, 'mentor'))
      .resolves.toMatchObject({ cycle: { id: 'cycle-mentor' } });
  });
});

describe('El Portfolio Lead asignado no hace el trabajo del equipo', () => {
  it('no confirma checkpoints de la iniciativa', async () => {
    const { service, projectId } = seed({ mode: 'portfolio_governed', portfolioLeadUserId: 'lead-1' });
    await expect(service.confirmCheckpoint(projectId, 'lead-1', 'portfolio_lead', {
      checkpointKey: 'CP-0.1', idempotencyKey: 'k-lead', response: {},
    } as any)).rejects.toMatchObject({ code: 'PROJECT_TEAM_ACCESS_REQUIRED' });
  });
});
