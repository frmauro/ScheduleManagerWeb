import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, reduce, type Observable } from 'rxjs';
import type {
  AppointmentListQuery,
  AppointmentSummary,
  AvailabilityResponse,
  Instant,
  BookingPolicy,
  LocalDate,
  Page,
  PageQuery,
  ProviderProfile,
  ProviderPublicProfile,
  ProviderSummary,
  UpdateProviderRequest,
  Uuid,
} from '../models/api-models';
import { CALENDAR_PAGE_SIZE } from '../config/app.constants';
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

export interface ProviderAppointmentsQuery extends AppointmentListQuery {
  readonly serviceId?: Uuid;
}

export type ProviderAppointmentsFilters = Omit<
  ProviderAppointmentsQuery,
  'from' | 'to' | 'page' | 'pageSize' | 'sort'
>;

export interface AvailabilityQuery {
  readonly serviceId: Uuid;
  readonly date: LocalDate;
}

/**
 * Prestadores: #8, #9 e #25 (públicas) e #10–#13 do próprio prestador
 * (contracts/api-services.md).
 */
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

  /** #10 — perfil do prestador logado, com `bookingPolicy` e `isActive`. */
  getMe(): Observable<ProviderProfile> {
    return this.http.get<ProviderProfile>(API.providers.me);
  }

  /** #11 — substitui os dados do estabelecimento. */
  updateMe(body: UpdateProviderRequest): Observable<ProviderProfile> {
    return this.http.put<ProviderProfile>(API.providers.me, body);
  }

  /** #12 — política de reservas: todos os campos no corpo; vale só para novas reservas. */
  updateBookingPolicy(body: BookingPolicy): Observable<BookingPolicy> {
    return this.http.put<BookingPolicy>(API.providers.myBookingPolicy, body);
  }

  /** #13 — agenda do prestador: `status` repetido, `from`/`to` com offset, `serviceId`, `sort`. */
  listMyAppointments(query: ProviderAppointmentsQuery = {}): Observable<Page<AppointmentSummary>> {
    return this.http.get<Page<AppointmentSummary>>(API.providers.myAppointments, {
      params: toHttpParams({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        from: query.from,
        to: query.to,
        serviceId: query.serviceId,
        sort: query.sort,
      }),
    });
  }

  /**
   * Helper do calendário (R16, não é endpoint): todos os agendamentos de `[from, to)` em ordem de
   * início, seguindo `totalPages` com `pageSize=100` para não omitir nenhum.
   */
  listAllMyAppointmentsInRange(
    from: Instant,
    to: Instant,
    filters: ProviderAppointmentsFilters = {},
  ): Observable<AppointmentSummary[]> {
    const pageOf = (page: number) =>
      this.listMyAppointments({
        ...filters,
        from,
        to,
        sort: 'startAt',
        page,
        pageSize: CALENDAR_PAGE_SIZE,
      });
    return pageOf(1).pipe(
      expand((result) => (result.page < result.totalPages ? pageOf(result.page + 1) : EMPTY)),
      map((result) => result.items),
      reduce<AppointmentSummary[], AppointmentSummary[]>((all, items) => [...all, ...items], []),
    );
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
