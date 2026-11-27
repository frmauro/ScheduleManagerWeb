import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Page, PageQuery, Service, Uuid } from '../models/api-models';
import { API } from './endpoints';
import { toHttpParams } from './http-params';

/** Serviços: operação #14, pública (contracts/api-services.md). */
@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);

  /** #14 — somente serviços ativos do prestador. */
  listPublic(providerId: Uuid, query: PageQuery = {}): Observable<Page<Service>> {
    return this.http.get<Page<Service>>(API.providers.publicServices(providerId), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
  }
}
