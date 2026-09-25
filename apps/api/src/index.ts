import OpenAI from 'openai';
import { AuthService } from './auth';
import { AnalysisService } from './analysis';
import { D1AuthStore } from './db';
import { parseEnv, type Env } from './env';
import { D1UsageStore, QuotaService } from './quota';
import { FakeAnalysisProvider } from './providers/fake';
import { OpenAIAnalysisProvider, type OpenAIResponsesClient } from './providers/openai';
import type { AnalysisProvider } from './providers/types';
import { createRouter } from './router';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = parseEnv(env);
    const auth = new AuthService({
      store: new D1AuthStore(env.DB),
      signingSecret: config.signingSecret,
      dailyLimit: config.dailyAnalysisLimit,
    });
    const provider: AnalysisProvider =
      config.provider === 'fake'
        ? new FakeAnalysisProvider()
        : new OpenAIAnalysisProvider({
            client: new OpenAI({ apiKey: config.openAiApiKey }) as unknown as OpenAIResponsesClient,
            model: config.openAiModel!,
            timeoutMs: config.openAiTimeoutMs!,
          });
    const quota = new QuotaService({
      store: new D1UsageStore(env.DB),
      dailyLimit: config.dailyAnalysisLimit,
      networkLimit: config.networkDailyLimit,
      networkSalt: config.networkHashSalt,
    });
    const analysis = new AnalysisService({
      authenticator: auth,
      quota,
      provider,
    });
    return createRouter({ allowedOrigins: config.allowedOrigins, auth, analysis }).fetch(request);
  },
} satisfies ExportedHandler<Env>;
