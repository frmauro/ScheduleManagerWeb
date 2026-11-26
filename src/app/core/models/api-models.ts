/**
 * Modelos da API: **apenas aliases** dos tipos gerados do contrato (research R5, data-model §2).
 * Nenhum campo é definido aqui; se o contrato mudar, `npm run api:types` atualiza tudo.
 */
import type { components } from '../api/schema.gen';

type Schemas = components['schemas'];

/** UUID em texto. */
export type Uuid = string;
/** Instante ISO 8601 **com offset** (ex.: `2026-12-01T09:00:00-03:00`). */
export type Instant = string;
/** Data pura `yyyy-MM-dd`. */
export type LocalDate = string;
/** Hora local `HH:mm` (24h). */
export type LocalTime = Schemas['LocalTime'];

// Comuns
export type Address = Schemas['Address'];
export type Phone = Schemas['Phone'];
export type PageMeta = Schemas['PageMeta'];
export type Page<T> = PageMeta & { items: T[] };
export interface PageQuery {
  page?: number;
  pageSize?: number;
}
export type ProblemDetails = Schemas['ProblemDetails'];
export type ValidationProblemDetails = Schemas['ValidationProblemDetails'];
export type ActiveStatusRequest = Schemas['ActiveStatusRequest'];

// Autenticação
export type LoginRequest = Schemas['LoginRequest'];
export type RegisterCustomerRequest = Schemas['RegisterCustomerRequest'];
export type RegisterProviderRequest = Schemas['RegisterProviderRequest'];
export type AuthResponse = Schemas['AuthResponse'];
export type CurrentUser = Schemas['CurrentUser'];

// Cliente
export type CustomerProfile = Schemas['CustomerProfile'];
export type UpdateCustomerRequest = Schemas['UpdateCustomerRequest'];

// Prestador
export type ProviderSummary = Schemas['ProviderSummary'];
export type ProviderPublicProfile = Schemas['ProviderPublicProfile'];
export type ProviderProfile = Schemas['ProviderProfile'];
export type UpdateProviderRequest = Schemas['UpdateProviderRequest'];
export type BookingPolicy = Schemas['BookingPolicy'];

// Serviços
export type Service = Schemas['Service'];
export type ServiceRequest = Schemas['ServiceRequest'];

// Agenda
export type TimeInterval = Schemas['TimeInterval'];
export type WeeklySchedule = Schemas['WeeklySchedule'];
export type WeeklyScheduleDay = WeeklySchedule['days'][number];
export type ScheduleExceptionRequest = Schemas['ScheduleExceptionRequest'];
export type ScheduleException = Schemas['ScheduleException'];
export type ScheduleChangeResult = Schemas['ScheduleChangeResult'];
export type ScheduleExceptionCreated = Schemas['ScheduleExceptionCreated'];

// Disponibilidade
export type AvailabilityResponse = Schemas['AvailabilityResponse'];
/** `startAt` é **opaco**: repassado sem alteração à reserva (FR-026). */
export type TimeSlot = Schemas['TimeSlot'];

// Agendamentos
export type CreateAppointmentRequest = Schemas['CreateAppointmentRequest'];
export type CancelAppointmentRequest = Schemas['CancelAppointmentRequest'];
/** Cancelamento por Cliente/Prestador: `onBehalfOf` não é enviado. */
export type CancelRequest = Omit<CancelAppointmentRequest, 'onBehalfOf'>;
/** Cancelamento pelo Admin: `onBehalfOf` obrigatório. */
export type AdminCancelRequest = CancelRequest & {
  onBehalfOf: NonNullable<CancelAppointmentRequest['onBehalfOf']>;
};
export type AppointmentSummary = Schemas['AppointmentSummary'];
export type Appointment = Schemas['Appointment'];
export type StatusChange = Schemas['StatusChange'];

// Notificações e Admin
export type Notification = Schemas['Notification'];
export type UserSummary = Schemas['UserSummary'];

/** Resposta com o ETag correspondente (concorrência otimista, R9). */
export interface Versioned<T> {
  value: T;
  etag: string;
}
