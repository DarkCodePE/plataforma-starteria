# MVP Release 01 — encrypted production backup runbook

## Scope

`mvp-release01-backup-only.yml` creates one encrypted PostgreSQL 16 custom-format archive for the isolated MVP Release 01 rehearsal. It does not run SQL migrations, reconcile ADR-009, deploy workloads, change Kubernetes resources or persist a clear dump.

The workflow can run only by `workflow_dispatch` from `main`. Its protected job shares the `starteria-production` concurrency group with CD and database maintenance.

## One-time production environment configuration

Before the first run, a GitHub administrator must:

1. keep `production` protected by required reviewers and its `main` deployment branch policy;
2. enable `prevent_self_review` and disable administrator bypass for this extraction window;
3. set the environment/repository variable `MVP_RELEASE01_DATA_APPROVER_LOGIN` to the GitHub login of the responsible data owner;
4. set `MVP_RELEASE01_BACKUP_RECIPIENT_CERT_B64` as a `production` environment secret containing the base64-encoded PEM public certificate of the authorized recipient;
5. confirm the existing Rackspace secrets remain scoped to the protected environment/workflow path.

The private key must remain with the authorized recipient outside GitHub and outside the repository. The certificate must support S/MIME/CMS encryption and remain valid for more than 24 hours.

## Independent data-owner authorization

Create a private or appropriately access-controlled repository issue for the extraction decision. The issue must remain open during the run. The configured data approver — not the workflow operator — posts a comment whose entire body is valid JSON:

```json
{
  "schema": "starteria.mvp-release01.data-copy-authorization.v1",
  "approved": true,
  "authorization_ref": "MVPREL01-EXAMPLE-0001",
  "operator": "github-operator-login",
  "purpose": "MVP_RELEASE_01_PRODUCTION_CLONE_REHEARSAL",
  "source_database": "starteria_db",
  "channel": "GITHUB_ACTIONS_ENCRYPTED_ARTIFACT",
  "retention_hours": 24,
  "destruction_required": true,
  "source_sha": "40-character-main-sha",
  "recipient_certificate_sha256": "64-character-lowercase-sha256",
  "valid_until_utc": "2026-11-01T12:00:00Z"
}
```

`valid_until_utc` must be in the future and no more than 24 hours from workflow execution. Closing the issue, changing the SHA/certificate/operator, removing the variable or allowing the approval to expire makes the workflow fail closed. Workflow inputs alone never authorize extraction.

Obtain the public certificate fingerprint locally without exposing the certificate contents:

```sh
openssl x509 -in recipient-cert.pem -outform DER | sha256sum
```

## Execute after authorization

From the Actions UI, select **MVP Release 01 encrypted backup only**, choose `main`, and enter:

- `authorization_issue`: approved issue number;
- `authorization_ref`: exact `MVPREL01-*` value in the approval comment;
- `confirmation`: `EXPORT_ENCRYPTED_PRODUCTION_BACKUP`.

The workflow validates the certificate and structured approval, obtains a fresh Rackspace kubeconfig, confirms PostgreSQL 16, and streams `pg_dump -Fc` directly through CMS encryption. It writes no dump file in the pod or runner. Only the `.p7m` is uploaded, with one-day retention.

Record the run ID, source SHA, encrypted byte size, SHA-256, authorization reference and approval comment ID from the run summary. A failed `pg_dump`, transfer, certificate validation or encryption produces no eligible artifact.

## Authorized download and local restore

Download the artifact only from an authenticated operator session:

```sh
gh run download RUN_ID \
  --repo DarkCodePE/plataforma-starteria \
  --name starteria-mvp-release01-encrypted-backup-RUN_ID \
  --dir /authorized/luks2/incoming
```

The destination must be inside the authorized LUKS2 environment. Verify that the downloaded `.p7m` hash equals the run-summary hash before decryption.

Before restore, the clone administrator records three non-secret identity values from the newly provisioned empty PostgreSQL 16 instance: its database name, `inet_server_addr()` and `system_identifier` from `pg_control_system()`. The production `system_identifier` is recorded separately through the authorized read-only production channel. The two identifiers must differ. These values are provision evidence; do not derive them from the restore command itself.

Store the clone connection in a libpq service file inside the authorized LUKS2 volume, mode `0600`. The helper copies it to a private runtime directory and removes that copy on exit, so credentials never appear in process arguments. The restore helper decrypts as a stream into `pg_restore`; it never creates a clear archive. It refuses the production database name or system identifier, an unexpected server address, a non-PostgreSQL-16 target, a mismatched database, a non-empty target or a destruction deadline beyond 72 hours:

```sh
export ENCRYPTED_BACKUP=/authorized/luks2/incoming/starteria-mvp-release01-RUN_ID.p7m
export EXPECTED_SHA256=SHA256_FROM_RUN_SUMMARY
export RECIPIENT_CERT_FILE=/authorized/private/recipient-cert.pem
export RECIPIENT_PRIVATE_KEY_FILE=/authorized/private/recipient-private-key.pem
export PGSERVICE_FILE=/authorized/private/pg_service.conf
export PGSERVICE_NAME=starteria_release01_clone
export EXPECTED_CLONE_DATABASE=starteria_rehearsal
export EXPECTED_CLONE_SERVER_ADDRESS=ISOLATED_CLONE_IP_FROM_PROVISION_EVIDENCE
export EXPECTED_CLONE_SYSTEM_IDENTIFIER=CLONE_SYSTEM_IDENTIFIER_FROM_PROVISION_EVIDENCE
export PRODUCTION_SYSTEM_IDENTIFIER=PRODUCTION_SYSTEM_IDENTIFIER_FROM_AUTHORIZED_READ_ONLY_EVIDENCE
export AUTHORIZATION_REF=MVPREL01-EXAMPLE-0001
export DESTRUCTION_AT_UTC=UTC_TIMESTAMP_NOT_MORE_THAN_72_HOURS_AFTER_RESTORE
scripts/ci/mvp-release01-restore-encrypted-backup.sh
```

Do not place the private key, service-file contents or decrypted contents in logs, shell history, GitHub artifacts or repository files. The service file may use a separate mode-`0600` passfile; both must remain inside the encrypted authorized environment and be destroyed at expiry.

## Retention and destruction

- GitHub encrypted artifact: one day.
- Restored clone, local encrypted artifact and runtime: at most 72 hours from completed restore, or earlier if the approval specifies.
- At expiry: stop the isolated runtime, remove the clone, encrypted archive, temporary credentials and recipient-key session, then record resource identifiers and deletion timestamps without copied data.

The ADR-009 reconciliation and 18 migrations require separate approval and occur only after restore validation. This workflow never performs them.
