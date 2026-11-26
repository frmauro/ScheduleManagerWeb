import {
  LucideBan,
  LucideCircleCheck,
  LucideCircleCheckBig,
  LucideCircleX,
  LucideHourglass,
  type LucideIcon,
} from '@lucide/angular';
import type {
  AppointmentStatus,
  DayOfWeek,
  NotificationStatus,
  NotificationType,
  Role,
  ScheduleExceptionType,
  ServiceCategory,
} from './enums';

export const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Administrador',
  Provider: 'Prestador',
  Customer: 'Cliente',
};

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  Beauty: 'Beleza',
  Barbershop: 'Barbearia',
  Health: 'Saúde',
  Dental: 'Odontologia',
  Therapy: 'Terapia',
  Fitness: 'Fitness',
  Wellness: 'Bem-estar',
  Education: 'Educação',
  Consulting: 'Consultoria',
  Other: 'Outros',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  Pending: 'Pendente',
  Confirmed: 'Confirmado',
  CancelledByCustomer: 'Cancelado pelo cliente',
  CancelledByProvider: 'Cancelado pelo prestador',
  Completed: 'Concluído',
};

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  Sunday: 'Domingo',
  Monday: 'Segunda-feira',
  Tuesday: 'Terça-feira',
  Wednesday: 'Quarta-feira',
  Thursday: 'Quinta-feira',
  Friday: 'Sexta-feira',
  Saturday: 'Sábado',
};

export const SCHEDULE_EXCEPTION_TYPE_LABELS: Record<ScheduleExceptionType, string> = {
  Closure: 'Fechamento',
  SpecialHours: 'Horário especial',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  AppointmentCreated: 'Agendamento criado',
  AppointmentConfirmed: 'Confirmado',
  AppointmentCancelled: 'Cancelado',
  AppointmentReminder: 'Lembrete',
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  Pending: 'Pendente',
  Sent: 'Enviada',
  Failed: 'Falhou',
  Cancelled: 'Cancelada',
};

export type StatusTone = 'warning' | 'success' | 'danger' | 'neutral' | 'info';

/** Status nunca depende só de cor: ícone + texto + tom (FR-009). */
export const STATUS_VISUALS: Record<AppointmentStatus, { icon: LucideIcon; tone: StatusTone }> = {
  Pending: { icon: LucideHourglass, tone: 'warning' },
  Confirmed: { icon: LucideCircleCheck, tone: 'info' },
  CancelledByCustomer: { icon: LucideCircleX, tone: 'danger' },
  CancelledByProvider: { icon: LucideBan, tone: 'danger' },
  Completed: { icon: LucideCircleCheckBig, tone: 'success' },
};
