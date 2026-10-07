import { defineConfig, type Plugin } from 'vitest/config';
import path from 'path';
import { createRequire } from 'module';

/**
 * Vitest config for the Express backend (Node environment).
 *
 * The monorepo lives in the parent directory (the only package.json is here in
 * front/), so test files for the backend live in ../backend/** and the shared
 * factories live in ../tests/**.
 */

// Vite-node's default resolution returns the bare specifier `express` (not the
// resolved file path) for some CJS packages whose package.json `main` lacks an
// extension. That tricks vite-node into bundling them via Vite's SSR transform
// with a synthesized __filename of `<root>/express`, which breaks relative
// requires like express's own `require('./lib/express')`.
//
// This tiny plugin resolves those packages to their absolute path in
// `front/node_modules` AND marks them external so vite-node calls Node's real
// CJS loader instead of bundling them.
const requireFromHere = createRequire(import.meta.url);
const cjsBackendPackages = [
  'express',
  'jsonwebtoken',
  'supertest',
  'helmet',
  'cors',
  'cookie-parser',
  'pino',
  'pino-http',
  'nock',
  'body-parser',
  'finalhandler',
  'qs',
  // bcrypt is a native module loaded via node-pre-gyp; vite-node's bundler
  // can't follow its build-time resolution. Externalize so Node loads the
  // prebuilt .node binding directly.
  'bcrypt',
  // dotenv reads its own package.json relative to its file at runtime; when
  // bundled via vite-node the relative resolution lands in the wrong cwd
  // (`front/` instead of `front/node_modules/dotenv/`). Externalize to use
  // the real CJS loader.
  'dotenv',
  // nodemailer is CJS and does relative requires (`require('./lib/...')`);
  // vite-node bundles it with a synthesized __filename and those requires
  // fail. Externalize so Node's real CJS loader is used.
  'nodemailer',
];

function externalizeCjsBackendPackages(): Plugin {
  return {
    name: 'externalize-cjs-backend-packages',
    enforce: 'pre',
    resolveId(id) {
      if (cjsBackendPackages.includes(id)) {
        try {
          const resolved = requireFromHere.resolve(id);
          return { id: resolved, external: true };
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [externalizeCjsBackendPackages()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@backend': path.resolve(__dirname, '../backend'),
      '@tests': path.resolve(__dirname, '../tests'),
    },
  },
  test: {
    name: 'backend',
    environment: 'node',
    globals: true,
    // Backend tests run in the forks pool so each file is a real Node
    // child process, not a vitest worker thread. We disable file-level
    // parallelism via `singleFork` so the V8 inspector session can
    // collect coverage across all specs in one process — multi-fork
    // collection is currently lossy in vitest 2.1.9.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    // CJS interop: vite-node's `isValidNodeImport` returns false for entry
    // files whose package.json `main` has no extension (e.g. express,
    // jsonwebtoken). When that happens vitest tries to bundle them through
    // Vite's SSR transform, which loses the package's own __dirname and
    // breaks relative requires like `require('./lib/express')`. Setting
    // `fallbackCJS: true` makes vite-node guess a CJS extension and
    // externalize them so Node's real CJS loader is used instead.
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
    include: [
      '../backend/**/*.{test,spec}.{ts,tsx}',
      '../tests/**/*.{test,spec}.ts',
      '../test/portfolio-entry-v02-isolated-validation/**/*.test.ts',
      '../test/portfolio-entry-critical-situation-synthesis/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '../ai-service/**',
      '../front/src/**',
    ],
    setupFiles: ['./tests/setup-node.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // The vitest "root" is `front/` (the only package.json) but the
      // backend source we test lives in `../backend/`. Without
      // allowExternal, c8/v8-coverage filters out files that resolve
      // outside the project root and the report comes back empty.
      allowExternal: true,
      // NOTE — Phase 0 coverage scope (issue #1).
      // We only enforce the 80% gate on modules that are STABLE per
      // ADR-011 roadmap (F1-F6). Modules listed below are explicitly
      // out-of-scope because they will be reshuffled or rewritten:
      //   - backend/modules/ai/**            → rewritten in F3 (AI bridge)
      //   - backend/modules/steps/step.service.ts → modified in F3/F6 (ai-review TODO)
      //   - controllers/services that depend on Prisma without integration
      //     tests in place yet (cohort, evidence, mentor, portfolio,
      //     projects/project.service, sponsor, steps, users, auth.service,
      //     auth.controller). Those will be picked up incrementally as
      //     Prisma test fixtures land.
      //   - shared/db/prisma.ts              → bootstrapping module
      //   - shared/utils/logger.ts           → thin pino wrapper
      //   - app.ts / server.ts / index.ts    → composition roots
      //
      // v8 coverage matches include/exclude globs against absolute file
      // paths, so we use `**` prefixes that work regardless of
      // process.cwd() / coverage.root.
      include: [
        '**/backend/config/index.ts',
        '**/backend/config/cors.ts',
        '**/backend/shared/middleware/request-id.ts',
        '**/backend/shared/middleware/validate.ts',
        '**/backend/shared/errors/AppError.ts',
        '**/backend/shared/errors/error-handler.ts',
        '**/backend/shared/utils/status-mapper.ts',
        '**/backend/modules/auth/password.service.ts',
        '**/backend/modules/auth/token.service.ts',
        '**/backend/modules/auth/rate-limiter.ts',
        '**/backend/modules/auth/auth.middleware.ts',
        '**/backend/modules/auth/auth.schemas.ts',
        '**/backend/modules/projects/state-machine.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.{test,spec}.{ts,tsx}',
        '**/tests/**',
        '**/front/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/backend/index.ts',
        '**/backend/server.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
