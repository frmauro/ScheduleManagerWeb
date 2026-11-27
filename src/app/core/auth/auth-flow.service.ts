import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthResponse } from '../models/api-models';
import { resolvePostLoginUrl } from './return-url';
import { SessionStore } from './session.store';
import { SessionTimerService } from './session-timer.service';

/**
 * Conclusão comum de login e cadastros (FR-016): guarda a sessão, agenda o aviso e a expiração
 * e leva ao `returnUrl` válido para o perfil, ou à home do perfil.
 */
@Injectable({ providedIn: 'root' })
export class AuthFlowService {
  private readonly session = inject(SessionStore);
  private readonly timer = inject(SessionTimerService);
  private readonly router = inject(Router);

  complete(auth: AuthResponse, returnUrl: string | null | undefined): Promise<boolean> {
    this.session.start(auth);
    this.timer.schedule();
    return this.router.navigateByUrl(resolvePostLoginUrl(returnUrl, auth.user.role));
  }
}
