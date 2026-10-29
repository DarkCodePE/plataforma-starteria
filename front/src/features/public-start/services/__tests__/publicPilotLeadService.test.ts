/**
 * Tests for publicPilotLeadService (TASK-012 / SPEC-003 §Flujo B).
 *
 * Locks the API-backed contract + bounded sessionStorage success cache:
 *   - submit POSTs to /public/pilot-leads and returns the server lead (pilotCode)
 *   - a successful submit is cached and retrievable by draftId
 *   - a network failure rejects WITHOUT caching (no false "submitted" state)
 *
 * The service builds its own bare axios instance, so we mock `axios.create`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const PILOT_CODE = `ST-PILOT-${'AB'.repeat(32)}`;

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock('axios', () => ({
  default: { create: () => ({ post: postMock }) },
}));

import {
  submitPilotInterest,
  getPilotInterestByDraftId,
  setPendingPilotClaim,
  getPendingPilotClaim,
  type PilotInterestPayload,
} from '../publicPilotLeadService';

const DRAFT_ID = 'draft-pilot-1';
const PAYLOAD: PilotInterestPayload = {
  name: '  Ana Rodríguez ',
  email: '  Ana@Example.com ',
  phone: ' +51 999 888 777 ',
  organization: ' Efectiva ',
  consentAccepted: true,
};

function okResponse() {
  return {
    data: {
      success: true,
      data: { id: 'lead-uuid-1', pilotCode: PILOT_CODE, status: 'submitted', createdAt: '2026-05-29T12:00:00.000Z' },
    },
  };
}

beforeEach(() => {
  postMock.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('publicPilotLeadService', () => {
  it('POSTs trimmed/normalized data and returns the server lead', async () => {
    postMock.mockResolvedValue(okResponse());

    const lead = await submitPilotInterest(DRAFT_ID, PAYLOAD);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe('/public/pilot-leads');
    expect(body).toMatchObject({
      draftId: DRAFT_ID,
      name: 'Ana Rodríguez',
      email: 'ana@example.com',
      organization: 'Efectiva',
      consentAccepted: true,
    });

    expect(lead.id).toBe('lead-uuid-1');
    expect(lead.pilotCode).toBe(PILOT_CODE);
    expect(lead.status).toBe('submitted');
  });

  it('caches a successful submit, retrievable by draftId', async () => {
    postMock.mockResolvedValue(okResponse());
    expect(getPilotInterestByDraftId(DRAFT_ID)).toBeNull();

    await submitPilotInterest(DRAFT_ID, PAYLOAD);

    const cached = getPilotInterestByDraftId(DRAFT_ID);
    expect(cached?.pilotCode).toBe(PILOT_CODE);
    expect(cached?.email).toBe('ana@example.com');
    expect(window.localStorage.length).toBe(0);
    expect(window.localStorage.getItem('starteria.publicPilot.leads')).toBeNull();
  });

  it('rejects on network failure and does NOT cache (no false submitted state)', async () => {
    postMock.mockRejectedValue(new Error('Network Error'));

    await expect(submitPilotInterest(DRAFT_ID, PAYLOAD)).rejects.toThrow();
    expect(getPilotInterestByDraftId(DRAFT_ID)).toBeNull();
  });

  it('keeps claim credentials tab-scoped and drops them at their server expiry', () => {
    const future = { claimToken: 'secret-claim', expiresAt: new Date(Date.now() + 60_000).toISOString(), name: 'Ana', organization: null, hasProposal: true };
    setPendingPilotClaim(future);
    expect(getPendingPilotClaim()).toEqual(future);
    expect(window.localStorage.getItem('starteria.pilotClaim')).toBeNull();

    setPendingPilotClaim({ ...future, expiresAt: new Date(Date.now() - 1).toISOString() });
    expect(getPendingPilotClaim()).toBeNull();
    expect(window.sessionStorage.getItem('starteria.pilotClaim')).toBeNull();
  });
});
