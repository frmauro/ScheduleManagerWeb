import { Dialog, type DialogConfig, type DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog.component';

/**
 * Diálogos sobre o `@angular/cdk/dialog` (research R2): foco preso, `Esc` fecha, foco devolvido
 * ao elemento de origem e `aria-modal` (FR-011).
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  open<R, D, C>(
    component: ComponentType<C>,
    config: DialogConfig<D, DialogRef<R, C>> = {},
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      backdropClass: 'sm-dialog-backdrop',
      panelClass: 'sm-dialog-panel',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      role: 'dialog',
      ...config,
    });
  }

  /** Emite `true` se o usuário confirmar; `false` ao cancelar ou fechar. */
  confirm(data: ConfirmDialogData): Observable<boolean> {
    const ref = this.open<boolean, ConfirmDialogData, ConfirmDialogComponent>(
      ConfirmDialogComponent,
      {
        data,
        role: data.tone === 'danger' ? 'alertdialog' : 'dialog',
        ariaLabelledBy: 'sm-confirm-dialog-title',
      },
    );
    return ref.closed.pipe(map((result) => result === true));
  }
}
