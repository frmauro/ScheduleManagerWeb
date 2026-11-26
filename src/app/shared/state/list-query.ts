import type { ParamMap } from '@angular/router';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../core/config/app.constants';

/**
 * Filtros, ordenação e página refletidos na URL (FR-022, data-model §4 "ListQuery").
 * O formato é declarado por um `QueryShape`, e o resultado é tipado a partir dele.
 */
export type QueryFieldSpec =
  | { readonly kind: 'int'; readonly default: number; readonly min: number; readonly max: number }
  | { readonly kind: 'string' }
  | { readonly kind: 'enum'; readonly values: readonly string[]; readonly default?: string }
  | { readonly kind: 'enumArray'; readonly values: readonly string[] }
  | { readonly kind: 'date' };

export type QueryShape = Readonly<Record<string, QueryFieldSpec>>;

type ValueOf<F> = F extends { kind: 'int' }
  ? number
  : F extends { kind: 'enum'; values: readonly (infer V)[]; default: string }
    ? V
    : F extends { kind: 'enum'; values: readonly (infer V)[] }
      ? V | undefined
      : F extends { kind: 'enumArray'; values: readonly (infer V)[] }
        ? V[]
        : string | undefined;

export type ParsedQuery<S extends QueryShape> = { -readonly [K in keyof S]: ValueOf<S[K]> };

/** Valores prontos para `router.navigate([], { queryParams, queryParamsHandling: 'merge' })`. */
export type SerializedQuery = Record<string, string | string[] | null>;

/** Paginação padrão das listas: `pagina` ≥ 1 e `itens` de 1 a 100 (padrão 20). */
export const PAGE_FIELDS = {
  pagina: { kind: 'int', default: 1, min: 1, max: Number.MAX_SAFE_INTEGER },
  itens: { kind: 'int', default: DEFAULT_PAGE_SIZE, min: 1, max: MAX_PAGE_SIZE },
} as const satisfies QueryShape;

const LOCAL_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function parseField(spec: QueryFieldSpec, params: ParamMap, key: string): unknown {
  switch (spec.kind) {
    case 'int': {
      const raw = params.get(key);
      const value = raw !== null && /^-?\d+$/.test(raw) ? Number(raw) : NaN;
      return Number.isInteger(value) && value >= spec.min && value <= spec.max
        ? value
        : spec.default;
    }
    case 'string': {
      const value = params.get(key)?.trim();
      return value ? value : undefined;
    }
    case 'enum': {
      const value = params.get(key);
      return value !== null && spec.values.includes(value) ? value : spec.default;
    }
    case 'enumArray':
      return params.getAll(key).filter((v) => spec.values.includes(v));
    case 'date': {
      const value = params.get(key);
      return value !== null && LOCAL_DATE.test(value) ? value : undefined;
    }
  }
}

export function parseListQuery<S extends QueryShape>(params: ParamMap, shape: S): ParsedQuery<S> {
  const result: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(shape)) {
    result[key] = parseField(spec, params, key);
  }
  return result as ParsedQuery<S>;
}

function isDefault(spec: QueryFieldSpec, value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return (spec.kind === 'int' || spec.kind === 'enum') && value === spec.default;
}

/** Omite padrões e vazios (como `null`, que remove a chave ao mesclar com a URL atual). */
export function serializeListQuery<S extends QueryShape>(
  query: ParsedQuery<S>,
  shape: S,
): SerializedQuery {
  const result: SerializedQuery = {};
  for (const [key, spec] of Object.entries(shape)) {
    const value: unknown = (query as Record<string, unknown>)[key];
    if (isDefault(spec, value)) {
      result[key] = null;
    } else if (Array.isArray(value)) {
      result[key] = value.map(String);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}
