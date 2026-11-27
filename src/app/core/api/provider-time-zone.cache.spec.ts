import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '../errors/api-error';
import type { ProviderPublicProfile } from '../models/api-models';
import { ProviderTimeZoneCache } from './provider-time-zone.cache';
import { ProvidersApi } from './providers.api';

class FakeProvidersApi {
  calls: string[] = [];
  missing = new Set<string>();
  getPublic(id: string): Observable<ProviderPublicProfile> {
    this.calls.push(id);
    if (this.missing.has(id)) {
      return throwError(() => new ApiError({ kind: 'problem', status: 404 }));
    }
    return of({
      id,
      displayName: `Prestador ${id}`,
      description: null,
      category: 'Barbershop',
      contactEmail: 'p@example.com',
      contactPhone: '+5511999998888',
      address: {
        street: 'Rua',
        number: '1',
        complement: null,
        district: 'Centro',
        city: 'Manaus',
        state: 'AM',
        postalCode: '69000000',
      },
      timeZoneId: 'America/Manaus',
    } as ProviderPublicProfile);
  }
}

describe('ProviderTimeZoneCache (R18)', () => {
  function setup() {
    const api = new FakeProvidersApi();
    TestBed.configureTestingModule({ providers: [{ provide: ProvidersApi, useValue: api }] });
    return { api, cache: TestBed.inject(ProviderTimeZoneCache) };
  }

  it('consulta cada prestador uma única vez', async () => {
    const { api, cache } = setup();
    expect(await firstValueFrom(cache.get('p1'))).toEqual({
      timeZoneId: 'America/Manaus',
      displayName: 'Prestador p1',
    });
    await firstValueFrom(cache.get('p1'));
    await firstValueFrom(cache.get('p2'));
    expect(api.calls).toEqual(['p1', 'p2']);
  });

  it('404 (prestador desativado) → null, também guardado', async () => {
    const { api, cache } = setup();
    api.missing.add('gone');
    expect(await firstValueFrom(cache.get('gone'))).toBeNull();
    expect(await firstValueFrom(cache.get('gone'))).toBeNull();
    expect(api.calls).toEqual(['gone']);
  });
});
