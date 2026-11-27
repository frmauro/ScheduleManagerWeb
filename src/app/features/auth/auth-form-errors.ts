import type { AbstractControl } from '@angular/forms';
import { isApiError } from '../../core/errors/api-error';
import { ERROR_MESSAGES, resolveErrorMessage } from '../../core/errors/error-messages';
import { applyFieldError, applyServerErrors } from '../../core/errors/form-errors';
import { ApiError } from '../../core/errors/api-error';

/** Resultado do tratamento: mensagens para o resumo e campos que receberam erro do servidor. */
export interface AuthFormErrorResult {
  readonly summary: string[];
  readonly fields: string[];
}

/**
 * Erros dos formulários de login/cadastro (FR-013): `400 validation.failed` vai para os campos;
 * `409 user.email_taken` vai para o e-mail; o resto vira mensagem do catálogo no resumo.
 */
export function handleAuthFormError(form: AbstractControl, error: unknown): AuthFormErrorResult {
  const apiError = isApiError(error) ? error : new ApiError({ kind: 'unknown', status: 0 });
  const validation = apiError.validationErrors;
  if (validation) {
    const summary = applyServerErrors(form, validation);
    const fields = Object.keys(validation).filter((path) => form.get(path) !== null);
    return { summary, fields };
  }
  if (apiError.hasCode('user.email_taken')) {
    const message = ERROR_MESSAGES['user.email_taken'].message;
    return applyFieldError(form, 'email', message)
      ? { summary: [], fields: ['email'] }
      : { summary: [message], fields: [] };
  }
  return { summary: [resolveErrorMessage(apiError)], fields: [] };
}
