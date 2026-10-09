import type { ClaimedPortfolioEntrySessionRef, PendingPortfolioEntryClaim, StoredPortfolioEntrySession } from './types';
import { isPortfolioEntryBriefIdentity } from './continuationIdentity';

const CURRENT_SESSION_KEY = 'starteria.portfolioEntry.current';
const PENDING_CLAIM_KEY = 'starteria.portfolioEntry.pendingClaim';
const CLAIMED_NOTICE_KEY = 'starteria.portfolioEntry.claimedNotice';
const CLAIMED_SESSION_KEY = 'starteria.portfolioEntry.claimedSession';
const CRITICAL_HANDOFF_REVIEW_SESSION_KEY = 'starteria.portfolioEntry.criticalHandoffReviewSession';

type ClaimedNotice = {
  sessionId: string;
  claimedAt: string;
};

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function parseSessionRef(raw: string | null): StoredPortfolioEntrySession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPortfolioEntrySession>;
    if (typeof parsed.sessionId === 'string' && typeof parsed.credential === 'string') {
      return { sessionId: parsed.sessionId, credential: parsed.credential };
    }
  } catch {
    return null;
  }
  return null;
}

export function savePortfolioEntryCurrentSession(ref: StoredPortfolioEntrySession): void {
  getSessionStorage()?.setItem(CURRENT_SESSION_KEY, JSON.stringify(ref));
}

export function readPortfolioEntryCurrentSession(): StoredPortfolioEntrySession | null {
  return parseSessionRef(getSessionStorage()?.getItem(CURRENT_SESSION_KEY) ?? null);
}

export function clearPortfolioEntryCurrentSession(): void {
  getSessionStorage()?.removeItem(CURRENT_SESSION_KEY);
}

/** Local presentation marker that distinguishes new Critical Handoff reviews from historical legacy reviews. */
export function markCriticalHandoffReviewSession(sessionId: string): void {
  getSessionStorage()?.setItem(CRITICAL_HANDOFF_REVIEW_SESSION_KEY, sessionId);
}

export function hasCriticalHandoffReviewSession(sessionId: string): boolean {
  return getSessionStorage()?.getItem(CRITICAL_HANDOFF_REVIEW_SESSION_KEY) === sessionId;
}

export function clearCriticalHandoffReviewSession(): void {
  getSessionStorage()?.removeItem(CRITICAL_HANDOFF_REVIEW_SESSION_KEY);
}

export function savePendingPortfolioEntryClaim(ref: PendingPortfolioEntryClaim): void {
  getSessionStorage()?.setItem(PENDING_CLAIM_KEY, JSON.stringify(ref));
}

export function readPendingPortfolioEntryClaim(): PendingPortfolioEntryClaim | null {
  const raw = getSessionStorage()?.getItem(PENDING_CLAIM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPortfolioEntryClaim>;
    if (typeof parsed.sessionId === 'string' && typeof parsed.credential === 'string') {
      return {
        sessionId: parsed.sessionId,
        credential: parsed.credential,
        ...(isPortfolioEntryBriefIdentity(parsed.identity) ? { identity: parsed.identity } : {}),
        ...(parsed.criticalHandoffReview === true ? { criticalHandoffReview: true } : {}),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPendingPortfolioEntryClaim(): void {
  getSessionStorage()?.removeItem(PENDING_CLAIM_KEY);
}

export function savePortfolioEntryClaimedNotice(sessionId: string): void {
  const notice: ClaimedNotice = { sessionId, claimedAt: new Date().toISOString() };
  getSessionStorage()?.setItem(CLAIMED_NOTICE_KEY, JSON.stringify(notice));
}

export function readPortfolioEntryClaimedNotice(): ClaimedNotice | null {
  const raw = getSessionStorage()?.getItem(CLAIMED_NOTICE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClaimedNotice>;
    if (typeof parsed.sessionId === 'string' && typeof parsed.claimedAt === 'string') {
      return { sessionId: parsed.sessionId, claimedAt: parsed.claimedAt };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPortfolioEntryClaimedNotice(): void {
  getSessionStorage()?.removeItem(CLAIMED_NOTICE_KEY);
}

export function saveClaimedPortfolioEntrySession(ref: ClaimedPortfolioEntrySessionRef): void {
  getSessionStorage()?.setItem(CLAIMED_SESSION_KEY, JSON.stringify(ref));
}

export function readClaimedPortfolioEntrySession(): ClaimedPortfolioEntrySessionRef | null {
  const raw = getSessionStorage()?.getItem(CLAIMED_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClaimedPortfolioEntrySessionRef>;
    if (typeof parsed.sessionId === 'string') {
      return isPortfolioEntryBriefIdentity(parsed) ? parsed : { sessionId: parsed.sessionId };
    }
  } catch {
    return null;
  }
  return null;
}

export function readClaimedPortfolioEntryBriefIdentity() {
  const claimed = readClaimedPortfolioEntrySession();
  return isPortfolioEntryBriefIdentity(claimed) ? claimed : null;
}

export function clearClaimedPortfolioEntrySession(): void {
  getSessionStorage()?.removeItem(CLAIMED_SESSION_KEY);
}

export function clearPortfolioEntryAnonymousState(): void {
  clearPortfolioEntryCurrentSession();
  clearPendingPortfolioEntryClaim();
}

export function clearPortfolioEntryConversionState(): void {
  clearPortfolioEntryAnonymousState();
  clearPortfolioEntryClaimedNotice();
  if (!readClaimedPortfolioEntryBriefIdentity()) clearClaimedPortfolioEntrySession();
}
