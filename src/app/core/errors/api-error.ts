import type { HttpErrorResponse } from '@angular/common/http';
import type { ProblemDetails, ValidationProblemDetails } from '../models/api-models';
import {
  isProblemDetails,
  isValidationProblemDetails,
  readTraceId,
} from './problem-details.guards';

export type ApiErrorKind = 'problem' | 'network' | 'unknown';

/**
 * Erro normalizado de toda chamada à API (research R8, data-model §4).
 * - `problem`: corpo RFC 7807 com `code` (inclui `http.error`);
 * - `network`: sem resposta (status 0: sem conexão ou proxy fora);
 * - `unknown`: resposta sem ProblemDetails (ex.: 5xx de gateway).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly problem?: ProblemDetails | ValidationProblemDetails;
  readonly traceId?: string;

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    problem?: ProblemDetails | ValidationProblemDetails;
    traceId?: string;
  }) {
    super(init.problem?.title ?? `HTTP ${init.status}`);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.problem = init.problem;
    this.traceId = init.traceId;
  }

  /** Código estável do contrato (ex.: `appointment.slot_unavailable`). */
  get code(): string | undefined {
    return this.problem?.code;
  }

  /** `errors` de um `400 validation.failed`, com chaves em camelCase pontuado. */
  get validationErrors(): Readonly<Record<string, string[]>> | undefined {
    return this.problem && isValidationProblemDetails(this.problem)
      ? this.problem.errors
      : undefined;
  }

  hasCode(...codes: readonly string[]): boolean {
    return this.code !== undefined && codes.includes(this.code);
  }
}

export function toApiError(response: HttpErrorResponse): ApiError {
  if (response.status === 0) {
    return new ApiError({ kind: 'network', status: 0 });
  }
  const body: unknown = response.error;
  if (isProblemDetails(body)) {
    return new ApiError({
      kind: 'problem',
      status: response.status,
      problem: body,
      traceId: body.traceId,
    });
  }
  return new ApiError({ kind: 'unknown', status: response.status, traceId: readTraceId(body) });
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
