import type { AppointmentStatus, Role } from '../models/enums';
import { availableActions } from './appointment-actions';

const NOW = new Date('2026-12-01T12:00:00Z').getTime();
const FUTURE = '2026-12-01T15:00:00Z';
const PAST = '2026-12-01T11:00:00Z';

function actions(status: AppointmentStatus, role: Role, startAt = FUTURE) {
  return availableActions({ status, startAt }, role, NOW);
}

describe('availableActions (data-model §3, FR-046)', () => {
  it('confirm: Pending ∧ Provider/Admin', () => {
    expect(actions('Pending', 'Provider')).toContain('confirm');
    expect(actions('Pending', 'Admin')).toContain('confirm');
    expect(actions('Pending', 'Customer')).not.toContain('confirm');
    expect(actions('Confirmed', 'Provider')).not.toContain('confirm');
  });

  it('cancel: Pending/Confirmed ∧ antes do início ∧ qualquer perfil', () => {
    for (const role of ['Customer', 'Provider', 'Admin'] as const) {
      expect(actions('Pending', role)).toContain('cancel');
      expect(actions('Confirmed', role)).toContain('cancel');
      expect(actions('Confirmed', role, PAST)).not.toContain('cancel');
    }
  });

  it('reschedule: igual a cancel, só para Customer', () => {
    expect(actions('Confirmed', 'Customer')).toContain('reschedule');
    expect(actions('Confirmed', 'Provider')).not.toContain('reschedule');
    expect(actions('Confirmed', 'Admin')).not.toContain('reschedule');
    expect(actions('Confirmed', 'Customer', PAST)).not.toContain('reschedule');
  });

  it('complete: Confirmed ∧ now ≥ startAt ∧ Provider/Admin', () => {
    expect(actions('Confirmed', 'Provider', PAST)).toContain('complete');
    expect(actions('Confirmed', 'Admin', PAST)).toContain('complete');
    expect(actions('Confirmed', 'Provider', FUTURE)).not.toContain('complete');
    expect(actions('Confirmed', 'Customer', PAST)).not.toContain('complete');
    expect(actions('Pending', 'Provider', PAST)).not.toContain('complete');
  });

  it('exatamente no início: pode concluir e não pode cancelar', () => {
    const atStart = new Date(NOW).toISOString();
    expect(actions('Confirmed', 'Provider', atStart)).toEqual(['complete']);
  });

  it('estados finais não têm ações', () => {
    for (const status of ['CancelledByCustomer', 'CancelledByProvider', 'Completed'] as const) {
      for (const role of ['Customer', 'Provider', 'Admin'] as const) {
        expect(actions(status, role)).toEqual([]);
        expect(actions(status, role, PAST)).toEqual([]);
      }
    }
  });
});
