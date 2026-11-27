import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  ActiveStatusRequest,
  Page,
  PageQuery,
  Service,
  ServiceRequest,
  Uuid,
} from '../models/api-models';
import { API } from './endpoints';
import { toHttpParams } from './http-params';

export interface MyServicesQuery extends PageQuery {
  /** Omitido = ativos e inativos. */
  readonly isActive?: boolean;
}

/** Serviços: #14 (público) e #15–#19 do próprio prestador (contracts/api-services.md). */
@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);

  /** #14 — somente serviços ativos do prestador. */
  listPublic(providerId: Uuid, query: PageQuery = {}): Observable<Page<Service>> {
    return this.http.get<Page<Service>>(API.providers.publicServices(providerId), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
  }

  /** #15 — serviços do prestador logado, inclusive inativos. */
  listMine(query: MyServicesQuery = {}): Observable<Page<Service>> {
    return this.http.get<Page<Service>>(API.services.mine, {
      params: toHttpParams({
        page: query.page,
        pageSize: query.pageSize,
        isActive: query.isActive,
      }),
    });
  }

  /** #16 — `409 service.name_taken` → campo `name`. */
  create(body: ServiceRequest): Observable<Service> {
    return this.http.post<Service>(API.services.mine, body);
  }

  /** #17 — agendamentos existentes mantêm o snapshot de duração e preço. */
  update(serviceId: Uuid, body: ServiceRequest): Observable<Service> {
    return this.http.put<Service>(API.services.byId(serviceId), body);
  }

  /** #18 — `204`; serviço já agendado → `409 service.in_use` (oferecer desativar). */
  delete(serviceId: Uuid): Observable<void> {
    return this.http.delete<void>(API.services.byId(serviceId));
  }

  /** #19 — ativa ou desativa. */
  setStatus(serviceId: Uuid, isActive: boolean): Observable<Service> {
    const body: ActiveStatusRequest = { isActive };
    return this.http.patch<Service>(API.services.status(serviceId), body);
  }
}
