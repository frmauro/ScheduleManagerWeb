import { computed, inject, Injectable, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { ScheduleApi } from '../../../core/api/schedule.api';
import { ServicesApi } from '../../../core/api/services.api';
import {
  isSetupComplete,
  loadSetupChecklist,
  type SetupChecklist,
} from '../../../core/domain/provider-setup';
import { LOADING, toRemoteState, type RemoteState } from '../../../shared/state/remote-state';

/**
 * Estado do checklist de primeiros passos (FR-037). Sempre recalculado a partir da API, então
 * reaparece se o prestador desativar todos os serviços ou apagar o expediente.
 */
@Injectable({ providedIn: 'root' })
export class ProviderSetupStore {
  private readonly services = inject(ServicesApi);
  private readonly schedule = inject(ScheduleApi);
  private request: Subscription | null = null;

  private readonly stateSignal = signal<RemoteState<SetupChecklist>>(LOADING);
  private readonly policyReviewed = signal(false);

  readonly state = this.stateSignal.asReadonly();
  /** Só visual: o prestador abriu a política nesta sessão (não bloqueia). */
  readonly policyReviewedHint = this.policyReviewed.asReadonly();

  readonly checklist = computed(() => {
    const s = this.stateSignal();
    return s.status === 'ready' ? s.value : null;
  });
  readonly complete = computed(() => {
    const c = this.checklist();
    return c !== null && isSetupComplete(c);
  });
  /** Etapas obrigatórias concluídas (de 2). */
  readonly doneCount = computed(() => {
    const c = this.checklist();
    return c ? Number(c.hasActiveService) + Number(c.hasWorkingHours) : 0;
  });

  load(): void {
    this.request?.unsubscribe();
    this.request = toRemoteState(
      loadSetupChecklist(this.services, this.schedule),
      () => false,
    ).subscribe((state) => this.stateSignal.set(state));
  }

  markPolicyReviewed(): void {
    this.policyReviewed.set(true);
  }
}
