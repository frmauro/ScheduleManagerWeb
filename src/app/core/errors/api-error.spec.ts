import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

function httpError(status: number, error: unknown, headers?: HttpHeaders): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, headers, url: '/api/v1/x' });
}

describe('toApiError', () => {
  it('status 0 vira kind "network"', () => {
    const err = toApiError(httpError(0, new ProgressEvent('error')));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('network');
    expect(err.status).toBe(0);
  });

  it('corpo ProblemDetails vira kind "problem" com code e traceId', () => {
    const err = toApiError(
      httpError(409, {
        type: 't',
        title: 'Conflito',
        status: 409,
        code: 'appointment.slot_unavailable',
        traceId: 'trace-1',
      }),
    );
    expect(err.kind).toBe('problem');
    expect(err.code).toBe('appointment.slot_unavailable');
    expect(err.traceId).toBe('trace-1');
    expect(err.problem?.status).toBe(409);
  });

  it('http.error também é tratado como problem', () => {
    const err = toApiError(
      httpError(415, { type: 't', title: 'x', status: 415, code: 'http.error', traceId: 't-2' }),
    );
    expect(err.kind).toBe('problem');
    expect(err.code).toBe('http.error');
  });

  it('5xx sem corpo vira kind "unknown" sem traceId', () => {
    const err = toApiError(httpError(502, null));
    expect(err.kind).toBe('unknown');
    expect(err.status).toBe(502);
    expect(err.traceId).toBeUndefined();
  });

  it('5xx com corpo não padronizado mas com traceId aproveita o traceId', () => {
    const err = toApiError(httpError(500, { traceId: 'only-trace' }));
    expect(err.kind).toBe('unknown');
    expect(err.traceId).toBe('only-trace');
  });

  it('expõe os erros de validação quando for ValidationProblemDetails', () => {
    const err = toApiError(
      httpError(400, {
        type: 't',
        title: 'Validação',
        status: 400,
        code: 'validation.failed',
        traceId: 't-3',
        errors: { email: ['Inválido.'] },
      }),
    );
    expect(err.validationErrors).toEqual({ email: ['Inválido.'] });
  });
});
