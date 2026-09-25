export type Env = {
  DB: D1Database;
  ENVIRONMENT: 'development' | 'production' | 'test';
  PROVIDER: 'fake' | 'openai';
  ALLOWED_EXTENSION_ORIGINS: string;
  DAILY_ANALYSIS_LIMIT: string;
  NETWORK_DAILY_LIMIT: string;
  NETWORK_HASH_SALT: string;
  SESSION_SIGNING_SECRET: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
};

export type RuntimeConfig = {
  environment: Env['ENVIRONMENT'];
  provider: Env['PROVIDER'];
  allowedOrigins: Set<string>;
  dailyAnalysisLimit: number;
  networkDailyLimit: number;
  networkHashSalt: string;
  signingSecret: string;
  openAiApiKey: string | undefined;
  openAiModel: string | undefined;
  openAiTimeoutMs: number | undefined;
};

export function parseEnv(env: Env): RuntimeConfig {
  const allowedOrigins = new Set(
    env.ALLOWED_EXTENSION_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const dailyAnalysisLimit = Number.parseInt(env.DAILY_ANALYSIS_LIMIT, 10);
  const networkDailyLimit = Number.parseInt(env.NETWORK_DAILY_LIMIT, 10);
  const openAiApiKey = env.OPENAI_API_KEY?.trim() || undefined;
  const openAiModel = env.OPENAI_MODEL?.trim() || undefined;
  const openAiTimeoutMs = env.OPENAI_TIMEOUT_MS
    ? Number.parseInt(env.OPENAI_TIMEOUT_MS, 10)
    : undefined;

  if (allowedOrigins.size === 0) throw new Error('At least one allowed extension origin is required.');
  if (!Number.isSafeInteger(dailyAnalysisLimit) || dailyAnalysisLimit < 1 || dailyAnalysisLimit > 100) {
    throw new Error('DAILY_ANALYSIS_LIMIT must be an integer from 1 through 100.');
  }
  if (!Number.isSafeInteger(networkDailyLimit) || networkDailyLimit < dailyAnalysisLimit || networkDailyLimit > 10_000) {
    throw new Error('NETWORK_DAILY_LIMIT must be an integer between the session limit and 10000.');
  }
  if (
    env.ENVIRONMENT === 'production' &&
    [...allowedOrigins].some((origin) => origin.includes('REPLACE_') || !origin.startsWith('chrome-extension://'))
  ) {
    throw new Error('Production requires a concrete chrome-extension:// origin.');
  }
  if (new TextEncoder().encode(env.SESSION_SIGNING_SECRET).byteLength < 32) {
    throw new Error('SESSION_SIGNING_SECRET must be at least 32 bytes.');
  }
  if (new TextEncoder().encode(env.NETWORK_HASH_SALT).byteLength < 16) {
    throw new Error('NETWORK_HASH_SALT must be at least 16 bytes.');
  }
  if (env.PROVIDER === 'openai') {
    if (!openAiApiKey) throw new Error('OPENAI_API_KEY is required for the OpenAI provider.');
    if (!openAiModel) throw new Error('OPENAI_MODEL is required for the OpenAI provider.');
    if (
      openAiTimeoutMs === undefined ||
      !Number.isSafeInteger(openAiTimeoutMs) ||
      openAiTimeoutMs < 1_000 ||
      openAiTimeoutMs > 60_000
    ) {
      throw new Error('OPENAI_TIMEOUT_MS must be an integer from 1000 through 60000.');
    }
  }

  return {
    environment: env.ENVIRONMENT,
    provider: env.PROVIDER,
    allowedOrigins,
    dailyAnalysisLimit,
    networkDailyLimit,
    networkHashSalt: env.NETWORK_HASH_SALT,
    signingSecret: env.SESSION_SIGNING_SECRET,
    openAiApiKey,
    openAiModel,
    openAiTimeoutMs,
  };
}
