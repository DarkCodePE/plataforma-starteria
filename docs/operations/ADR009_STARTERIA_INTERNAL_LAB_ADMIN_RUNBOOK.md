# ADR-009 — Startería Internal Lab administrative operation

## Scope

This operation provisions exactly one persistent internal tenant:

- name: `Startería Internal Lab`
- slug: `starteria-internal-lab`
- purpose: internal testing, experimentation and usability validation
- retention: persistent until an expressly authorized review or removal

It does not reconcile the ADR-009 Strategic Front, run migrations, create users,
or provide a general organization-management API.

## Required human decisions

Before any production run, record a separate approval naming:

1. an existing active custodian user with no current organization, no global
   `admin` role and no E2E identity or membership;
2. an existing active platform-admin user responsible for approving the
   operation;
3. an immutable reference matching `ADR009-*`;
4. the holder of the private key corresponding to the report-recipient
   certificate.

The custodian and approver must be different people/identities. The workflow
never searches for, selects or creates either account.

## One-time environment preparation

Configure `INTERNAL_LAB_REPORT_RECIPIENT_CERT_B64` as an environment secret in
the protected GitHub `production` environment. Its value is the base64-encoded
PEM certificate whose private key is held outside GitHub by the authorized
recipient. The workflow fails closed if the certificate is missing, invalid or
expires within 24 hours.

The repository is public. Therefore the uploaded artifact contains only a CMS
encrypted envelope (`.p7m`), never the JSON report or `organizationId` in clear
text. GitHub environment and repository access are not treated as sufficient
confidentiality controls.

## Read-only preflight

Run `create-starteria-internal-lab.yml` from the reviewed `main` SHA with:

- `custodian_user_id`: approved existing custodian ID
- `approved_by_user_id`: approved existing platform-admin ID
- `approval_reference`: approved `ADR009-*` reference
- `apply`: `false`
- `confirmation`: empty

The workflow sets PostgreSQL `default_transaction_read_only=on`. Review the
encrypted report privately. A clean first run reports `wouldCreate: true`; an
exact prior execution reports `exactProvisioningAlreadyExists: true`.

## Authorized apply

Only after an independent written authorization, repeat the same inputs with:

- `apply`: `true`
- `confirmation`: `CREATE_STARTERIA_INTERNAL_LAB`

The protected job uses a fixed advisory lock and a serializable transaction. It
creates the Organization, CAS-assigns the existing unscoped custodian, adds one
organization membership (`admin`), grants only `portfolio:read` and
`portfolio:write`, and writes one `AuditLog`. It never grants the custodian the
global `admin` role.

An exact retry returns the original result without duplicate Organization,
membership, grants or audit rows. Conflicting name/slug, changed custodian,
partial prior state or reused E2E identity fail closed and require review.

## Private report

Download `starteria-internal-lab-<run_id>` while its one-day retention window is
open. Decrypt locally through the authorized private-key channel:

```sh
openssl cms -decrypt -inform DER \
  -in starteria-internal-lab-private.p7m \
  -recip recipient-cert.pem \
  -inkey recipient-private-key.pem \
  -out starteria-internal-lab-private.json
```

Read the real `organizationId`, preserve the run/audit references, then remove
the plaintext report according to the decision record. Never paste the report
or identifier into public Actions logs.

## Isolation and E2E cleanup exclusion

The operation rejects `org-e2e-prod`, known E2E identities, E2E organization
membership, global-admin custodians and users already assigned to another
tenant. The existing E2E cleanup selects only `org-e2e-prod` or owners from its
dedicated E2E identities; the Internal Lab uses neither. A later ADR-009
reconciliation remains a separate CAS-protected, audited production write.

## Rollback boundary

Any failure before commit rolls back the full transaction. Once committed, do
not delete or move the Organization automatically. Reversal requires a new
read-only impact inventory and explicit authorization because persistent test
history may already reference the tenant.
