import { inject, provideAppInitializer, type EnvironmentProviders } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { AuthApi } from '../api/auth.api';
import { SessionStore } from './session.store';
import { SessionTimerService } from './session-timer.service';

/**
 * Na inicialização (FR-018, research R6): restaura a sessão da aba → valida com
 * `GET /auth/me` → agenda o aviso e a expiração. Se a validação falhar, descarta a sessão.
 */
export function provideSessionInitializer(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const session = inject(SessionStore);
    const authApi = inject(AuthApi);
    const timer = inject(SessionTimerService);

    if (!session.restore()) {
      return Promise.resolve();
    }
    return firstValueFrom(
      authApi.me().pipe(
        map((user) => {
          session.updateUser(user);
          timer.schedule();
        }),
        catchError(() => {
          session.clear();
          return of(undefined);
        }),
      ),
    );
  });
}
