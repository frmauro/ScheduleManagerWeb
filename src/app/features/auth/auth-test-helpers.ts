import { ApiError } from '../../core/errors/api-error';
import type { AuthResponse } from '../../core/models/api-models';
import type { Role } from '../../core/models/enums';

/** Utilitários dos specs de autenticação (sem HTTP: a regra de camadas vale para os specs). */
export function authResponse(role: Role): AuthResponse {
  return {
    accessToken: 'token',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    user: { id: 'u1', name: 'Ana', email: 'ana@example.com', role },
  };
}

export function problem(status: number, code: string, errors?: Record<string, string[]>): ApiError {
  return new ApiError({
    kind: 'problem',
    status,
    problem: {
      type: 'about:blank',
      title: code,
      status,
      code,
      traceId: 'trace-1',
      ...(errors ? { errors } : {}),
    },
  });
}

export function fill(root: HTMLElement, label: string, value: string): void {
  // Só campos visíveis (o assistente mantém as outras etapas ocultas no DOM).
  const labelEl = Array.from(root.querySelectorAll('label')).find(
    (l) => !l.closest('[hidden]') && l.textContent?.trim().startsWith(label),
  );
  const id = labelEl?.getAttribute('for');
  const control = id ? root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`) : null;
  if (!control) {
    throw new Error(`campo "${label}" não encontrado`);
  }
  control.value = value;
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
  control.dispatchEvent(new Event('blur'));
}

export function submit(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
}

export function visible(root: HTMLElement, selector: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>(selector)).find((e) => !e.closest('[hidden]')) ??
    null
  );
}
