import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const importSpecifier = /(?:from\s*|import\s*(?:\(\s*)?|require\s*\()\s*["']([^"']+)["']/g;
const forbiddenPortfolioEntryPath = /(?:^|[\\/.])portfolio[-_]entry(?:[\\/.]|$)/i;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|js|py)$/.test(name) ? [path] : [];
  });
}

function forbiddenImports(file: string): string[] {
  const content = readFileSync(file, 'utf8');
  return [...content.matchAll(importSpecifier)]
    .map((match) => match[1])
    .filter((specifier) => forbiddenPortfolioEntryPath.test(specifier));
}

describe('First Value P3 dependency boundary', () => {
  it('does not import Portfolio Entry semantic modules from the P3 backend module', () => {
    const moduleRoot = resolve(__dirname, '..');
    const violations = sourceFiles(moduleRoot).flatMap((file) =>
      forbiddenImports(file).map((specifier) => `${file}: ${specifier}`),
    );

    expect(violations).toEqual([]);
  });

  it('does not import Portfolio Entry semantic modules from the AI P3 processor', () => {
    const processor = resolve(__dirname, '../../../../ai-service/agents/first_value_p3.py');
    expect(forbiddenImports(processor)).toEqual([]);
  });
});
