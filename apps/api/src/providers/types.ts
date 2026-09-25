import type { AnalysisRequest } from '@creator-copilot/shared';

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AnalysisProviderResult = {
  payload: unknown;
  usage?: ProviderUsage;
  providerRequestId?: string;
};

export interface AnalysisProvider {
  analyze(request: AnalysisRequest, context?: AnalysisProviderContext): Promise<AnalysisProviderResult>;
}

export type AnalysisProviderContext = {
  safetyIdentifier: string;
  clientRequestId: string;
};
