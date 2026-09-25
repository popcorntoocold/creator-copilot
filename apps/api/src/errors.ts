import type { ApiErrorCode } from '@creator-copilot/shared';

export type ErrorDetails = {
  code: ApiErrorCode;
  message: string;
  retryable?: boolean;
  requestId?: string;
  quotaConsumed?: boolean;
};

export function errorResponse(status: number, details: ErrorDetails, headers?: HeadersInit): Response {
  const error = {
    code: details.code,
    message: details.message,
    retryable: details.retryable ?? false,
    ...(details.requestId ? { requestId: details.requestId } : {}),
    ...(details.quotaConsumed === undefined ? {} : { quotaConsumed: details.quotaConsumed }),
  };

  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}
