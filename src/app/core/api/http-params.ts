import { HttpParams, type HttpParameterCodec } from '@angular/common/http';

export type QueryValue = string | number | boolean | readonly string[] | null | undefined;
export type QueryRecord = Readonly<Record<string, QueryValue>>;

/**
 * O codec padrão do Angular devolve `+` sem codificar, e o servidor o lê como espaço, o que
 * quebraria offsets como `+05:30` em `from`/`to`. Este codec codifica tudo com
 * `encodeURIComponent` (research R7, contracts/api-services.md).
 */
export class StrictParamCodec implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key);
  }
  encodeValue(value: string): string {
    return encodeURIComponent(value).replace(/%3A/gi, ':');
  }
  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }
  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}

const CODEC = new StrictParamCodec();

/**
 * Serializa uma consulta tipada (contracts/api-services.md, convenções):
 * arrays viram parâmetros repetidos; `undefined`, `null` e `''` são omitidos;
 * booleanos viram `true`/`false`.
 */
export function toHttpParams(query: QueryRecord): HttpParams {
  let params = new HttpParams({ encoder: CODEC });
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value as readonly string[]) {
        params = params.append(key, item);
      }
      continue;
    }
    params = params.append(key, String(value));
  }
  return params;
}
