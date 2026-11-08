# E2E Staging Runbook

**Purpose:** deploy one explicitly authorized release-candidate commit into an isolated E2E staging runtime, retain its evidence, and run both the repository-defined P12 suite and the G1-G5 A/B/C certification. This runbook does not authorize production deployment, workflow execution, or release certification by itself.

## Current operational status

The KAN-235 read-only audit found that the GitHub Environment `e2e-staging` did not yet exist. Its variables, secrets, effective Rackspace RBAC, isolated PostgreSQL and independent Cloudflare Tunnel therefore remain unverified. Do not dispatch the workflow until an authorized operator has created and independently verified those prerequisites. KAN-236/KAN-237 change repository tests and documentation only; they do not create or validate external infrastructure.

## Isolation contract

- Kubernetes namespace: `starteria-e2e` only.
- Kubernetes identity: a dedicated service identity scoped to `starteria-e2e`; the workflow fails if that identity can read or mutate `starteria`, access cluster-wide protected resources, or create/delete namespaces.
- Database: PostgreSQL 16 StatefulSet and PVC inside `starteria-e2e`, reached by the application at `starteria-db:5432` in that namespace.
- Tenant: `org-e2e-prod`, provisioned after migration only in that isolated database. The legacy script name is reused; it is never run against production here.
- Images: `orlandogtp/starteria-{backend,frontend,ai-service}:e2e-<12-char-sha>`.
- GitHub Environment: `e2e-staging`; the workflow does not select the `production` Environment.
- Tunnel: a tunnel and DNS hostname separate from production, routed only to the frontend service in `starteria-e2e`.
- Email: pinned Mailpit with ephemeral storage. Staging SMTP points only to Mailpit; no production SMTP credential or real delivery is used.

The workflow does not read production Kubernetes secrets, target `starteria`, mount a production PVC, or use a production database URL.

## Required GitHub Environment

Create the GitHub Environment `e2e-staging` only through the separately authorized infrastructure process. Configure deployment protection rules appropriate for an isolated, non-production target.

Before adding secrets, the Rackspace administrator must create `starteria-e2e` and bind the workflow identity only to that namespace. It needs the namespaced `get/list/watch/create/patch` permissions enumerated by the workflow for Secrets, Deployments, StatefulSets, Services, PVCs, NetworkPolicies, Pods, Events and port-forward. It does not need pod exec, namespace reads or namespace creation. It must not have access to `starteria`, cluster-wide Secret/Pod access, or permission to create/delete namespaces. The workflow checks required and forbidden permissions before its first write.

### Environment variable

| Name | Required value |
|---|---|
| `E2E_STAGING_BASE_URL` | Public `https://` URL for the separate staging Cloudflare Tunnel. It is passed to health, smoke and Playwright as `E2E_PROD_BASE_URL`; that legacy variable name does not make the target production. |

### Required secrets

| Secret | Use |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Docker Hub authentication for isolated immutable release images. |
| `RACKSPACE_REFRESH_TOKEN`, `RACKSPACE_ORG_NAME`, `RACKSPACE_CLOUDSPACE_NAME` | Fetch the dedicated namespace-scoped Kubernetes credential; a production-capable credential is rejected. |
| `E2E_STAGING_DB_PASSWORD` | Password for `starteria-db` in `starteria-e2e`. |
| `E2E_STAGING_JWT_SECRET` | JWT secret for staging only. |
| `E2E_STAGING_AI_SERVICE_TOKEN` | Backend-to-AI and webhook token for staging only. |
| `E2E_STAGING_BRIDGE_SHARED_SECRET` | Staging bridge secret. |
| `E2E_STAGING_CLOUDFLARED_TOKEN` | Token for the separate staging tunnel. |
| `E2E_STAGING_LEAD_PASSWORD` | Password for the isolated Portfolio Lead. |
| `E2E_STAGING_PARTICIPANT_PASSWORD` | Password for the isolated Initiative Owner. |
| `E2E_STAGING_MEMBER_PASSWORD` | Password for additional isolated role actors. |
| `OPENROUTER_API_KEY`, `JEV_API_KEY`, `PORTFOLIO_ENTRY_API_KEY` | Provider credentials passed only to staging runtime secrets; the G1-G5 goal suite itself uses the deterministic Bootstrap analyzer and must not generate provider spend. |
| `GOOGLE_CLIENT_ID` | Frontend build argument and backend identity configuration. |

`LANGSMITH_API_KEY` is optional. When present, the deployment identifies itself as `e2e-staging` and uses project `starteria-e2e`. Never place production credentials under staging names or expose secret values in evidence.

## Cloudflare prerequisite

An authorized infrastructure operator must create a separate remotely managed Cloudflare Tunnel and DNS hostname. Its remote configuration must route only to:

```text
http://starteria-frontend.starteria-e2e.svc.cluster.local:80
```

Store that tunnel token as `E2E_STAGING_CLOUDFLARED_TOKEN` and its public URL as `E2E_STAGING_BASE_URL`. Never reuse or edit the production tunnel.

## Authorize and deploy a release candidate

1. Obtain explicit operational authorization for this staging execution and record the approver plus Jira/release reference. Merge approval alone is not execution authorization.
2. Confirm the release candidate exists in this repository's GitHub remote and record its full 40-character SHA. A local-only SHA cannot be fetched or certified.
3. Re-verify the Environment, HTTPS tunnel, Mailpit configuration and namespace-scoped identity against this isolation contract.
4. Open **Actions -> E2E staging P12 -> Run workflow**.
5. Enter `source_ref` as the full 40-character commit SHA. Although the resolver accepts a branch or tag for diagnostics, a movable ref is not acceptable certification evidence.
6. Approve the `e2e-staging` Environment deployment when its protection rule requests it.
7. The workflow resolves and checks out that exact SHA, builds immutable images, deploys only `starteria-e2e`, rejects a non-empty database, applies all 78 canonical migrations, verifies 78/78 plus zero schema drift, provisions the synthetic tenant, exercises Mailpit, executes G1-G5 A/B/C, runs authenticated smoke and finally runs the generic P12 suite.

The resolver fetches only from this repository's `origin`, resolves a full SHA, checks it out detached and uses a SHA-derived immutable tag. It deliberately does not impose the production workflow's ancestry-to-main rule.

## G1-G5 execution contract

The machine-readable inventory is `front/e2e/staging-g1-g5.contract.json`. Its trace is:

```text
goal -> scenario -> environment -> test -> evidence -> CI
```

| Classification | Purpose | Allowed access | Evidence |
|---|---|---|---|
| `local_disposable_db` | Deep lifecycle, concurrency and persistence assertions | Direct Prisma only against disposable local PostgreSQL | Existing KAN-222/212/213/223/227/232 suites; KAN-232 A/B/C stays here |
| `staging_synthetic_provisioning` | Create fixed actors and `org-e2e-prod` before testing | Temporary port-forward only to `starteria-db` in `starteria-e2e`, after RBAC and 78/78 gates | `tenant-provision.log`; application tests never receive the connection string |
| `staging_remote_api_browser` | Observe deployed equivalence through HTTPS, API, browser and Mailpit | No Prisma client, database connection variable, authentication bypass, production URL or cross-namespace access | `goals-g1-g5-playwright.json`, screenshots/traces and selector summary |

`front/e2e/kan232-g5-home-final.spec.ts` imports `PrismaClient`; never add it to `npm run test:e2e:prod`, point it at a production database, or use it as a remote staging spec. Its remote equivalent is `front/e2e/prod/goals-g1-g5-staging.spec.ts`, selected only by `npm run test:e2e:staging-goals` while the isolated Mailpit port-forward is active.

The deployed equivalence has exactly three serial authenticated tests:

- A: G1-G5 context/anchor, the explicit G2 no-work branch with `NO_EXISTING_WORK_ELIGIBLE`, E5 organization, confirmed Brief, Lab notification accepted by Mailpit, completion and Home re-entry.
- B: G1-G5 in a fresh `additional-front` re-entry session with three manual initiatives, deterministic E4 plus human review and `ANALYZED_WORK_ELIGIBLE`, one front/two Briefs, real Team and Lab SMTP acceptance, the third item left unactivated, and factual Home projection.
- C: G1-G5 in another fresh `additional-front` re-entry session with 13 CSV plus 12 XLSX rows, deterministic E4 plus human review and `ANALYZED_WORK_ELIGIBLE`, one front, selective Briefs, Lab completion and responsive Home.

The selector fails closed unless the namespace is exactly `starteria-e2e`, the target is non-production HTTPS, Mailpit is a local port-forward, both actors are authenticated and `E2E_STAGING_SOURCE_SHA` is a full SHA. It statically rejects direct database access and skipped/fixed tests, then requires exactly 3/3 passing and **0 skips** from the Playwright JSON report.

`npm run test:e2e:prod` is a generic P12 command and runs only `job-driven-prod.spec.ts` and `job-driven-prod-cycle.spec.ts`; it does not prove G1-G5. The separate Mailpit Handoff spec proves invitation/acceptance/Steps continuity. The dedicated staging-goals selector proves A/B/C.

## Evidence and release handoff

The workflow leaves staging available and uploads artifacts for 14 days even if a later step fails:

- `deployment-identity.json` with the full selected SHA, immutable images, service/prompt identity, namespace, URL, database identity, tenant, actors, feature configuration and timestamp;
- rendered staging manifests;
- Prisma bootstrap and post-rollout output with 78/78 and drift checks;
- tenant provisioning and authenticated smoke output;
- Mailpit Handoff delivery, claim, acceptance, start and continuity output;
- `goals-g1-g5-playwright.json` with 3/3 expected tests and 0 skips, tied to the same `source_sha`;
- namespace status/events without secrets;
- Playwright reports, screenshots, traces and videos when generated.

A workflow pass does not automatically certify a release. The acceptance record must link each goal/scenario to its environment, test, artifact and CI run and must use the exact full SHA.

## Manual cleanup after evidence review

The deployment workflow never deletes the environment. After evidence review, an authorized operator with the correct `KUBECONFIG` may run the separate cleanup command:

```bash
NAMESPACE=starteria-e2e \
CONFIRM_E2E_STAGING_CLEANUP=DELETE_STARTERIA_E2E \
scripts/ci/e2e-staging-cleanup.sh
```

The script rejects `starteria`, every other namespace and a missing confirmation. Deletion is irreversible for isolated test data; never automate it as part of testing or use it as production rollback.

## Operational checks before relying on a run

Confirm from artifacts that:

1. `source_sha` is the intended full release-candidate SHA;
2. all three images use its `e2e-<12-char-sha>` tag;
3. namespace is `starteria-e2e` and forbidden-production RBAC checks passed;
4. `database_environment_id` is `starteria-db.starteria-e2e.svc.cluster.local/starteria_db`;
5. the public URL is the independent staging HTTPS URL;
6. the tenant is `org-e2e-prod` in the isolated database;
7. migration evidence is 78/78 with drift checking enabled;
8. the G1-G5 report is exactly 3/3 with 0 skips;
9. generic P12 did not skip because credentials or URL were absent; and
10. Mailpit captured only synthetic email. SMTP acceptance is not delivery, reading, human acceptance, a booked meeting, or permission to send real mail.

## Release limits and rollback

- A successful run proves only the selected full SHA in the observed isolated environment. It does not prove production configuration, data, scale, email delivery, DNS, Cloudflare, provider behavior or safety outside recorded scenarios.
- A failed gate stops certification. Preserve artifacts; never reinterpret partial passes or bypass RBAC, migration drift, selector or 0-skip checks.
- Rollback means selecting a previously approved full SHA for a separately authorized future staging run. This workflow does not deploy or roll back production.
- Cleanup is separate and explicitly authorized; it is not automated rollback and must never target `starteria`.
