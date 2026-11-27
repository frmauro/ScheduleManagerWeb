import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AppointmentListQuery,
  AppointmentSummary,
  CustomerProfile,
  Page,
  UpdateCustomerRequest,
  Uuid,
} from '../models/api-models';
import { API } from './endpoints';
import { toHttpParams } from './http-params';

export interface CustomerAppointmentsQuery extends AppointmentListQuery {
  readonly providerId?: Uuid;
}

/** Cliente: #5–#7 (contracts/api-services.md). */
@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);

  /** #5 — perfil do cliente logado. */
  getMe(): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(API.customers.me);
  }

  /** #6 — `409 user.email_taken` quando o e-mail já é de outra conta. */
  updateMe(body: UpdateCustomerRequest): Observable<CustomerProfile> {
    return this.http.put<CustomerProfile>(API.customers.me, body);
  }

  /** #7 — `status` repetido, `from`/`to` com offset, `providerId` e `sort` (padrão `-startAt`). */
  listMyAppointments(query: CustomerAppointmentsQuery = {}): Observable<Page<AppointmentSummary>> {
    return this.http.get<Page<AppointmentSummary>>(API.customers.myAppointments, {
      params: toHttpParams({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        from: query.from,
        to: query.to,
        providerId: query.providerId,
        sort: query.sort,
      }),
    });
  }
}
