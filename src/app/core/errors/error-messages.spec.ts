import { ApiError } from './api-error';
import {
  API_ERROR_CODES,
  ERROR_MESSAGES,
  isApiErrorCode,
  resolveErrorMessage,
} from './error-messages';

function problemError(code: string, detail?: string, traceId = 'trace-9'): ApiError {
  return new ApiError({
    kind: 'problem',
    status: 422,
    problem: { type: 't', title: 'x', status: 422, code, traceId, detail },
    traceId,
  });
}

describe('catálogo de erros', () => {
  it('tem os 36 códigos do briefing + http.error (37 no total)', () => {
    expect(API_ERROR_CODES).toHaveLength(37);
    expect(new Set(API_ERROR_CODES).size).toBe(37);
    expect(API_ERROR_CODES).toContain('http.error');
  });

  it('todo código tem mensagem pt-BR não vazia (SC-007)', () => {
    for (const code of API_ERROR_CODES) {
      expect(ERROR_MESSAGES[code].message.trim().length, code).toBeGreaterThan(0);
    }
  });

  it('usa a mensagem do catálogo para um código conhecido', () => {
    expect(resolveErrorMessage(problemError('appointment.slot_unavailable'))).toBe(
      'Este horário acabou de ser ocupado. Escolha outro.',
    );
  });

  it('interpola {traceId}', () => {
    const msg = resolveErrorMessage(problemError('server.internal_error', undefined, 'abc-1'));
    expect(msg).toContain('abc-1');
    expect(msg).not.toContain('{traceId}');
  });

  it('código desconhecido usa o detail da API', () => {
    expect(resolveErrorMessage(problemError('algo.novo', 'Mensagem do servidor.'))).toBe(
      'Mensagem do servidor.',
    );
  });

  it('sem detail, mensagem genérica com o traceId', () => {
    const msg = resolveErrorMessage(problemError('algo.novo', undefined, 'tr-77'));
    expect(msg).toContain('tr-77');
  });

  it('erro de rede tem mensagem própria', () => {
    expect(resolveErrorMessage(new ApiError({ kind: 'network', status: 0 }))).toBe(
      'Não foi possível conectar. Verifique sua internet e tente novamente.',
    );
  });

  it('erro desconhecido sem traceId informa "indisponível"', () => {
    const msg = resolveErrorMessage(new ApiError({ kind: 'unknown', status: 503 }));
    expect(msg).toContain('indisponível');
  });

  it('isApiErrorCode reconhece só códigos do catálogo', () => {
    expect(isApiErrorCode('auth.forbidden')).toBe(true);
    expect(isApiErrorCode('auth.qualquer')).toBe(false);
  });
});
