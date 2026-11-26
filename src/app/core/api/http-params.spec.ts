import { toHttpParams } from './http-params';

describe('toHttpParams', () => {
  it('repete parâmetros de arrays (status=Pending&status=Confirmed)', () => {
    const params = toHttpParams({ status: ['Pending', 'Confirmed'] });
    expect(params.getAll('status')).toEqual(['Pending', 'Confirmed']);
    expect(params.toString()).toBe('status=Pending&status=Confirmed');
  });

  it('omite undefined, string vazia e arrays vazios', () => {
    const params = toHttpParams({ q: '', city: undefined, status: [], page: 1 });
    expect(params.keys()).toEqual(['page']);
  });

  it('serializa booleanos como true/false', () => {
    expect(toHttpParams({ isActive: true }).get('isActive')).toBe('true');
    expect(toHttpParams({ isActive: false }).get('isActive')).toBe('false');
  });

  it('serializa números como texto, inclusive zero', () => {
    const params = toHttpParams({ page: 2, pageSize: 0 });
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('0');
  });

  it('preserva o offset de instantes (o + é codificado na URL)', () => {
    const params = toHttpParams({
      from: '2026-12-01T00:00:00-03:00',
      to: '2026-12-02T00:00:00+05:30',
    });
    expect(params.get('to')).toBe('2026-12-02T00:00:00+05:30');
    expect(params.toString()).toContain('to=2026-12-02T00:00:00%2B05:30');
  });
});
