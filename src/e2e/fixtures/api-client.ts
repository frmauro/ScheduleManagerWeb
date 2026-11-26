import { request, type APIRequestContext, type APIResponse } from '@playwright/test';

/**
 * Cliente direto da API real em desenvolvimento (quickstart §2), usado só para preparar dados
 * dos cenários E2E. A interface é sempre exercitada pelo navegador.
 */
/** Mesma origem do `proxy.conf.json` (perfil `https` da API). */
export const API_ORIGIN = 'https://localhost:7154';
export const API_PREFIX = '/api/v1';

export class ApiClient {
  private constructor(
    private readonly ctx: APIRequestContext,
    readonly token: string | null,
  ) {}

  static async create(token: string | null = null): Promise<ApiClient> {
    const ctx = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return new ApiClient(ctx, token);
  }

  withToken(token: string): Promise<ApiClient> {
    return ApiClient.create(token);
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  private url(path: string): string {
    return `${API_ORIGIN}${API_PREFIX}${path}`;
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.json<T>(await this.ctx.get(this.url(path), { params }), 'GET', path);
  }

  async post<T>(path: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.json<T>(await this.ctx.post(this.url(path), { data, headers }), 'POST', path);
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    return this.json<T>(await this.ctx.put(this.url(path), { data }), 'PUT', path);
  }

  async patch(path: string, data: unknown): Promise<void> {
    await this.json<unknown>(await this.ctx.patch(this.url(path), { data }), 'PATCH', path);
  }

  /** Resposta crua, para cenários que verificam status (ex.: 409, 422). */
  raw(method: 'GET' | 'POST', path: string, data?: unknown): Promise<APIResponse> {
    return method === 'GET'
      ? this.ctx.get(this.url(path))
      : this.ctx.post(this.url(path), { data });
  }

  private async json<T>(response: APIResponse, method: string, path: string): Promise<T> {
    if (!response.ok()) {
      throw new Error(`${method} ${path} → ${response.status()}: ${await response.text()}`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
