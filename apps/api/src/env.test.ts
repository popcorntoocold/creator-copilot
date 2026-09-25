import { describe, expect, it } from 'vitest';
import { parseEnv, type Env } from './env';

const baseEnv: Env = {
  DB: {} as D1Database,
  ENVIRONMENT: 'development',
  PROVIDER: 'fake',
  ALLOWED_EXTENSION_ORIGINS: 'http://localhost:5173',
  DAILY_ANALYSIS_LIMIT: '10',
  NETWORK_DAILY_LIMIT: '100',
  NETWORK_HASH_SALT: 'test-network-salt-value',
  SESSION_SIGNING_SECRET: 'test-session-signing-secret-value',
};

describe('parseEnv provider configuration', () => {
  it('allows fake-provider development without an OpenAI key', () => {
    expect(parseEnv(baseEnv)).toMatchObject({ provider: 'fake', openAiApiKey: undefined });
  });

  it('requires complete OpenAI configuration when the provider is enabled', () => {
    const production = {
      ...baseEnv,
      ENVIRONMENT: 'production',
      PROVIDER: 'openai',
      ALLOWED_EXTENSION_ORIGINS: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      OPENAI_MODEL: 'gpt-6-luna',
      OPENAI_TIMEOUT_MS: '15000',
    } satisfies Env;

    expect(() => parseEnv(production)).toThrow(/OPENAI_API_KEY/);
    expect(
      parseEnv({ ...production, OPENAI_API_KEY: 'test-key-not-a-real-secret' }),
    ).toMatchObject({
      provider: 'openai',
      openAiModel: 'gpt-6-luna',
      openAiTimeoutMs: 15000,
    });
  });
});
