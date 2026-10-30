import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sqlPath = resolve(
  process.cwd(),
  '../scripts/preflight/adr009-blocking-project-identification-readonly.sql',
);
const workflowPath = resolve(
  process.cwd(),
  '../.github/workflows/db-adr009-identification-readonly.yml',
);

describe('ADR-009 private blocking-project identification', () => {
  it('uses fixed identifiers, an explicit read-only transaction and no sensitive fields', () => {
    const sql = readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('BEGIN TRANSACTION READ ONLY');
    expect(sql).toContain("SET LOCAL statement_timeout = '20s'");
    expect(sql).toContain("SET LOCAL lock_timeout = '2s'");
    expect(sql).toContain("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    expect(sql).toContain("SET LOCAL application_name = 'adr009_private_identification'");
    expect(sql).toContain('cmuyaldaz0006di01njwnaf55');
    expect(sql).toContain('cmuyaldqg0008di01kbywurz6');
    expect(sql).toContain('cmuyalf02000adi010zwlqek0');
    expect(sql).not.toContain('cmuyaldqg0008di01njwnaf55');
    expect(sql).toContain('front_dependency_summary');
    expect(sql).toContain('strategic_front_record');
    expect(sql).toContain('challenge_record');
    expect(sql).toContain('project_record');
    expect(sql).toContain('project_challenge_relationship');
    expect(sql).toContain('front_challenge_dependents');
    expect(sql).toContain('front_project_dependents');
    expect(sql).toContain('project_provenance_summary');
    expect(sql).toContain('ROLLBACK');

    expect(sql).not.toMatch(/\b(?:email|phone|token|password|secret)\b/i);
    expect(sql).not.toMatch(/\b(?:ownerId|sponsorId|confirmedBy|createdBy|actorId)\b/i);
    expect(sql).not.toMatch(/\b(?:description|objective|constraints|knownFacts|openQuestions)\b/i);
    expect(sql).not.toMatch(/\b(?:reference|location|originalInput|metadataJson)\b/i);
    expect(sql).not.toMatch(/:'[a-z_][a-z0-9_]*'/i);

    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\b/i);
  });

  it('keeps the report out of logs and publishes a one-day private artifact', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/workflow_dispatch:\s*\n\s+inputs:/);
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('default_transaction_read_only=on');
    expect(workflow).toContain('statement_timeout=20000');
    expect(workflow).toContain('lock_timeout=2000');
    expect(workflow).toContain('idle_in_transaction_session_timeout=30000');
    expect(workflow).toContain('psql -X');
    expect(workflow).toContain('ON_ERROR_STOP=1');
    expect(workflow).toContain('adr009-blocking-project-identification-readonly.sql');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('retention-days: 1');
    expect(workflow).toContain('if-no-files-found: error');
    expect(workflow).toContain('include-hidden-files: false');
    expect(workflow).toContain('chmod 600 "$REPORT_PATH"');
    expect(workflow).toContain('rm -f "$REPORT_PATH"');
    expect(workflow).not.toMatch(/(?:cat|tee)\s+[^\n]*REPORT_PATH/i);
    expect(workflow).not.toMatch(/\b(?:migrate|resolve|deploy|apply=true|pg_dump)\b/i);

    const queryStart = workflow.indexOf('- name: Generate private ADR-009 identification report');
    const uploadStart = workflow.indexOf('- name: Upload private identification report');
    const cleanupStart = workflow.indexOf('- name: Remove private report and kubeconfig');
    expect(queryStart).toBeGreaterThan(-1);
    expect(uploadStart).toBeGreaterThan(queryStart);
    expect(cleanupStart).toBeGreaterThan(uploadStart);
  });
});
