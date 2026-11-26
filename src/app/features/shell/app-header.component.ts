import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideDynamicIcon, LucideLogOut, LucideMenu, LucideX } from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { SessionTimerService } from '../../core/auth/session-timer.service';
import { APP_PATHS } from '../../core/config/app-paths';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';
import type { Role } from '../../core/models/enums';

interface NavLink {
  readonly label: string;
  readonly path: string;
}

const NAV = COMMON_MESSAGES.nav;

/** Links do cabeçalho por perfil: só os do perfil atual (contracts/routes.md, FR-020). */
const LINKS_BY_ROLE: Record<Role | 'Guest', readonly NavLink[]> = {
  Guest: [
    { label: NAV.search, path: APP_PATHS.home },
    { label: NAV.login, path: APP_PATHS.login },
    { label: NAV.register, path: APP_PATHS.registerCustomer },
    { label: NAV.iAmProvider, path: APP_PATHS.registerProvider },
  ],
  Customer: [
    { label: NAV.search, path: APP_PATHS.home },
    { label: NAV.myAppointments, path: APP_PATHS.customer.appointments },
    { label: NAV.notifications, path: APP_PATHS.customer.notifications },
    { label: NAV.profile, path: APP_PATHS.customer.profile },
  ],
  Provider: [
    { label: NAV.agenda, path: APP_PATHS.providerArea.agenda },
    { label: NAV.services, path: APP_PATHS.providerArea.services },
    { label: NAV.schedule, path: APP_PATHS.providerArea.schedule },
    { label: NAV.exceptions, path: APP_PATHS.providerArea.exceptions },
    { label: NAV.policy, path: APP_PATHS.providerArea.policy },
    { label: NAV.establishment, path: APP_PATHS.providerArea.establishment },
    { label: NAV.notifications, path: APP_PATHS.providerArea.notifications },
  ],
  Admin: [
    { label: NAV.users, path: APP_PATHS.admin.users },
    { label: NAV.notifications, path: APP_PATHS.admin.notifications },
    { label: NAV.appointments, path: APP_PATHS.admin.appointments },
    { label: NAV.myNotifications, path: APP_PATHS.admin.myNotifications },
  ],
};

@Component({
  selector: 'sm-app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <a [routerLink]="homePath" class="text-lg font-bold text-brand">{{ appName }}</a>

        <button
          type="button"
          class="sm-btn sm-btn--ghost md:hidden"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="sm-main-nav"
          (click)="menuOpen.set(!menuOpen())"
        >
          <svg
            [lucideIcon]="menuOpen() ? closeIcon : menuIcon"
            [size]="20"
            aria-hidden="true"
          ></svg>
          <span class="sr-only">{{ menuOpen() ? nav.closeMenu : nav.openMenu }}</span>
        </button>

        <nav
          id="sm-main-nav"
          class="w-full md:flex md:w-auto md:items-center md:gap-1"
          [class.hidden]="!menuOpen()"
          [attr.aria-label]="nav.mainLabel"
        >
          <ul class="flex flex-col gap-1 md:flex-row md:items-center">
            @for (link of links(); track link.path) {
              <li>
                <a
                  class="block rounded-md px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                  [routerLink]="link.path"
                  routerLinkActive="bg-brand-light text-brand-dark"
                  [routerLinkActiveOptions]="{ exact: link.path === homePath }"
                  ariaCurrentWhenActive="page"
                  (click)="menuOpen.set(false)"
                >
                  {{ link.label }}
                </a>
              </li>
            }
            @if (user(); as u) {
              <li
                class="flex items-center gap-2 border-t border-gray-200 pt-2 md:ml-2 md:border-l md:border-t-0 md:pl-3 md:pt-0"
              >
                <span class="text-sm text-gray-700">{{ u.name }}</span>
                <button type="button" class="sm-btn sm-btn--ghost" (click)="logout()">
                  <svg [lucideIcon]="logoutIcon" [size]="16" aria-hidden="true"></svg>
                  {{ logoutLabel }}
                </button>
              </li>
            }
          </ul>
        </nav>
      </div>
    </header>
  `,
})
export class AppHeaderComponent {
  private readonly session = inject(SessionStore);
  private readonly timer = inject(SessionTimerService);
  private readonly router = inject(Router);

  protected readonly appName = COMMON_MESSAGES.appName;
  protected readonly nav = NAV;
  protected readonly logoutLabel = COMMON_MESSAGES.actions.logout;
  protected readonly homePath = APP_PATHS.home;
  protected readonly menuIcon = LucideMenu;
  protected readonly closeIcon = LucideX;
  protected readonly logoutIcon = LucideLogOut;
  protected readonly menuOpen = signal(false);

  protected readonly user = this.session.user;
  protected readonly links = computed(() => LINKS_BY_ROLE[this.session.role() ?? 'Guest']);

  /** "Sair" descarta a sessão localmente e volta à vitrine (FR-019). */
  protected logout(): void {
    this.timer.cancel();
    this.session.clear();
    this.menuOpen.set(false);
    void this.router.navigateByUrl(APP_PATHS.home);
  }
}
