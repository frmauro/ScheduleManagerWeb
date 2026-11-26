import type { components } from '../api/schema.gen';

type Schemas = components['schemas'];

export type Role = Schemas['Role'];
export type ServiceCategory = Schemas['ServiceCategory'];
export type AppointmentStatus = Schemas['AppointmentStatus'];
export type DayOfWeek = Schemas['DayOfWeek'];
export type ScheduleExceptionType = Schemas['ScheduleExceptionType'];
export type NotificationType = Schemas['NotificationType'];
export type NotificationStatus = Schemas['NotificationStatus'];

/**
 * Garante em tempo de compilação que a lista contém **exatamente** os valores do enum do
 * contrato (nem a mais, nem a menos). Se o OpenAPI mudar, o build quebra (research R5).
 */
function enumValues<U extends string>() {
  return <const T extends readonly U[]>(
    values: T & ([U] extends [T[number]] ? unknown : { missing: Exclude<U, T[number]> }),
  ): T => values;
}

export const ROLE_VALUES = enumValues<Role>()(['Admin', 'Provider', 'Customer']);

export const SERVICE_CATEGORY_VALUES = enumValues<ServiceCategory>()([
  'Beauty',
  'Barbershop',
  'Health',
  'Dental',
  'Therapy',
  'Fitness',
  'Wellness',
  'Education',
  'Consulting',
  'Other',
]);

export const APPOINTMENT_STATUS_VALUES = enumValues<AppointmentStatus>()([
  'Pending',
  'Confirmed',
  'CancelledByCustomer',
  'CancelledByProvider',
  'Completed',
]);

/** Ordem do editor de expediente: Domingo → Sábado. */
export const DAY_OF_WEEK_VALUES = enumValues<DayOfWeek>()([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

export const SCHEDULE_EXCEPTION_TYPE_VALUES = enumValues<ScheduleExceptionType>()([
  'Closure',
  'SpecialHours',
]);

export const NOTIFICATION_TYPE_VALUES = enumValues<NotificationType>()([
  'AppointmentCreated',
  'AppointmentConfirmed',
  'AppointmentCancelled',
  'AppointmentReminder',
]);

export const NOTIFICATION_STATUS_VALUES = enumValues<NotificationStatus>()([
  'Pending',
  'Sent',
  'Failed',
  'Cancelled',
]);

/** Type guard para valores de enum vindos de fontes não tipadas (URL, storage). */
export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
