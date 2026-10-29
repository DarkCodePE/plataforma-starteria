import { ProjectService } from '../projects/project.service';
import type { PilotProjectCreator } from './pilot-claim.service';
import {
  mapProposalToStep0Data,
  deriveProjectName,
  type PilotProposalSnapshot,
} from './pilot-proposal.mapper';

/** Production claim callback, exported so PostgreSQL tests exercise the exact wiring. */
export const createPilotProject: PilotProjectCreator = async (userId, role, lead, tx) => {
  const projectService = new ProjectService(tx as never);
  const proposal = (lead.proposal ?? null) as PilotProposalSnapshot | null;
  const project = await projectService.createProject(userId, { name: deriveProjectName(proposal) });
  await tx.project.update({
    where: { id: project.id },
    data: { pilotLeadId: lead.id },
  });
  const step0 = mapProposalToStep0Data(proposal);
  if (step0) {
    await projectService.updateStep0(project.id, userId, role as never, step0 as never, 'IN_PROGRESS' as never);
  }
  return project.id;
};
