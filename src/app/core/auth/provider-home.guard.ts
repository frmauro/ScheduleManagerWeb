import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ScheduleApi } from '../api/schedule.api';
import { ServicesApi } from '../api/services.api';
import { APP_PATHS } from '../config/app-paths';
import { isSetupComplete, loadSetupChecklist } from '../domain/provider-setup';

/**
 * `/prestador` (FR-037): checklist incompleto → `/prestador/primeiros-passos`; senão →
 * `/prestador/agenda`. Se a consulta falhar, o checklist mostra o erro e a opção de repetir.
 */
export const providerHomeGuard: CanActivateFn = () => {
  const router = inject(Router);
  return loadSetupChecklist(inject(ServicesApi), inject(ScheduleApi)).pipe(
    map((checklist) =>
      router.parseUrl(
        isSetupComplete(checklist) ? APP_PATHS.providerArea.agenda : APP_PATHS.providerArea.setup,
      ),
    ),
    catchError(() => of(router.parseUrl(APP_PATHS.providerArea.setup))),
  );
};
