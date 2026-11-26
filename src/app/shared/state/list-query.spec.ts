import { convertToParamMap } from '@angular/router';
import { PAGE_FIELDS, parseListQuery, serializeListQuery, type QueryShape } from './list-query';

const SHAPE = {
  ...PAGE_FIELDS,
  q: { kind: 'string' },
  categoria: { kind: 'enum', values: ['Beauty', 'Barbershop'] },
  ordem: { kind: 'enum', values: ['nome', '-nome'], default: 'nome' },
  status: { kind: 'enumArray', values: ['Pending', 'Confirmed', 'Completed'] },
  data: { kind: 'date' },
} as const satisfies QueryShape;

describe('parseListQuery', () => {
  it('usa os padrões quando a URL está vazia', () => {
    const query = parseListQuery(convertToParamMap({}), SHAPE);
    expect(query).toEqual({
      pagina: 1,
      itens: 20,
      q: undefined,
      categoria: undefined,
      ordem: 'nome',
      status: [],
      data: undefined,
    });
  });

  it('lê valores válidos e tipados', () => {
    const query = parseListQuery(
      convertToParamMap({
        pagina: '3',
        itens: '50',
        q: ' barba ',
        categoria: 'Barbershop',
        ordem: '-nome',
        status: ['Pending', 'Confirmed'],
        data: '2026-12-01',
      }),
      SHAPE,
    );
    expect(query.pagina).toBe(3);
    expect(query.itens).toBe(50);
    expect(query.q).toBe('barba');
    expect(query.categoria).toBe('Barbershop');
    expect(query.ordem).toBe('-nome');
    expect(query.status).toEqual(['Pending', 'Confirmed']);
    expect(query.data).toBe('2026-12-01');
  });

  it('valores inválidos voltam ao padrão (itens 1–100, pagina ≥ 1)', () => {
    const query = parseListQuery(
      convertToParamMap({
        pagina: '0',
        itens: '500',
        categoria: 'Xyz',
        ordem: 'qualquer',
        status: ['Pending', 'Nada'],
        data: '01/12/2026',
      }),
      SHAPE,
    );
    expect(query.pagina).toBe(1);
    expect(query.itens).toBe(20);
    expect(query.categoria).toBeUndefined();
    expect(query.ordem).toBe('nome');
    expect(query.status).toEqual(['Pending']);
    expect(query.data).toBeUndefined();
  });

  it('rejeita números não inteiros', () => {
    expect(parseListQuery(convertToParamMap({ pagina: '2.5', itens: 'abc' }), SHAPE)).toMatchObject(
      {
        pagina: 1,
        itens: 20,
      },
    );
  });
});

describe('serializeListQuery', () => {
  it('omite padrões e vazios (null remove a chave ao mesclar com a URL)', () => {
    const params = serializeListQuery(
      {
        pagina: 1,
        itens: 20,
        q: '',
        categoria: undefined,
        ordem: 'nome',
        status: [],
        data: undefined,
      },
      SHAPE,
    );
    expect(params).toEqual({
      pagina: null,
      itens: null,
      q: null,
      categoria: null,
      ordem: null,
      status: null,
      data: null,
    });
  });

  it('mantém valores fora do padrão; arrays repetidos', () => {
    const params = serializeListQuery(
      {
        pagina: 2,
        itens: 50,
        q: 'x',
        categoria: 'Beauty',
        ordem: '-nome',
        status: ['Pending', 'Completed'],
        data: '2026-12-01',
      },
      SHAPE,
    );
    expect(params).toEqual({
      pagina: '2',
      itens: '50',
      q: 'x',
      categoria: 'Beauty',
      ordem: '-nome',
      status: ['Pending', 'Completed'],
      data: '2026-12-01',
    });
  });
});
