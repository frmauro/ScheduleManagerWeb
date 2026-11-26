# Contrato Interno — Serviços de API (front-end → `/api/v1`)

**Feature**: `001-scheduling-web-app` | Componentes **nunca** usam `HttpClient` diretamente. Eles chamam estes serviços, um por recurso (em `src/app/core/api/`). Assinaturas em TypeScript. Os tipos vêm de [data-model.md](../data-model.md) (aliases do `schema.gen.ts`).

Todas as chamadas devolvem `Observable<T>` e falham com `ApiError` (normalizado pelo `errorInterceptor`). `PageQuery = { page?: number; pageSize?: number }`.

Este documento cobre as **34 operações**: cada linha `#n` corresponde ao inventário da spec (Apêndice A).

## AuthApi — `auth.api.ts`

| # | Método | HTTP | Observações |
|---|---|---|---|
| 1 | `registerCustomer(body: RegisterCustomerRequest): Observable<AuthResponse>` | POST `/auth/register/customer` | `201`; `409 user.email_taken` → erro no campo `email` |
| 2 | `registerProvider(body: RegisterProviderRequest): Observable<AuthResponse>` | POST `/auth/register/provider` | `201`; o mesmo `409` |
| 3 | `login(body: LoginRequest): Observable<AuthResponse>` | POST `/auth/login` | `401 auth.invalid_credentials` não dispara o fluxo de sessão expirada (marcado com `HttpContext SKIP_SESSION_401`) |
| 4 | `me(): Observable<CurrentUser>` | GET `/auth/me` | usado na inicialização |

## CustomersApi — `customers.api.ts`

| # | Método | HTTP |
|---|---|---|
| 5 | `getMe(): Observable<CustomerProfile>` | GET `/customers/me` |
| 6 | `updateMe(body: UpdateCustomerRequest): Observable<CustomerProfile>` | PUT `/customers/me` |
| 7 | `listMyAppointments(q: AppointmentListQuery & { providerId?: Uuid }): Observable<Page<AppointmentSummary>>` | GET `/customers/me/appointments` (`status` repetido; `from`/`to` com offset) |

## ProvidersApi — `providers.api.ts`

| # | Método | HTTP | Público |
|---|---|---|---|
| 8 | `search(q: PageQuery & { category?: ServiceCategory; city?: string; q?: string; sort?: 'displayName' \| '-displayName' }): Observable<Page<ProviderSummary>>` | GET `/providers` | sim |
| 9 | `getPublic(providerId: Uuid): Observable<ProviderPublicProfile>` | GET `/providers/{providerId}` | sim |
| 10 | `getMe(): Observable<ProviderProfile>` | GET `/providers/me` | |
| 11 | `updateMe(body: UpdateProviderRequest): Observable<ProviderProfile>` | PUT `/providers/me` | |
| 12 | `updateBookingPolicy(body: BookingPolicy): Observable<BookingPolicy>` | PUT `/providers/me/booking-policy` | |
| 13 | `listMyAppointments(q: AppointmentListQuery & { serviceId?: Uuid }): Observable<Page<AppointmentSummary>>` | GET `/providers/me/appointments` | |
| 25 | `availability(providerId: Uuid, q: { serviceId: Uuid; date: LocalDate }): Observable<AvailabilityResponse>` | GET `/providers/{providerId}/availability` | sim |

Helper (não é endpoint): `listAllMyAppointmentsInRange(from, to, filters)` segue `totalPages` com `pageSize=100` para o calendário ([R16](../research.md)).

## ServicesApi — `services.api.ts`

| # | Método | HTTP | Observações |
|---|---|---|---|
| 14 | `listPublic(providerId: Uuid, q?: PageQuery): Observable<Page<Service>>` | GET `/providers/{providerId}/services` | público; só ativos |
| 15 | `listMine(q?: PageQuery & { isActive?: boolean }): Observable<Page<Service>>` | GET `/providers/me/services` | |
| 16 | `create(body: ServiceRequest): Observable<Service>` | POST `/providers/me/services` | `409 service.name_taken` → campo `name` |
| 17 | `update(serviceId: Uuid, body: ServiceRequest): Observable<Service>` | PUT `/providers/me/services/{serviceId}` | |
| 18 | `delete(serviceId: Uuid): Observable<void>` | DELETE `/providers/me/services/{serviceId}` | `204`; `409 service.in_use` → oferecer desativar |
| 19 | `setStatus(serviceId: Uuid, isActive: boolean): Observable<Service>` | PATCH `/providers/me/services/{serviceId}/status` | |

## ScheduleApi — `schedule.api.ts`

| # | Método | HTTP | Observações |
|---|---|---|---|
| 20 | `getWeekly(): Observable<WeeklySchedule>` | GET `/providers/me/schedule` | |
| 21 | `replaceWorkingHours(body: Pick<WeeklySchedule, 'days'>): Observable<ScheduleChangeResult>` | PUT `/providers/me/schedule/working-hours` | não envia `timeZoneId`; o painel de afetados usa `affectedAppointments` |
| 22 | `listExceptions(q: PageQuery & { from?: LocalDate; to?: LocalDate }): Observable<Page<ScheduleException>>` | GET `/providers/me/schedule/exceptions` | |
| 23 | `createException(body: ScheduleExceptionRequest): Observable<ScheduleExceptionCreated>` | POST `/providers/me/schedule/exceptions` | `201` |
| 24 | `deleteException(exceptionId: Uuid): Observable<void>` | DELETE `/providers/me/schedule/exceptions/{exceptionId}` | `204` |

## AppointmentsApi — `appointments.api.ts`

`Versioned<T> = { value: T; etag: string }`, com `etag = header ETag ?? W/"{version}"` ([R9](../research.md)).

| # | Método | HTTP | Observações |
|---|---|---|---|
| 26 | `create(body: CreateAppointmentRequest, idempotencyKey: Uuid): Observable<{ appointment: Appointment; replayed: boolean }>` | POST `/appointments` (+ `Idempotency-Key`) | `201` → `replayed=false`; `200` → `replayed=true` (sucesso) |
| 27 | `get(appointmentId: Uuid): Observable<Versioned<Appointment>>` | GET `/appointments/{id}` | `observe: 'response'` |
| 28 | `confirm(appointmentId: Uuid, etag: string): Observable<Versioned<Appointment>>` | POST `/appointments/{id}/confirm` (+ `If-Match`) | |
| 29 | `cancel(appointmentId: Uuid, etag: string, body: CancelAppointmentRequest): Observable<Versioned<Appointment>>` | POST `/appointments/{id}/cancel` (+ `If-Match`) | `onBehalfOf` só é incluído quando o perfil é Admin (tipo `AdminCancelRequest` separado) |
| 30 | `complete(appointmentId: Uuid, etag: string): Observable<Versioned<Appointment>>` | POST `/appointments/{id}/complete` (+ `If-Match`) | `422 appointment.not_started` |

## NotificationsApi — `notifications.api.ts`

| # | Método | HTTP |
|---|---|---|
| 31 | `listMine(q: PageQuery & { type?: NotificationType }): Observable<Page<Notification>>` | GET `/notifications/me` |

## AdminApi — `admin.api.ts`

| # | Método | HTTP | Observações |
|---|---|---|---|
| 32 | `listUsers(q: PageQuery & { role?: Role; isActive?: boolean; q?: string }): Observable<Page<UserSummary>>` | GET `/admin/users` | |
| 33 | `setUserStatus(userId: Uuid, isActive: boolean): Observable<void>` | PATCH `/admin/users/{userId}/status` | `204`; `422 admin.cannot_deactivate_self` |
| 34 | `listNotifications(q: PageQuery & { status?: NotificationStatus; appointmentId?: Uuid }): Observable<Page<Notification>>` | GET `/admin/notifications` | |

## Convenções de serialização (`core/api/http-params.ts`)

- Arrays viram parâmetros repetidos (`status=Pending&status=Confirmed`); `undefined`/`''` são omitidos; booleanos viram `true`/`false`.
- `from`/`to` (Instant) são sempre gerados por `zonedDayRange`/`zonedWeekRange`/`nowInstant()` com offset explícito.
- Não há `toISOString()` sem offset local em parâmetros de período: `Z` é offset válido, mas a regra do projeto é gerar o offset no fuso do prestador ou do usuário.

## Testes de contrato (unitários, `HttpTestingController`)

Para cada método: verifica método HTTP, URL, query string serializada, headers (`Authorization`, `Idempotency-Key`, `If-Match`) e corpo. Um teste de inventário confere que os 34 pares método+rota acima existem nos serviços (lista em `core/api/endpoints.ts`, a única fonte das rotas, sem strings soltas).
