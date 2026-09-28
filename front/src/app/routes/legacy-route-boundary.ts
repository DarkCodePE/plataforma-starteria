/**
 * The Challenge -> Project route is retained only for existing, unrelated
 * consumers. It is deliberately not a Handoff route.
 *
 * LEGACY_COMPATIBILITY_ONLY
 * classification: NOT_CANONICAL / COMPATIBILITY_ONLY / DEPRECATION_TARGET
 */
export const LEGACY_CHALLENGE_PROJECT_ROUTE = '/projects/new';
export const LEGACY_CHALLENGE_PROJECT_ROUTE_CLASSIFICATION = {
  canonical: false,
  compatibilityOnly: true,
  deprecationTarget: true,
} as const;

/** Use only from explicitly inventoried compatibility consumers. */
export function buildLegacyChallengeProjectPath(challengeId: string): string {
  return `${LEGACY_CHALLENGE_PROJECT_ROUTE}?challengeId=${encodeURIComponent(challengeId)}`;
}
