import { of, throwError, toArray, firstValueFrom } from 'rxjs';
import { ApiError } from '../../core/errors/api-error';
import { toRemoteState } from './remote-state';

describe('toRemoteState', () => {
  it('loading → ready', async () => {
    const states = await firstValueFrom(toRemoteState(of({ items: [1], page: 1 })).pipe(toArray()));
    expect(states.map((s) => s.status)).toEqual(['loading', 'ready']);
  });

  it('loading → empty para página sem itens', async () => {
    const states = await firstValueFrom(toRemoteState(of({ items: [] })).pipe(toArray()));
    expect(states.map((s) => s.status)).toEqual(['loading', 'empty']);
  });

  it('loading → error com ApiError', async () => {
    const error = new ApiError({ kind: 'network', status: 0 });
    const states = await firstValueFrom(toRemoteState(throwError(() => error)).pipe(toArray()));
    expect(states[1]).toEqual({ status: 'error', error });
  });

  it('critério de vazio customizável', async () => {
    const states = await firstValueFrom(
      toRemoteState(of({ slots: [] }), (v) => v.slots.length === 0).pipe(toArray()),
    );
    expect(states[1]?.status).toBe('empty');
  });
});
