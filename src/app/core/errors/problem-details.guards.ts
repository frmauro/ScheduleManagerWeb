import type { ProblemDetails, ValidationProblemDetails } from '../models/api-models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** RFC 7807 do contrato: `type`, `title`, `status`, `code` e `traceId` obrigatórios. */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    isRecord(value) &&
    typeof value['type'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['status'] === 'number' &&
    typeof value['code'] === 'string' &&
    typeof value['traceId'] === 'string' &&
    (value['detail'] === undefined || typeof value['detail'] === 'string')
  );
}

export function isValidationProblemDetails(value: unknown): value is ValidationProblemDetails {
  if (!isProblemDetails(value)) {
    return false;
  }
  const errors: unknown = (value as unknown as Record<string, unknown>)['errors'];
  return (
    isRecord(errors) &&
    Object.values(errors).every(
      (messages) => Array.isArray(messages) && messages.every((m) => typeof m === 'string'),
    )
  );
}

/** Extrai `traceId` de um corpo qualquer, se existir. */
export function readTraceId(value: unknown): string | undefined {
  return isRecord(value) && typeof value['traceId'] === 'string' ? value['traceId'] : undefined;
}
