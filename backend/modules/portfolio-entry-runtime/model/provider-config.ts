export type PortfolioEntryProviderConfig = {
  provider: 'openai_responses' | 'deepseek_responses';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  seed?: string | number;
  timeoutMs: number;
  /** Sólo se configura para la síntesis crítica; undefined conserva el body habitual. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Reintentar cuando el proveedor no responde a tiempo. Por defecto sí. */
  retryOnTimeout?: boolean;
};

/**
 * La síntesis crítica genera una salida grande (~6-7k tokens) y tarda 50-60 s. Usa un timeout propio,
 * sin reintento por timeout; al ejecutarse en segundo plano, comparte el límite de 3 minutos del job.
 */
export function loadCriticalSynthesisProviderConfig(env: NodeJS.ProcessEnv = process.env): PortfolioEntryProviderConfig {
  return {
    ...loadPortfolioEntryProviderConfig(env),
    timeoutMs: positiveNumber(env.PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS, 120_000, 'PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS'),
    retryOnTimeout: false,
    reasoningEffort: synthesisReasoningEffort(env.PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT),
  };
}

export function loadPortfolioEntryProviderConfig(env: NodeJS.ProcessEnv = process.env): PortfolioEntryProviderConfig {
  const provider = (nonBlank(env.PORTFOLIO_ENTRY_PROVIDER, env.PORTFOLIO_ENTRY_HARNESS_PROVIDER) ?? 'openai_responses') as PortfolioEntryProviderConfig['provider'];
  const model = nonBlank(env.PORTFOLIO_ENTRY_MODEL, env.PORTFOLIO_ENTRY_HARNESS_MODEL) ?? 'gpt-5.6-luna';
  const apiKey = nonBlank(env.PORTFOLIO_ENTRY_API_KEY, env.PORTFOLIO_ENTRY_HARNESS_API_KEY);
  if (!apiKey) throw new Error('PORTFOLIO_ENTRY_API_KEY is required in live mode.');
  if (provider !== 'openai_responses' && provider !== 'deepseek_responses') throw new Error('Unsupported Portfolio Entry provider.');
  const baseUrl = nonBlank(env.PORTFOLIO_ENTRY_BASE_URL, env.PORTFOLIO_ENTRY_HARNESS_BASE_URL) ?? (provider === 'openai_responses' ? 'https://api.openai.com/v1' : 'https://api.deepseek.com');
  const timeoutMs = positiveNumber(env.PORTFOLIO_ENTRY_TIMEOUT_MS ?? env.PORTFOLIO_ENTRY_HARNESS_TIMEOUT_MS, 30_000);
  const temperature = env.PORTFOLIO_ENTRY_TEMPERATURE ?? env.PORTFOLIO_ENTRY_HARNESS_TEMPERATURE;
  const seed = env.PORTFOLIO_ENTRY_SEED ?? env.PORTFOLIO_ENTRY_HARNESS_SEED;
  return {
    provider, model, apiKey, baseUrl: baseUrl.replace(/\/$/, ''), timeoutMs,
    ...(temperature ? { temperature: Number(temperature) } : {}),
    ...(seed ? { seed: Number.isFinite(Number(seed)) ? Number(seed) : seed } : {}),
  };
}

function nonBlank(...values: (string | undefined)[]): string | undefined {
  return values.map((value) => value?.trim()).find((value) => Boolean(value));
}

function positiveNumber(raw: string | undefined, fallback: number, name = 'PORTFOLIO_ENTRY_TIMEOUT_MS'): number {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`);
  return value;
}

function synthesisReasoningEffort(raw: string | undefined): PortfolioEntryProviderConfig['reasoningEffort'] {
  const value = raw === undefined ? 'none' : raw.trim();
  if (value === '' || value === 'none') return undefined;
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  throw new Error('PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT must be low, medium, high, none or empty.');
}
