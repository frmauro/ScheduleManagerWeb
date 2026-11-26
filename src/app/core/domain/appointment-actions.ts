import type { Appointment } from '../models/api-models';
import type { Role } from '../models/enums';

export type AppointmentAction = 'confirm' | 'cancel' | 'reschedule' | 'complete';

const STAFF: readonly Role[] = ['Provider', 'Admin'];

/**
 * Ações exibidas conforme a máquina de estados (data-model §3, FR-046). A interface esconde o
 * impossível, mas **a API decide**: recusas de regra continuam tratadas pelo catálogo (FR-047).
 * Para o Cliente, a antecedência mínima de cancelamento não é conhecida antes (FR-034).
 */
export function availableActions(
  appointment: Pick<Appointment, 'status' | 'startAt'>,
  role: Role,
  now: number = Date.now(),
): AppointmentAction[] {
  const started = now >= Date.parse(appointment.startAt);
  const open = appointment.status === 'Pending' || appointment.status === 'Confirmed';
  const actions: AppointmentAction[] = [];

  if (appointment.status === 'Pending' && STAFF.includes(role)) {
    actions.push('confirm');
  }
  if (open && !started) {
    actions.push('cancel');
    if (role === 'Customer') {
      actions.push('reschedule');
    }
  }
  if (appointment.status === 'Confirmed' && started && STAFF.includes(role)) {
    actions.push('complete');
  }
  return actions;
}
