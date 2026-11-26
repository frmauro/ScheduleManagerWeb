import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { COMMON_MESSAGES } from './core/i18n/common.messages';
import { AppHeaderComponent } from './features/shell/app-header.component';
import { SessionWarningComponent } from './features/shell/session-warning.component';
import { ToastOutletComponent } from './shared/ui/toast-outlet.component';

/** Shell: link de salto, cabeçalho por perfil, conteúdo, toasts e aviso de sessão. */
@Component({
  selector: 'sm-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, SessionWarningComponent, ToastOutletComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly skipLabel = COMMON_MESSAGES.skipToContent;
}
