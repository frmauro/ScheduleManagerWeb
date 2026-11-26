import type { AbstractControl } from '@angular/forms';

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
