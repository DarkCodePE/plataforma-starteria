import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../app/services/api';
import { acceptHandoffAssignment, rejectHandoffAssignment, startAssignedWork } from '../handoffInvitationService';

vi.mock('../../../../app/services/api', () => ({ default: { post: vi.fn() } }));

const commandResponse = {
  targetKind: 'EXISTING_INITIATIVE', challengeId: 'challenge-1', initiativeId: 'project-1', briefVersion: null,
  state: 'ACCEPTED', version: 4, rejectionReason: null, portfolioResponse: null, acceptedAt: '2026-11-01T08:00:00.000Z', rejectedAt: null,
};

describe('handoffInvitationService command continuity', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  it('preserves the known assignment id when command responses omit it', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { data: commandResponse } })
      .mockResolvedValueOnce({ data: { data: { ...commandResponse, state: 'REJECTED' } } })
      .mockResolvedValueOnce({ data: { data: { ...commandResponse, state: 'STARTED', version: 5 } } });

    await expect(acceptHandoffAssignment('assignment-1', 3)).resolves.toMatchObject({ assignmentId: 'assignment-1', state: 'ACCEPTED' });
    await expect(rejectHandoffAssignment('assignment-2', 'No disponible', 3)).resolves.toMatchObject({ assignmentId: 'assignment-2', state: 'REJECTED' });
    await expect(startAssignedWork('assignment-3', 4)).resolves.toMatchObject({ assignmentId: 'assignment-3', state: 'STARTED' });
  });
});
