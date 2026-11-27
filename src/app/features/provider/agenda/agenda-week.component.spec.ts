import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AppointmentSummary } from '../../../core/models/api-models';
import type { AppointmentStatus } from '../../../core/models/enums';
import { placeAppointments } from './agenda-grid.component';
import { AgendaWeekComponent } from './agenda-week.component';

function summary(id: string, startAt: string, status: AppointmentStatus): AppointmentSummary {
  return {
    id,
    providerId: 'p1',
    providerName: 'Barbearia',
    customerId: 'c1',
    customerName: `Cliente ${id}`,
    serviceName: 'Corte',
    startAt,
    endAt: startAt,
    status,
  };
}

const SAO_PAULO = 'America/Sao_Paulo';
// Semana de domingo 29/11/2026 a sábado 05/12/2026.
const WEEK_DATE = '2026-12-02';

function render(appointments: AppointmentSummary[], timeZoneId = SAO_PAULO) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AgendaWeekComponent);
  fixture.componentRef.setInput('appointments', appointments);
  fixture.componentRef.setInput('date', WEEK_DATE);
  fixture.componentRef.setInput('timeZoneId', timeZoneId);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function cellText(root: HTMLElement, key: string): string {
  return root.querySelector(`[data-cell="${key}"]`)?.textContent ?? '';
}

describe('AgendaWeekComponent (FR-044)', () => {
  it('mostra domingo a sábado da semana da data', () => {
    const root = render([]);
    const headers = Array.from(root.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headers).toEqual([
      'Horário',
      'Domingo 29/11',
      'Segunda-feira 30/11',
      'Terça-feira 01/12',
      'Quarta-feira 02/12',
      'Quinta-feira 03/12',
      'Sexta-feira 04/12',
      'Sábado 05/12',
    ]);
  });

  it('posiciona pelo horário no fuso do prestador', () => {
    // 12:00 UTC = 09:00 em São Paulo, 08:00 em Manaus.
    const root = render([summary('a', '2026-12-01T12:00:00Z', 'Confirmed')]);
    expect(cellText(root, '2026-12-01|09')).toContain('09:00');
    expect(cellText(root, '2026-12-01|09')).toContain('Cliente a');
    expect(cellText(root, '2026-12-01|12')).toBe('');
  });

  it('perto da meia-noite fica no dia local, não no dia UTC', () => {
    // 02:30 UTC de 03/12 = 23:30 de 02/12 em São Paulo.
    const root = render([summary('n', '2026-12-03T02:30:00Z', 'Confirmed')]);
    expect(cellText(root, '2026-12-02|23')).toContain('23:30');
    expect(
      root.querySelector('[data-cell^="2026-12-03"] [data-testid="agenda-appointment"]'),
    ).toBeNull();
  });

  it('o mesmo instante muda de célula em outro fuso', () => {
    const grid = placeAppointments(
      [summary('a', '2026-12-01T12:00:00Z', 'Confirmed')],
      ['2026-12-01'],
      'America/Manaus',
    );
    expect(grid.cells.get('2026-12-01|08')?.[0]?.time).toBe('08:00');
  });

  it('estende a grade para cobrir horários fora de 08–18', () => {
    const grid = placeAppointments(
      [summary('cedo', '2026-12-01T09:30:00Z', 'Confirmed')],
      ['2026-12-01'],
      SAO_PAULO,
    );
    expect(grid.hours[0]).toBe(6);
    expect(grid.hours.at(-1)).toBe(18);
  });

  it('Pendente é destacado com ícone e o texto "Pendente", não só cor', () => {
    const root = render([
      summary('p', '2026-12-01T13:00:00Z', 'Pending'),
      summary('c', '2026-12-01T14:00:00Z', 'Confirmed'),
    ]);
    const pending = root.querySelector<HTMLElement>('[data-status="Pending"][data-testid]');
    const confirmed = root.querySelector<HTMLElement>('[data-status="Confirmed"][data-testid]');
    expect(pending?.textContent).toContain('Pendente');
    expect(pending?.querySelector('svg')).not.toBeNull();
    expect(pending?.classList).toContain('border-l-4');
    expect(confirmed?.textContent).toContain('Confirmado');
    expect(confirmed?.classList).not.toContain('border-l-4');
  });

  it('cada agendamento é um link para o detalhe', () => {
    const root = render([summary('a1', '2026-12-01T12:00:00Z', 'Pending')]);
    expect(root.querySelector('a[data-testid="agenda-appointment"]')?.getAttribute('href')).toBe(
      '/prestador/agendamentos/a1',
    );
  });
});
