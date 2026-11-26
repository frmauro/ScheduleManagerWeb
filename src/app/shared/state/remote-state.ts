import { catchError, map, of, startWith, type Observable } from 'rxjs';
import { isApiError, ApiError } from '../../core/errors/api-error';

/**
 * Estado de dados remotos: garante carregando / vazio / erro / sucesso em toda tela (FR-004).
 */
export type RemoteState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'error'; readonly error: ApiError };

export const IDLE: RemoteState<never> = { status: 'idle' };
export const LOADING: RemoteState<never> = { status: 'loading' };

export function ready<T>(value: T): RemoteState<T> {
  return { status: 'ready', value };
}

export function failed(error: unknown): RemoteState<never> {
  return {
    status: 'error',
    error: isApiError(error) ? error : new ApiError({ kind: 'unknown', status: 0 }),
  };
}

/** Lista vazia ou página sem itens. */
export function isEmptyCollection(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object' && value !== null && 'items' in value) {
    const items: unknown = (value as { items: unknown }).items;
    return Array.isArray(items) && items.length === 0;
  }
  return false;
}

/** Converte uma requisição em fluxo de `RemoteState`, começando em `loading`. */
export function toRemoteState<T>(
  source: Observable<T>,
  isEmpty: (value: T) => boolean = isEmptyCollection,
): Observable<RemoteState<T>> {
  return source.pipe(
    map((value): RemoteState<T> => (isEmpty(value) ? { status: 'empty' } : ready(value))),
    startWith(LOADING),
    catchError((error: unknown) => of(failed(error))),
  );
}
