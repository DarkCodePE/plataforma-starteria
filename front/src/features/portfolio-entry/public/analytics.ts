export type PortfolioEntryAnalyticsEvent =
  | 'public_entry_started'
  | 'portfolio_entry_session_created'
  | 'portfolio_entry_first_message_submitted'
  | 'clarification_displayed'
  | 'clarification_answered'
  | 'guided_exploration_offered'
  | 'guided_exploration_accepted'
  | 'guided_provisional_route_selected'
  | 'handoff_generated'
  | 'handoff_corrected'
  | 'handoff_confirmed'
  | 'critical_handoff_confirmed'
  | 'signup_gate_reached'
  | 'portfolio_entry_claimed'
  | 'portfolio_entry_conversion_cta_viewed'
  | 'portfolio_entry_conversion_started'
  | 'portfolio_entry_conversion_completed'
  | 'portfolio_entry_conversion_failed'
  | 'portfolio_entry_overview_opened'
  | 'session_expired'
  | 'portfolio_entry_api_failure';

const SENSITIVE_KEYS = new Set([
  'credential',
  'token',
  'accessToken',
  'publicAccessToken',
  'publicAccessTokenHash',
  'message',
  'rawInput',
  'userInput',
  'provider',
  'model',
]);

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (SENSITIVE_KEYS.has(key)) return false;
      if (typeof value === 'string' && value.length > 180) return false;
      return true;
    }),
  );
}

export function trackPortfolioEntryEvent(
  event: PortfolioEntryAnalyticsEvent,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;
  const detail = { event, ...sanitizePayload(payload) };
  window.dispatchEvent(new CustomEvent(event, { detail }));
  const dataLayer = (window as unknown as { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  dataLayer?.push(detail);
}
