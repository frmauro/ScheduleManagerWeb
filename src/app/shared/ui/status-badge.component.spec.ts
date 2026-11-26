import { TestBed } from '@angular/core/testing';
import { APPOINTMENT_STATUS_VALUES } from '../../core/models/enums';
import { APPOINTMENT_STATUS_LABELS } from '../../core/models/labels';
import { StatusBadgeComponent } from './status-badge.component';

describe('sm-status-badge (FR-009)', () => {
  it.each(APPOINTMENT_STATUS_VALUES)('status %s tem texto pt-BR e ícone', (status) => {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe(APPOINTMENT_STATUS_LABELS[status]);
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('Pendente usa o tom de alerta e Cancelados usam tons distintos de Confirmado', () => {
    const tone = (status: (typeof APPOINTMENT_STATUS_VALUES)[number]) => {
      const fixture = TestBed.createComponent(StatusBadgeComponent);
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('span')?.className ?? '';
    };
    expect(tone('Pending')).toContain('tone-warning');
    expect(tone('Confirmed')).not.toBe(tone('CancelledByCustomer'));
  });
});
