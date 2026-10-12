export const PORTFOLIO_SETUP_ARRIVAL_PARAM = 'portfolioSetupContinuationId';

export function portfolioSetupArrivalIdentity(pathname: string, search: string): {
  present: boolean; snapshotId: string | null; invalid: boolean;
} {
  // React Router matches trailing slashes and paths case-insensitively by default.
  if (pathname.replace(/\/+$/, '').toLowerCase() !== '/portfolio/inicio') {
    return { present: false, snapshotId: null, invalid: false };
  }
  const params = new URLSearchParams(search);
  if (!params.has(PORTFOLIO_SETUP_ARRIVAL_PARAM)) return { present: false, snapshotId: null, invalid: false };
  const values = params.getAll(PORTFOLIO_SETUP_ARRIVAL_PARAM);
  const snapshotId = values[0]?.trim() ?? '';
  return { present: true, snapshotId: snapshotId || null,
    invalid: values.length !== 1 || !snapshotId || params.has('portfolioEntryContinuationId') };
}
