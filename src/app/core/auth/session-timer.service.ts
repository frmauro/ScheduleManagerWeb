import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { navigateToLoginExpired } from './session-expiry';
import { SessionStore } from './session.store';

/**
 * Temporizadores da sessão (research R6):
 * - em `expiresAt − 5 min`: aviso não bloqueante, uma vez por sessão (FR-017a);
 * - em `expiresAt`: descarta a sessão e leva ao login com `returnUrl` (FR-017).
 * O aviso **não** renova a sessão (a API não oferece renovação).
 */
@Injectable({ providedIn: 'root' })
export class SessionTimerService {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly warning = signal(false);
  private warningHandle: ReturnType<typeof setTimeout> | null = null;
  private expiryHandle: ReturnType<typeof setTimeout> | null = null;

  readonly warningVisible = this.warning.asReadonly();

  /** (Re)agenda os temporizadores a partir da sessão atual. */
  schedule(): void {
    this.cancel();
    const expiresAt = this.session.expiresAtMs();
    const warningAt = this.session.warningAt();
    if (expiresAt === null || warningAt === null) {
      return;
    }
    const now = Date.now();
    if (!this.session.warned()) {
      this.warningHandle = setTimeout(() => this.showWarning(), Math.max(0, warningAt - now));
    }
    const expectedExpiry = expiresAt;
    this.expiryHandle = setTimeout(() => this.expire(expectedExpiry), Math.max(0, expiresAt - now));
  }

  cancel(): void {
    if (this.warningHandle !== null) {
      clearTimeout(this.warningHandle);
      this.warningHandle = null;
    }
    if (this.expiryHandle !== null) {
      clearTimeout(this.expiryHandle);
      this.expiryHandle = null;
    }
    this.warning.set(false);
  }

  dismissWarning(): void {
    this.warning.set(false);
  }

  private showWarning(): void {
    this.warningHandle = null;
    if (!this.session.isAuthenticated() || this.session.warned()) {
      return;
    }
    this.session.markWarned();
    this.warning.set(true);
  }

  private expire(expectedExpiry: number): void {
    this.expiryHandle = null;
    this.warning.set(false);
    // Já limpa (401, "Sair") ou substituída por um novo login: nada a fazer.
    if (this.session.expiresAtMs() !== expectedExpiry) {
      return;
    }
    this.session.clear();
    void navigateToLoginExpired(this.router);
  }
}
