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

export type StarteriaPathAnalyticsEvent =
  | 'starteria_path_viewed'
  | 'tangible_value_viewed'
  | 'conversion_cta_viewed'
  | 'early_access_clicked'
  | 'demo_clicked'
  | 'context_share_opt_in'
  | 'context_share_declined'
  | 'conversion_submitted';

const PATH_EVENT_PROPERTIES = {
  destinationType: ['DEMO', 'EARLY_ACCESS'],
  availabilityState: ['NO_VERIFIED_DESTINATION', 'DEMO_ONLY', 'EARLY_ACCESS_ONLY', 'EARLY_ACCESS_AND_DEMO'],
  resultCategory: ['RECEIVED'],
  experienceState: ['SUPPORTED', 'BOUNDED'],
} as const;

/** Product telemetry is deliberately restricted to categorical, non-identifying facts. */
export function trackStarteriaPathEvent(
  event: StarteriaPathAnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  const payload: Record<string, string | boolean> = {};
  for (const key of Object.keys(PATH_EVENT_PROPERTIES) as Array<keyof typeof PATH_EVENT_PROPERTIES>) {
    const value = properties[key];
    if (typeof value === 'string' && (PATH_EVENT_PROPERTIES[key] as readonly string[]).includes(value)) {
      payload[key] = value;
    }
  }
  for (const key of ['contextShared', 'idempotentReplay'] as const) {
    if (typeof properties[key] === 'boolean') payload[key] = properties[key];
  }
  dispatchAnalyticsEvent(event, payload);
}

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
  dispatchAnalyticsEvent(event, sanitizePayload(payload));
}

function dispatchAnalyticsEvent(event: PortfolioEntryAnalyticsEvent | StarteriaPathAnalyticsEvent,
  payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const detail = { ...payload, event };
  try { window.dispatchEvent(new CustomEvent(event, { detail })); } catch { /* Analytics is non-authoritative. */ }
  try {
    const dataLayer = (window as unknown as { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
    dataLayer?.push(detail);
  } catch { /* A provider failure must not affect the Path or submission. */ }
}
