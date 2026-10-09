import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontRoot = path.resolve(currentDir, '..');
const repoRoot = path.resolve(frontRoot, '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const dockerCmd = isWindows ? 'docker.exe' : 'docker';

const runId = (process.env.E2E_RUN_ID || `${Date.now()}-${randomBytes(4).toString('hex')}`)
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '-');
if (!runId) throw new Error('E2E_RUN_ID must contain at least one letter, number, hyphen, or underscore.');
const dockerProjectName = process.env.E2E_DOCKER_PROJECT_NAME || `starteria-e2e-${runId}`;
if (!/^[a-z0-9][a-z0-9_-]*$/.test(dockerProjectName)) {
  throw new Error(`Invalid E2E_DOCKER_PROJECT_NAME: ${dockerProjectName}`);
}

const backendPort = Number(process.env.E2E_BACKEND_PORT || process.env.PORT || 4100);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 5176);
const e2ePostgresPort = Number(process.env.E2E_POSTGRES_PORT || 55433);
const frontendHost = process.env.E2E_FRONTEND_HOST || '127.0.0.1';
const backendHost = process.env.E2E_BACKEND_HOST || '127.0.0.1';
const localStorageDir = path.join(
  process.env.LOCAL_STORAGE_DIR || path.join(repoRoot, 'storage', 'e2e'),
  runId,
);
const baseURL = process.env.E2E_BASE_URL || `http://${frontendHost}:${frontendPort}`;
const backendHealthURL = process.env.E2E_BACKEND_HEALTH_URL || `http://${backendHost}:${backendPort}/api/health`;
const fullStackPortfolioEntryFlag = '--portfolio-entry-full-stack-test';
const postgresConfirmationIntegrationFlag = '--portfolio-entry-postgres-confirmation-test';
const fullStackPortfolioEntry = process.argv.slice(2).includes(fullStackPortfolioEntryFlag);
const postgresConfirmationIntegration = process.argv.slice(2).includes(postgresConfirmationIntegrationFlag);
const playwrightArgs = process.argv.slice(2).filter((argument) =>
  argument !== fullStackPortfolioEntryFlag && argument !== postgresConfirmationIntegrationFlag,
);
if (fullStackPortfolioEntry && !playwrightArgs.some((argument) =>
  argument.includes('portfolio-entry-live-understanding.integration.spec.ts')
  || argument.includes('portfolio-entry-conversion.spec.ts'))
) {
  throw new Error(`${fullStackPortfolioEntryFlag} requires a full-stack Portfolio Entry Playwright spec.`);
}
if (postgresConfirmationIntegration && (playwrightArgs.length > 0 || fullStackPortfolioEntry)) {
  throw new Error(`${postgresConfirmationIntegrationFlag} runs alone without Playwright specs.`);
}
const databaseURL =
  process.env.E2E_DATABASE_URL || `postgresql://postgres:postgres@localhost:${e2ePostgresPort}/starteria_e2e`;
const adminDatabaseURL =
  process.env.E2E_DATABASE_ADMIN_URL || `postgresql://postgres:postgres@localhost:${e2ePostgresPort}/postgres`;

const children: ChildProcess[] = [];
let shuttingDown = false;
let dockerProjectOwnedByRun = false;

function runChecked(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: isWindows && (command === npmCmd || command === dockerCmd),
  });
  if (result.status !== 0) {
    const detail = result.error instanceof Error ? `: ${result.error.message}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status ?? 'unknown'}${detail}`);
  }
}

function start(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[E2E] ${command} ${args.join(' ')} failed to start: ${error.message}`);
  });
  child.on('close', (code, signal) => {
    if (!shuttingDown && code !== null && code !== 0) {
      console.error(`[E2E] ${command} ${args.join(' ')} closed with ${code}`);
    }
    if (!shuttingDown && signal) console.error(`[E2E] ${command} ${args.join(' ')} closed by ${signal}`);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== null && code !== 0) {
      console.error(`[E2E] ${command} ${args.join(' ')} exited with ${code}`);
    }
    if (!shuttingDown && signal) console.error(`[E2E] ${command} ${args.join(' ')} stopped by ${signal}`);
  });
  return child;
}

function parsePostgresHostPort(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return { host: parsed.hostname || '127.0.0.1', port: Number(parsed.port || 5432) };
}

async function assertPortAvailable(port: number, label: string) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      reject(new Error(`${label} port ${port} is unavailable; refusing to reuse another E2E run: ${error.message}`));
    });
    server.listen({ host: '0.0.0.0', port, exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
}

async function assertRunIsolation() {
  const ports = [
    [backendPort, 'backend'],
    [frontendPort, 'frontend'],
    ...(process.env.E2E_SKIP_DOCKER === 'true' ? [] : [[e2ePostgresPort, 'postgres'] as [number, string]]),
  ] as const;
  if (new Set(ports.map(([port]) => port)).size !== ports.length) {
    throw new Error(`E2E backend, frontend, and postgres ports must be distinct: ${ports.map(([port]) => port).join(', ')}`);
  }
  for (const [port, label] of ports) await assertPortAvailable(port, label);

  if (process.env.E2E_SKIP_DOCKER !== 'true') {
    const result = spawnSync(dockerCmd, [
      'compose', '-f', 'docker-compose.e2e.yml', '-p', dockerProjectName, 'ps', '--all', '--quiet',
    ], { cwd: repoRoot, env: process.env, encoding: 'utf8', shell: isWindows });
    if (result.status !== 0) {
      throw new Error(`Could not verify Docker project ${dockerProjectName}: ${result.stderr || result.error?.message || 'docker compose failed'}`);
    }
    if (result.stdout.trim()) {
      throw new Error(`Docker project ${dockerProjectName} already contains containers; refusing to reuse a prior E2E run.`);
    }
  }
}

async function waitForTcp(host: string, port: number, label: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        lastError = 'connection timed out';
        socket.destroy();
        resolve(false);
      });
      socket.once('error', (error) => {
        lastError = error.message;
        resolve(false);
      });
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become available at ${host}:${port}: ${lastError}`);
}

async function waitForURL(url: string, label: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become available at ${url}: ${lastError}`);
}

async function stopChildren() {
  shuttingDown = true;
  for (const child of children.reverse()) {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) continue;
    child.kill('SIGTERM');
  }
  const exited = Promise.all(children.map((child) => child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise<void>((resolve) => child.once('exit', () => resolve()))));
  let cleanupTimer: NodeJS.Timeout | undefined;
  await Promise.race([exited, new Promise<void>((resolve) => { cleanupTimer = setTimeout(resolve, 3_000); })]);
  if (cleanupTimer) clearTimeout(cleanupTimer);
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) continue;
    if (isWindows) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGKILL');
  }
}

function stopDocker(env: NodeJS.ProcessEnv) {
  if (!dockerProjectOwnedByRun || process.env.E2E_SKIP_DOCKER === 'true' || process.env.E2E_KEEP_DOCKER === 'true') return;
  runChecked(dockerCmd, ['compose', '-f', 'docker-compose.e2e.yml', '-p', dockerProjectName, 'down'], repoRoot, env);
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    DATABASE_URL: databaseURL,
    E2E_DATABASE_URL: databaseURL,
    E2E_DATABASE_ADMIN_URL: adminDatabaseURL,
    E2E_USER_EMAIL: process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test',
    E2E_USER_PASSWORD: process.env.E2E_USER_PASSWORD || 'demo123',
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD || 'demo123',
    E2E_UNAUTHORIZED_USER_EMAIL: process.env.E2E_UNAUTHORIZED_USER_EMAIL || 'viewer.e2e@starteria.test',
    E2E_UNAUTHORIZED_USER_PASSWORD: process.env.E2E_UNAUTHORIZED_USER_PASSWORD || 'demo123',
    JWT_SECRET: process.env.JWT_SECRET || 'e2e-dev-secret-do-not-use-in-prod',
    AUTH_DISABLE_WAITLIST: process.env.AUTH_DISABLE_WAITLIST || 'true',
    AUTH_RATE_LIMIT_DISABLED: process.env.AUTH_RATE_LIMIT_DISABLED || 'true',
    PORTFOLIO_ENTRY_RUNTIME_MODE: process.env.PORTFOLIO_ENTRY_RUNTIME_MODE || 'deterministic',
    ...(fullStackPortfolioEntry ? {
      PORTFOLIO_ENTRY_E2E_TEST: 'true',
      PORTFOLIO_ENTRY_API_KEY: '',
      PORTFOLIO_ENTRY_HARNESS_API_KEY: '',
      PORTFOLIO_ENTRY_FALLBACK_API_KEY: '',
      JEV_API_KEY: '',
      TYPESAFE_API_KEY: '',
    } : {}),
    PORT: String(backendPort),
    NODE_PATH: process.env.NODE_PATH || path.join(frontRoot, 'node_modules'),
    CORS_ORIGIN: process.env.CORS_ORIGIN || baseURL,
    VITE_API_URL: process.env.VITE_API_URL || '/api/v1',
    VITE_BACKEND_PROXY_TARGET: process.env.VITE_BACKEND_PROXY_TARGET || `http://${backendHost}:${backendPort}`,
    VITE_FEATURE_PDF_AUTOFILL: process.env.VITE_FEATURE_PDF_AUTOFILL || 'true',
    VITE_ENABLE_INITIAL_REVIEW: process.env.VITE_ENABLE_INITIAL_REVIEW || 'true',
    E2E_BASE_URL: baseURL,
    E2E_BACKEND_URL: `http://${backendHost}:${backendPort}`,
    E2E_API_URL: process.env.E2E_API_URL || '',
    LOCAL_STORAGE_DIR: localStorageDir,
    INITIAL_REVIEW_AI: process.env.INITIAL_REVIEW_AI || '',
    PDF_EXTRACTION_E2E_MODE: process.env.PDF_EXTRACTION_E2E_MODE || 'terminal-failed',
  };

  fs.mkdirSync(env.LOCAL_STORAGE_DIR, { recursive: true });

  console.log(`[E2E] Run ${runId}; Docker project ${dockerProjectName}; backend ${backendPort}; frontend ${frontendPort}; postgres ${e2ePostgresPort}`);
  console.log(`[E2E] Isolated storage ${env.LOCAL_STORAGE_DIR}`);
  await assertRunIsolation();

  if (process.env.E2E_SKIP_DOCKER !== 'true') {
    console.log('[E2E] Start isolated postgres via docker compose');
    // --wait blocks until the compose healthcheck (pg_isready) passes. Without it,
    // docker-proxy accepts the TCP connection the instant the container is created,
    // so the waitForTcp gate below is satisfied while postgres is still booting and
    // the next step (prisma provisioning) fails with "Can't reach database server".
    dockerProjectOwnedByRun = true;
    runChecked(dockerCmd, ['compose', '-f', 'docker-compose.e2e.yml', '-p', dockerProjectName, 'up', '-d', '--wait', 'postgres'], repoRoot, env);
  } else {
    console.log('[E2E] E2E_SKIP_DOCKER=true; using existing E2E_DATABASE_URL');
  }
  const postgresTarget = parsePostgresHostPort(adminDatabaseURL);
  console.log(`[E2E] Wait for PostgreSQL at ${postgresTarget.host}:${postgresTarget.port}`);
  await waitForTcp(postgresTarget.host, postgresTarget.port, 'postgres');

  console.log('[E2E] Provision database');
  runChecked(npmCmd, ['run', 'db:e2e:provision'], frontRoot, env);

  if (postgresConfirmationIntegration) {
    console.log('[E2E] Run Portfolio Entry Prisma confirmation integration against the migrated starteria_e2e database');
    runChecked(npmCmd, [
      'run', 'test:backend', '--',
      '../backend/modules/portfolio-entry-sessions/__tests__/prisma-portfolio-entry-session.repository.integration.test.ts',
    ], frontRoot, { ...env, PORTFOLIO_ENTRY_DB_INTEGRATION: '1' });
    return;
  }

  const backendEntry = fullStackPortfolioEntry
    ? path.join(frontRoot, 'scripts', 'e2e', 'portfolio-entry-live-understanding-backend.ts')
    : path.join(frontRoot, '..', 'backend', 'server.ts');
  console.log(`[E2E] Start ${fullStackPortfolioEntry ? 'test-composed Portfolio Entry backend' : 'backend'} on ${backendHealthURL}`);
  start(process.execPath, [path.join(frontRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), backendEntry], frontRoot, env);
  await waitForURL(backendHealthURL, 'backend');

  console.log(`[E2E] Start frontend on ${baseURL}`);
  start(process.execPath, [path.join(frontRoot, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', frontendHost, '--port', String(frontendPort), '--strictPort'], frontRoot, env);
  await waitForURL(baseURL, 'frontend');

  console.log('[E2E] Run Playwright');
  runChecked(process.execPath, [path.join(frontRoot, 'node_modules', 'playwright', 'cli.js'), 'test', ...playwrightArgs], frontRoot, env);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopChildren();
    const cleanupEnv = {
      ...process.env,
      E2E_POSTGRES_PORT: String(e2ePostgresPort),
    };
    try {
      stopDocker(cleanupEnv);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  });
