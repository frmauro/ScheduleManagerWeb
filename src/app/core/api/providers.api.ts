import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AvailabilityResponse,
  LocalDate,
  Page,
  PageQuery,
  ProviderPublicProfile,
  ProviderSummary,
  Uuid,
} from '../models/api-models';
import type { ServiceCategory } from '../models/enums';
import { API } from './endpoints';
import { toHttpParams } from './http-params';

export type ProviderSort = 'displayName' | '-displayName';

export interface ProviderSearchQuery extends PageQuery {
  readonly category?: ServiceCategory;
  readonly city?: string;
  readonly q?: string;
  readonly sort?: ProviderSort;
}

export interface AvailabilityQuery {
  readonly serviceId: Uuid;
  readonly date: LocalDate;
}

/** Prestadores: operações #8, #9 e #25, públicas (contracts/api-services.md). */
@Injectable({ providedIn: 'root' })
export class ProvidersApi {
  private readonly http = inject(HttpClient);

  /** #8 — catálogo público de prestadores ativos. */
  search(query: ProviderSearchQuery = {}): Observable<Page<ProviderSummary>> {
    return this.http.get<Page<ProviderSummary>>(API.providers.search, {
      params: toHttpParams({
        page: query.page,
        pageSize: query.pageSize,
        category: query.category,
        city: query.city,
        q: query.q,
        sort: query.sort,
      }),
    });
  }

  /** #9 — `404 provider.not_found` para inexistente ou inativo. */
  getPublic(providerId: Uuid): Observable<ProviderPublicProfile> {
    return this.http.get<ProviderPublicProfile>(API.providers.byId(providerId));
  }

  /**
   * #25 — `date` (`yyyy-MM-dd`) é interpretada no fuso do prestador. Dia sem vagas → `200` com
   * `slots: []`. Os `startAt` devolvidos são opacos e reenviados intactos (FR-026).
   */
  availability(providerId: Uuid, query: AvailabilityQuery): Observable<AvailabilityResponse> {
    return this.http.get<AvailabilityResponse>(API.providers.availability(providerId), {
      params: toHttpParams({ serviceId: query.serviceId, date: query.date }),
    });
  }
}
