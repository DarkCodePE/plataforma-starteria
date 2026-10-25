import { describe, expect, it, vi } from 'vitest';
import { ImportedInitiativeCanonicalizationService } from '../imported-initiative-canonicalization.service';

describe('ImportedInitiativeCanonicalizationService / KAN-182 owner gate', () => {
  it('blocks REGISTER_EXISTING until an authorized downstream owner consumer exists', async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new ImportedInitiativeCanonicalizationService(prisma);

    await expect(service.execute({
      organizationId: 'org-1', challengeId: 'challenge-1', workItemId: 'work-1',
      mode: 'REGISTER_EXISTING', expectedWorkItemUpdatedAt: new Date().toISOString(),
      identityConfirmed: true, alignmentConfirmed: true, actorId: 'lead-1', idempotencyKey: 'register-1',
    })).rejects.toMatchObject({ code: 'IMPORTED_INITIATIVE_REGISTER_EXISTING_BLOCKED', statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
