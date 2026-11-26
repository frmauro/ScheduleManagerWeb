# Fase 1 — Modelo de Dados: ScheduleManager Web

**Feature**: `001-scheduling-web-app` | **Data**: 2026-11-25 | **Fonte autoritativa**: `../api/specs/001-online-scheduling-api/contracts/openapi.yaml`

O front-end **não define** entidades de domínio próprias. Os modelos de API são aliases dos tipos gerados (`components['schemas'][...]`, ver [research.md R5](./research.md)). Este documento registra:

- os **modelos de API** consumidos e as regras de validação espelhadas nos formulários;
- a **máquina de estados** usada para mostrar ou ocultar ações;
- os **modelos de estado do cliente**, que existem só no navegador.

Convenções: `?` = opcional; `| null` = anulável; `Instant` = ISO 8601 **com offset**; `LocalDate` = `yyyy-MM-dd`; `LocalTime` = `HH:mm` (24h, `^([01]\d|2[0-3]):[0-5]\d$`); `Uuid` = string UUID.

---

## 1. Enumerações (strings; a API recusa inteiros)

| Enum | Valores | Rótulo pt-BR |
|---|---|---|
| `Role` | Admin, Provider, Customer | Administrador, Prestador, Cliente |
| `ServiceCategory` | Beauty, Barbershop, Health, Dental, Therapy, Fitness, Wellness, Education, Consulting, Other | Beleza, Barbearia, Saúde, Odontologia, Terapia, Fitness, Bem-estar, Educação, Consultoria, Outros |
| `AppointmentStatus` | Pending, Confirmed, CancelledByCustomer, CancelledByProvider, Completed | Pendente, Confirmado, Cancelado pelo cliente, Cancelado pelo prestador, Concluído |
| `DayOfWeek` | Sunday … Saturday | Domingo … Sábado (editor ordena de Domingo a Sábado) |
| `ScheduleExceptionType` | Closure, SpecialHours | Fechamento, Horário especial |
| `NotificationType` | AppointmentCreated, AppointmentConfirmed, AppointmentCancelled, AppointmentReminder | Agendamento criado, Confirmado, Cancelado, Lembrete |
| `NotificationStatus` | Pending, Sent, Failed, Cancelled | Pendente, Enviada, Falhou, Cancelada |

Cada enum é exposto como `const X_VALUES = [...] as const satisfies readonly Schema['X'][]` e tem um mapa `X_LABELS: Record<X, string>`. O `AppointmentStatus` também tem `STATUS_VISUALS: Record<AppointmentStatus, { icon: LucideIcon; tone: 'warning' | 'success' | 'danger' | 'neutral' | 'info' }>`, porque o status não pode depender só de cor (FR-009).

## 2. Modelos de API

### 2.1 Comuns

- **Address** — `street` (≤ 200), `number` (≤ 20), `complement?` (≤ 100, `| null`), `district` (≤ 100), `city` (≤ 100), `state` (`^[A-Z]{2}$`), `postalCode` (`^\d{8}$`).
- **Phone** — string `^\+[1-9]\d{7,14}$` (a máscara BR converte para E.164).
- **Page<T>** — `items: T[]`, `page`, `pageSize`, `totalCount`, `totalPages`. Consulta: `page ≥ 1` (padrão 1), `pageSize` 1–100 (padrão 20).
- **ProblemDetails** — `type`, `title`, `status`, `detail?`, `instance?`, `code`, `traceId`.
- **ValidationProblemDetails** — ProblemDetails + `errors: Record<string, string[]>`. As chaves vêm em camelCase com caminho pontuado (`startAt`, `address.city`) e são mapeadas aos controles do formulário pelo mesmo caminho.

### 2.2 Autenticação

| Modelo | Campos | Validação no formulário |
|---|---|---|
| `LoginRequest` | `email`, `password` | e-mail válido; senha obrigatória |
| `RegisterCustomerRequest` | `name`, `email`, `password`, `phone` | nome 2–120; e-mail ≤ 254; senha 8–128 com ≥ 1 letra e ≥ 1 dígito; telefone E.164 |
| `RegisterProviderRequest` | `name`, `email`, `password`, `displayName`, `description?`, `category`, `contactEmail?`, `contactPhone`, `address`, `timeZoneId?` | como acima, mais `displayName` 2–120, `description` ≤ 2000, `contactEmail` e-mail (padrão = e-mail da conta), `timeZoneId` da lista IANA (padrão `America/Sao_Paulo`) |
| `AuthResponse` | `accessToken`, `tokenType: 'Bearer'`, `expiresAt: Instant`, `user: CurrentUser` | — |
| `CurrentUser` | `id`, `name`, `email`, `role`, `providerId?: Uuid \| null`, `customerId?: Uuid \| null` | — |

### 2.3 Cliente

- **CustomerProfile** — `id`, `name`, `email`, `phone`, `createdAt: Instant`.
- **UpdateCustomerRequest** — `name` (2–120), `email` (≤ 254), `phone` (E.164).

### 2.4 Prestador

- **ProviderSummary** — `id`, `displayName`, `category`, `city`, `state`.
- **ProviderPublicProfile** — `id`, `displayName`, `description?: string | null`, `category`, `contactEmail?`, `contactPhone`, `address`, `timeZoneId`.
- **ProviderProfile** — ProviderPublicProfile + `bookingPolicy: BookingPolicy`, `isActive: boolean`.
- **UpdateProviderRequest** — `displayName` (2–120), `description?` (≤ 2000), `category`, `contactEmail` (obrigatório aqui), `contactPhone`, `address`, `timeZoneId`.
- **BookingPolicy** (todos obrigatórios no `PUT`):

| Campo | Faixa | Padrão | Exibição |
|---|---|---|---|
| `autoConfirm` | bool | false | "Confirmar reservas automaticamente" |
| `slotStepMinutes` | 5–60, múltiplo de 5 | 15 | minutos |
| `bufferMinutes` | 0–120, múltiplo de 5 | 0 | minutos |
| `minBookingNoticeMinutes` | 0–10080 | 60 | minutos/horas/dias (`formatDuration`) |
| `bookingHorizonDays` | 1–365 | 60 | dias |
| `minCancellationNoticeMinutes` | 0–10080 | 120 | minutos/horas/dias |

### 2.5 Serviços

- **Service** — `id`, `providerId`, `name`, `description?: string | null`, `durationMinutes`, `price`, `isActive`.
- **ServiceRequest** — `name` 2–100 (único por prestador → `409 service.name_taken`), `description?` ≤ 1000, `durationMinutes` 5–720 em múltiplos de 5, `price` 0–99999.99 com 2 casas (campo em BRL `0,00`).
- **ActiveStatusRequest** — `isActive`.

### 2.6 Agenda

- **TimeInterval** — `start: LocalTime`, `end: LocalTime`. Regras locais: `start < end`; não atravessa meia-noite (`end` ≠ `00:00` como "fim do dia"; `23:59` é o limite).
- **WeeklySchedule** — `timeZoneId` (só leitura), `days: { dayOfWeek, intervals: TimeInterval[1..10] }[0..7]`. `dayOfWeek` é único; dia omitido = fechado. Validador `nonOverlappingIntervals` por dia: ordena por `start` e exige `intervals[i].end ≤ intervals[i+1].start`. Faixas encostadas são válidas, e a lacuna entre elas é o intervalo (ex.: almoço).
- **ScheduleExceptionRequest** — `type`, `startDate: LocalDate`, `endDate: LocalDate` (≥ `startDate`; período `endDate − startDate + 1 ≤ 366` dias), `startTime?`, `endTime?` (ambos ou nenhum; obrigatórios para `SpecialHours`; `startTime < endTime`), `reason?` ≤ 200. Regra local: `startDate ≥ hoje` no fuso do prestador (a API confirma com `schedule.exception_in_past`).
- **ScheduleException** — `id` + campos do request.
- **ScheduleChangeResult** — `schedule`, `affectedAppointments: AppointmentSummary[]`.
- **ScheduleExceptionCreated** — `exception`, `affectedAppointments: AppointmentSummary[]`.

### 2.7 Disponibilidade

- **AvailabilityResponse** — `providerId`, `serviceId`, `date: LocalDate`, `timeZoneId`, `durationMinutes`, `slots: TimeSlot[]` (ordenados, sem duplicatas).
- **TimeSlot** — `startAt: Instant`, `endAt: Instant`. **`startAt` é opaco**: é repassado sem alteração ao `CreateAppointmentRequest`.

### 2.8 Agendamentos

- **CreateAppointmentRequest** — `providerId`, `serviceId`, `startAt` (string exata do slot), `notes?` ≤ 500. Header `Idempotency-Key: Uuid`.
- **CancelAppointmentRequest** — `reason` 3–500 (obrigatório), `onBehalfOf?: 'Customer' | 'Provider'`, **enviado somente pelo Admin e obrigatório para ele**.
- **AppointmentSummary** — `id`, `providerId`, `providerName`, `customerId`, `customerName`, `serviceName`, `startAt`, `endAt`, `status`.
- **Appointment** — `id`, `provider { id, displayName, timeZoneId }`, `customer { id, name, email?, phone? }`, `service { id, name, durationMinutes, price }` (cópia do momento da reserva), `startAt`, `endAt`, `status`, `notes?`, `cancellationReason?`, `version` (= ETag), `createdAt`, `history: StatusChange[]`.
- **StatusChange** — `fromStatus?: AppointmentStatus | null`, `toStatus`, `changedByRole: Role`, `reason?`, `changedAt`.
- **Filtros de lista** (cliente e prestador) — `status[]` (repetido na query), `from`/`to` Instant (`to` exclusivo, `to > from`, máx. 366 dias), `sort: 'startAt' | '-startAt'`; cliente: `providerId?`; prestador: `serviceId?`.

### 2.9 Notificações e Admin

- **Notification** — `id`, `appointmentId`, `type`, `channel: 'Email'`, `subject`, `body?`, `status`, `attempts?`, `scheduledFor?`, `sentAt?: Instant | null`, `createdAt`. Filtro `/notifications/me`: `type?`. Filtro `/admin/notifications`: `status?`, `appointmentId?`.
- **UserSummary** — `id`, `name`, `email`, `role`, `isActive`, `createdAt`. Filtros: `role?`, `isActive?`, `q?`.

## 3. Máquina de estados do agendamento

```text
             confirm (Provider, Admin)
  Pending ───────────────────────────────▶ Confirmed
     │  \                                     │   \
     │   cancel (Customer*, Admin→Customer)   │    complete (Provider, Admin) — só após startAt
     │   cancel (Provider,  Admin→Provider)   │    ▼
     ▼                                        ▼   Completed (final)
  CancelledByCustomer / CancelledByProvider (finais)
  * Cliente: antes de startAt e respeitando minCancellationNoticeMinutes (decidido pela API)
```

Função pura `availableActions(appointment, role, now): AppointmentAction[]` em `core/domain/appointment-actions.ts`:

| Ação | Mostrar quando |
|---|---|
| `confirm` | `status = Pending` ∧ role ∈ {Provider, Admin} |
| `cancel` | `status ∈ {Pending, Confirmed}` ∧ `now < startAt` ∧ role ∈ {Customer, Provider, Admin} (Cliente vê o aviso fixo da antecedência, FR-034) |
| `reschedule` | igual a `cancel`, mas só para Customer |
| `complete` | `status = Confirmed` ∧ `now ≥ startAt` ∧ role ∈ {Provider, Admin} |

Para o Admin, o cancelamento exige escolher `onBehalfOf`. Resultado esperado: `Customer` → `CancelledByCustomer`; `Provider` → `CancelledByProvider`. A API decide sempre: recusas de regra são tratadas pelo catálogo de erros mesmo quando a ação estava visível (FR-047).

## 4. Modelos de estado do cliente (só no navegador)

| Modelo | Campos | Onde vive | Regras |
|---|---|---|---|
| **Session** | `accessToken`, `expiresAt: Instant`, `user: CurrentUser` | `SessionStore` (signal) + `sessionStorage['sm.session']` | expirada quando `now ≥ expiresAt`; `warningAt = expiresAt − 5 min` (aviso uma vez por sessão, flag `warned`); limpa em `401`/"Sair"/expiração |
| **BookingAttempt** | `providerId`, `serviceId`, `date`, `startAt`, `notes`, `idempotencyKey`, `rescheduleOf?: { appointmentId, etag }` | `BookingStore` (signal, escopo da rota de reserva); `notes` em `sessionStorage['sm.booking-draft']` | chave regenerada só quando `providerId`/`serviceId`/`startAt`/`notes` mudam; reenvio reutiliza a chave; `200` = sucesso |
| **RescheduleFlow** | `original: Appointment`, `originalEtag`, `reason` (pré-preenchido "Reagendamento solicitado pelo cliente") | parte do `BookingAttempt` | etapas `cancelling → booking → done` ou `cancelRejected` ou `bookingFailedAfterCancel` (FR-035a) |
| **AppointmentDetailState** | `appointment`, `etag`, `status: 'loading' \| 'ready' \| 'error'`, `pendingAction?` | `AppointmentDetailStore` | em `412`/`409 concurrency` → aviso e `reload()` |
| **SetupChecklist** | `hasActiveService`, `hasWorkingHours`, `policyReviewedHint` (só visual) | `ProviderSetupStore` (derivado de 2 GETs) | concluído = `hasActiveService ∧ hasWorkingHours`; reaparece se alguma condição deixar de valer |
| **ListQuery** | `page`, `pageSize`, filtros, `sort` | query params da URL | parse/serialize tipado; valores inválidos voltam ao padrão |
| **RemoteState<T>** | `idle \| loading \| empty \| ready(T) \| error(ApiError)` | todas as telas com dados remotos | garante os 4 estados (FR-004) |
| **ApiError** | `kind: 'problem' \| 'network' \| 'unknown'`, `status`, `problem?: ProblemDetails \| ValidationProblemDetails`, `traceId?` | saída do `errorInterceptor` | mensagem via catálogo por `code`; fallback `detail`; mostra `traceId` em `unknown`/`5xx` |
