import type { AbstractControl } from '@angular/forms';
import { ApiError, isApiError } from './api-error';
import { ERROR_MESSAGES, isApiErrorCode, resolveErrorMessage } from './error-messages';

/** Chave usada em `control.errors` para mensagens vindas do servidor. */
export const SERVER_ERROR_KEY = 'server';

function setServerError(control: AbstractControl, message: string): void {
  control.setErrors({ ...(control.errors ?? {}), [SERVER_ERROR_KEY]: message });
  control.markAsTouched();
  // O erro do servidor vale até o usuário alterar o valor; a revalidação o remove.
  const subscription = control.valueChanges.subscribe(() => {
    subscription.unsubscribe();
    control.updateValueAndValidity({ emitEvent: false });
  });
}

/**
 * Mapeia `errors` de um `400 validation.failed` aos controles pelo caminho pontuado
 * (`address.city` → `form.get('address.city')`), conforme FR-006.
 * Retorna as mensagens sem controle correspondente, para o resumo no topo do formulário.
 */
export function applyServerErrors(
  form: AbstractControl,
  errors: Readonly<Record<string, readonly string[]>>,
): string[] {
  const unmatched: string[] = [];
  for (const [path, messages] of Object.entries(errors)) {
    const first = messages[0];
    if (first === undefined) {
      continue;
    }
    const control = form.get(path);
    if (control) {
      setServerError(control, first);
    } else {
      unmatched.push(...messages);
    }
  }
  return unmatched;
}

/** Aplica uma mensagem a um campo (ex.: `409 user.email_taken` → `email`). */
export function applyFieldError(form: AbstractControl, path: string, message: string): boolean {
  const control = form.get(path);
  if (!control) {
    return false;
  }
  setServerError(control, message);
  return true;
}

/** Resultado de `handleFormError`: mensagens para o resumo e campos que receberam erro. */
export interface FormErrorResult {
  readonly summary: string[];
  readonly fields: string[];
}

/**
 * Tratamento padrão dos formulários (FR-006): `400 validation.failed` vai para os campos;
 * códigos com campo próprio no catálogo (`presentation: 'field'`, ex.: `service.name_taken` →
 * `name`) ou em `fieldByCode` vão para o campo; o resto vira mensagem no resumo.
 */
export function handleFormError(
  form: AbstractControl,
  error: unknown,
  fieldByCode: Readonly<Record<string, string>> = {},
): FormErrorResult {
  const apiError = isApiError(error) ? error : new ApiError({ kind: 'unknown', status: 0 });
  const validation = apiError.validationErrors;
  if (validation) {
    const summary = applyServerErrors(form, validation);
    const fields = Object.keys(validation).filter((path) => form.get(path) !== null);
    return { summary, fields };
  }
  const code = apiError.code;
  const message = resolveErrorMessage(apiError);
  const field =
    (code && fieldByCode[code]) ?? (isApiErrorCode(code) ? ERROR_MESSAGES[code].field : undefined);
  if (field && applyFieldError(form, field, message)) {
    return { summary: [], fields: [field] };
  }
  return { summary: [message], fields: [] };
}
