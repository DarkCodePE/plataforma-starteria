# E2E Staging Runbook

**Purpose:** deploy one selected release-candidate commit into an isolated E2E staging runtime, retain its evidence, and run the repository-defined deployed Playwright suite for P12. This runbook does not authorize production deployment or P12 certification by itself.

## Isolation contract

- Kubernetes namespace: `starteria-e2e` only.
- Database: PostgreSQL 16 StatefulSet and PVC created inside `starteria-e2e`, reached by the application at `starteria-db:5432` in that namespace.
- Tenant: `org-e2e-prod`, created after migration only in that isolated database. The legacy script name is retained because its user and role fixture contract is reused; it is never run against production here.
- Images: `orlandogtp/starteria-{backend,frontend,ai-service}:e2e-<12-char-sha>`.
- GitHub Environment: `e2e-staging`. The workflow has no `production` environment and its namespace guard rejects every value other than `starteria-e2e`.
- Tunnel: its token becomes the `cloudflared-token` secret only in `starteria-e2e`. It must be a tunnel separate from the production tunnel.

The workflow does not read production Kubernetes secrets, target the `starteria` namespace, mount a production PVC, or use the production database URL.

## Required GitHub Environment

Create the GitHub Environment named `e2e-staging`. Configure deployment protection rules appropriate for an isolated, non-production E2E target.

### Environment variable

| Name | Required value |
|---|---|
| `E2E_STAGING_BASE_URL` | Public `https://` URL for the separate staging Cloudflare tunnel. It is passed to health, smoke, and Playwright as `E2E_PROD_BASE_URL`; that legacy runner variable name does not make the target production. |

### Required secrets

| Secret | Use |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub authentication for the isolated immutable release images. |
| `DOCKERHUB_TOKEN` | Docker Hub authentication token. |
| `RACKSPACE_REFRESH_TOKEN` | Fetches Kubernetes credentials for the authorized cluster. |
| `RACKSPACE_ORG_NAME` | Rackspace organization selector. |
| `RACKSPACE_CLOUDSPACE_NAME` | Rackspace cloudspace selector. |
| `E2E_STAGING_DB_PASSWORD` | PostgreSQL password for `starteria-db` in `starteria-e2e`. |
| `E2E_STAGING_JWT_SECRET` | JWT secret for the staging backend only. |
| `E2E_STAGING_AI_SERVICE_TOKEN` | Backend-to-AI token and AI webhook token for staging only. |
| `E2E_STAGING_BRIDGE_SHARED_SECRET` | Staging bridge secret. |
| `E2E_STAGING_CLOUDFLARED_TOKEN` | Token for the separate staging tunnel. |
| `E2E_STAGING_LEAD_PASSWORD` | Password provisioned for the isolated Portfolio Lead. |
| `E2E_STAGING_PARTICIPANT_PASSWORD` | Password provisioned for the isolated Initiative Owner. |
| `E2E_STAGING_MEMBER_PASSWORD` | Password provisioned for the additional isolated role actors. |
| `OPENROUTER_API_KEY` | AI provider credential, passed only to the staging AI/backend secrets. |
| `JEV_API_KEY` | Portfolio Entry classifier credential, passed only to staging secrets. |
| `PORTFOLIO_ENTRY_API_KEY` | Portfolio Entry provider credential, passed only to staging secrets. |
| `GOOGLE_CLIENT_ID` | Frontend build argument and backend identity configuration. |

`LANGSMITH_API_KEY` is optional. When supplied, the staging deployment identifies itself as `e2e-staging` and uses the LangSmith project `starteria-e2e`.

Do not add production credentials under the staging names. GitHub Actions masks secrets and the workflow does not emit their values.

## Cloudflare prerequisite

Before the first run, create a **separate remotely managed Cloudflare Tunnel** and DNS hostname for staging. Its remote configuration must route the staging hostname to:

```text
http://starteria-frontend.starteria-e2e.svc.cluster.local:80
```

Store that tunnel's token as `E2E_STAGING_CLOUDFLARED_TOKEN` and its public URL as `E2E_STAGING_BASE_URL`. Do not reuse, edit, or route through the production tunnel.

## Deploy a P12 release candidate

1. Confirm the exact P0–P11 release-candidate commit exists in the GitHub remote repository. A local-only SHA cannot be fetched or certified.
2. Open **Actions → E2E staging P12 → Run workflow**.
3. Enter `source_ref` as one remote branch, tag, or full 40-character commit SHA.
4. Approve the `e2e-staging` Environment deployment if its protection rule requests it.
5. The workflow resolves and checks out that exact commit, emits `e2e-<first-12-source-sha>`, builds all three images, deploys only `starteria-e2e`, migrates its database with `prisma migrate deploy`, provisions its E2E tenant, runs health plus authenticated smoke, then runs `npm run test:e2e:prod` against `E2E_STAGING_BASE_URL`.

The source resolver deliberately does **not** require the commit to be an ancestor of `main`. It validates that the source ref resolves from this repository's `origin`, resolves the full SHA, checks it out detached, and makes the SHA-derived Docker tag immutable for the run.

## Evidence and P12 handoff

The workflow keeps staging available after a run. It uploads artifacts for 14 days even when a later step fails:

- `deployment-identity.json` with selected SHA, immutable image references, AI service version, prompt source hash, namespace, base URL, database environment identifier, tenant ID, actor identities, feature configuration, and deployment timestamp;
- rendered staging manifests;
- Prisma apply and verify output;
- tenant provisioning and authenticated smoke output;
- namespace status and events without secret data;
- Playwright output, report, screenshots, traces, and videos when generated.

Use those artifacts and the still-running namespace to update P12 runtime evidence. A workflow pass does not automatically mark P12 `PASS`: the Final Acceptance Report must still show every required P12 scenario with observed deployed evidence.

## Manual cleanup, after evidence review

The deployment workflow intentionally never deletes the environment. After P12 evidence no longer needs inspection, an authorized operator with the correct `KUBECONFIG` can run the independent cleanup script:

```bash
NAMESPACE=starteria-e2e \
CONFIRM_E2E_STAGING_CLEANUP=DELETE_STARTERIA_E2E \
scripts/ci/e2e-staging-cleanup.sh
```

The script rejects `starteria`, any other namespace, and a missing explicit confirmation value. Namespace deletion removes the isolated StatefulSet PVC and all staging objects; it is irreversible for that test data. It must never be executed as part of automated P12 testing.

## Operational checks before relying on a run

Confirm from the generated identity and Kubernetes artifact that:

1. `source_sha` equals the intended release-candidate SHA.
2. all three images use the same `e2e-<12-char-sha>` tag;
3. the namespace is `starteria-e2e`;
4. `database_environment_id` names `starteria-db.starteria-e2e.svc.cluster.local`;
5. the public URL is the configured staging URL;
6. the tenant is `org-e2e-prod` in the isolated database; and
7. the E2E suite did not skip because staging credentials or `E2E_PROD_BASE_URL` were absent.
