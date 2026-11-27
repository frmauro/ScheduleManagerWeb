import { TestBed } from '@angular/core/testing';
import type { WeeklySchedule } from '../../../core/models/api-models';
import { MAX_INTERVALS_PER_DAY, ScheduleEditorComponent } from './schedule-editor.component';

const WEEKDAY: WeeklySchedule = {
  timeZoneId: 'America/Sao_Paulo',
  days: [
    {
      dayOfWeek: 'Monday',
      intervals: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '18:00' },
      ],
    },
  ],
};

async function setup(schedule: WeeklySchedule = WEEKDAY) {
  const fixture = TestBed.createComponent(ScheduleEditorComponent);
  fixture.componentRef.setInput('schedule', schedule);
  const saved: Pick<WeeklySchedule, 'days'>[] = [];
  fixture.componentInstance.save.subscribe((body) => saved.push(body));
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  return { fixture, el, saved, stable };
}

function day(el: HTMLElement, dayOfWeek: string): HTMLElement {
  const node = el.querySelector<HTMLElement>(`[data-testid="day-${dayOfWeek}"]`);
  if (!node) {
    throw new Error(`dia ${dayOfWeek} não encontrado`);
  }
  return node;
}

function setTime(root: HTMLElement, index: number, part: 0 | 1, value: string): void {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[type="time"]');
  const input = inputs[index * 2 + part];
  if (!input) {
    throw new Error(`faixa ${index} não encontrada`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

function submit(el: HTMLElement): void {
  el.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
}

function intervalErrors(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="interval-error"]'));
}

describe('ScheduleEditorComponent (FR-041)', () => {
  it('mostra Domingo → Sábado com as faixas salvas; dia sem faixas aparece fechado', async () => {
    const { el } = await setup();
    const legends = Array.from(el.querySelectorAll('[data-testid^="day-"] > legend')).map((l) =>
      l.textContent?.trim(),
    );
    expect(legends).toEqual([
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ]);
    expect(day(el, 'Monday').querySelectorAll('input[type="time"]')).toHaveLength(4);
    expect(day(el, 'Sunday').textContent).toContain('Fechado');
  });

  it('faixas sobrepostas (09:00–12:00 e 11:00–14:00) marcam o erro nas próprias faixas e nada é enviado', async () => {
    const { el, saved, stable } = await setup();
    const monday = day(el, 'Monday');
    setTime(monday, 1, 0, '11:00');
    setTime(monday, 1, 1, '14:00');
    submit(el);
    await stable();

    expect(saved).toEqual([]);
    const errors = intervalErrors(monday);
    expect(errors).toHaveLength(2);
    expect(errors[0]?.textContent).toContain('não podem se sobrepor');
    const inputs = monday.querySelectorAll<HTMLInputElement>('input[type="time"]');
    expect(inputs[2]?.getAttribute('aria-invalid')).toBe('true');
    expect(inputs[2]?.getAttribute('aria-describedby')).toBe(errors[1]?.id);
    expect(el.textContent).toContain('Revise as faixas destacadas antes de salvar.');
  });

  it('início ≥ fim marca o erro na faixa e nada é enviado', async () => {
    const { el, saved, stable } = await setup();
    const monday = day(el, 'Monday');
    setTime(monday, 0, 0, '12:00');
    setTime(monday, 0, 1, '09:00');
    submit(el);
    await stable();
    expect(saved).toEqual([]);
    expect(intervalErrors(monday)[0]?.textContent).toContain('O início deve ser antes do fim.');
  });

  it(`permite até ${MAX_INTERVALS_PER_DAY} faixas por dia`, async () => {
    const { el, stable } = await setup();
    const sunday = day(el, 'Sunday');
    const add = sunday.querySelector<HTMLButtonElement>('button[aria-label^="Adicionar faixa"]');
    for (let i = 0; i < MAX_INTERVALS_PER_DAY + 2; i++) {
      add?.click();
      await stable();
    }
    expect(sunday.querySelectorAll('input[type="time"]')).toHaveLength(MAX_INTERVALS_PER_DAY * 2);
    expect(add?.disabled).toBe(true);
  });

  it('o corpo leva só days, omitindo dias fechados', async () => {
    const { el, saved, stable } = await setup();
    const monday = day(el, 'Monday');
    monday.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remover faixa"]')[1]?.click();
    await stable();
    const tuesday = day(el, 'Tuesday');
    tuesday.querySelector<HTMLButtonElement>('button[aria-label^="Adicionar faixa"]')?.click();
    await stable();
    setTime(tuesday, 0, 0, '08:00');
    setTime(tuesday, 0, 1, '10:00');
    submit(el);
    await stable();

    expect(saved).toEqual([
      {
        days: [
          { dayOfWeek: 'Monday', intervals: [{ start: '09:00', end: '12:00' }] },
          { dayOfWeek: 'Tuesday', intervals: [{ start: '08:00', end: '10:00' }] },
        ],
      },
    ]);
    expect(Object.keys(saved[0] ?? {})).toEqual(['days']);
  });

  it('erro do servidor em days[i].intervals[j] aparece na faixa correspondente', async () => {
    const { fixture, el, stable } = await setup();
    submit(el);
    await stable();
    fixture.componentInstance.showServerErrors({ 'days[0].intervals[1].end': ['Faixa inválida.'] });
    await stable();
    expect(intervalErrors(day(el, 'Monday'))[0]?.textContent).toContain('Faixa inválida.');
  });
});
