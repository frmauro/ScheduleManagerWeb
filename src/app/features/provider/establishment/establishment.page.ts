import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ProvidersApi } from '../../../core/api/providers.api';
import { SessionStore } from '../../../core/auth/session.store';
import { APP_PATHS } from '../../../core/config/app-paths';
import { DEFAULT_TIME_ZONE } from '../../../core/config/app.constants';
import { TIME_ZONE_OPTIONS } from '../../../core/config/time-zones';
import { handleFormError } from '../../../core/errors/form-errors';
import { ToastService } from '../../../core/feedback/toast.service';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { ProviderProfile, UpdateProviderRequest } from '../../../core/models/api-models';
import { SERVICE_CATEGORY_VALUES, type ServiceCategory } from '../../../core/models/enums';
import { SERVICE_CATEGORY_LABELS } from '../../../core/models/labels';
import {
  AddressFormComponent,
  createAddressForm,
  toAddress,
} from '../../../shared/forms/address-form.component';
import { PhoneBrDirective } from '../../../shared/forms/phone-br.directive';
import { PATTERN_MESSAGES } from '../../../shared/forms/validation-messages';
import { SmValidators } from '../../../shared/forms/validators';
import { LOADING, failed, ready, type RemoteState } from '../../../shared/state/remote-state';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../../shared/ui/form-error-summary.component';
import {
  RemoteReadyDirective,
  RemoteViewComponent,
} from '../../../shared/ui/remote-view.component';
import { enumOptions } from '../../../shared/ui/select-options';

/**
 * Meu estabelecimento (`/prestador/estabelecimento`, FR-038): dados públicos, contato
 * (e-mail obrigatório aqui), endereço e fuso, com link para a página pública.
 */
@Component({
  selector: 'sm-establishment-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AddressFormComponent,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
    PhoneBrDirective,
    RemoteReadyDirective,
    RemoteViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-2xl px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1>{{ text.title }}</h1>
        @if (publicPath(); as path) {
          <a class="sm-link" [routerLink]="path">{{ text.publicPage }}</a>
        }
      </div>

      <div class="mt-4">
        <sm-remote-view [state]="state()" [skeletonRows]="5" (retry)="load()">
          <ng-template [smRemoteReady]="state()" let-profile>
            @if (!profile.isActive) {
              <p class="mb-4 rounded-md bg-tone-warning-bg p-3 text-tone-warning-fg" role="status">
                {{ text.inactive }}
              </p>
            }
            <form
              class="sm-card flex flex-col gap-4"
              [formGroup]="form"
              novalidate
              (ngSubmit)="save()"
            >
              <sm-form-error-summary [messages]="summary()" />
              <sm-field [label]="text.displayName">
                <input smFieldControl class="sm-input" formControlName="displayName" />
              </sm-field>
              <sm-field [label]="text.description" [optional]="true">
                <textarea
                  smFieldControl
                  class="sm-textarea"
                  rows="4"
                  formControlName="description"
                ></textarea>
              </sm-field>
              <sm-field [label]="text.category">
                <select smFieldControl class="sm-select" formControlName="category">
                  <option value="" disabled>{{ text.chooseCategory }}</option>
                  @for (option of categoryOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </sm-field>
              <sm-field [label]="text.contactEmail">
                <input
                  smFieldControl
                  class="sm-input"
                  type="email"
                  formControlName="contactEmail"
                />
              </sm-field>
              <sm-field [label]="text.contactPhone" [patternMessage]="patterns.phone">
                <input smFieldControl smPhoneBr class="sm-input" formControlName="contactPhone" />
              </sm-field>
              <sm-field [label]="text.timeZone" [hint]="text.timeZoneHint">
                <select smFieldControl class="sm-select" formControlName="timeZoneId">
                  @for (zone of timeZones; track zone.id) {
                    <option [value]="zone.id">{{ zone.label }}</option>
                  }
                </select>
              </sm-field>
              <h2 class="text-base font-semibold">{{ text.address }}</h2>
              <sm-address-form [group]="form.controls.address" />
              <div>
                <button type="submit" smButton="primary" [loading]="saving()">
                  {{ text.save }}
                </button>
              </div>
            </form>
          </ng-template>
        </sm-remote-view>
      </div>
    </section>
  `,
})
export class EstablishmentPageComponent implements OnInit {
  private readonly api = inject(ProvidersApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionStore);

  protected readonly text = PROVIDER_MESSAGES.establishment;
  protected readonly patterns = PATTERN_MESSAGES;
  protected readonly timeZones = TIME_ZONE_OPTIONS;
  protected readonly categoryOptions = enumOptions(
    SERVICE_CATEGORY_VALUES,
    SERVICE_CATEGORY_LABELS,
  );

  protected readonly publicPath = computed(() => {
    const id = this.session.user()?.providerId;
    return id ? APP_PATHS.provider(id) : null;
  });

  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: SmValidators.displayName }),
    description: new FormControl('', {
      nonNullable: true,
      validators: SmValidators.providerDescription,
    }),
    category: new FormControl<ServiceCategory | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    contactEmail: new FormControl('', { nonNullable: true, validators: SmValidators.email }),
    contactPhone: new FormControl('', { nonNullable: true, validators: SmValidators.phone }),
    timeZoneId: new FormControl(DEFAULT_TIME_ZONE, { nonNullable: true }),
    address: createAddressForm(),
  });

  protected readonly state = signal<RemoteState<ProviderProfile>>(LOADING);
  protected readonly saving = signal(false);
  protected readonly summary = signal<string[]>([]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(LOADING);
    this.api.getMe().subscribe({
      next: (profile) => {
        this.fill(profile);
        this.state.set(ready(profile));
      },
      error: (error: unknown) => this.state.set(failed(error)),
    });
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || v.category === '') {
      return;
    }
    const body: UpdateProviderRequest = {
      displayName: v.displayName.trim(),
      description: v.description.trim() || null,
      category: v.category,
      contactEmail: v.contactEmail.trim(),
      contactPhone: v.contactPhone,
      address: toAddress(this.form.controls.address),
      timeZoneId: v.timeZoneId,
    };
    this.summary.set([]);
    this.saving.set(true);
    this.api
      .updateMe(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (profile) => {
          this.fill(profile);
          this.state.set(ready(profile));
          this.toast.success(this.text.saved);
        },
        error: (error: unknown) => this.summary.set(handleFormError(this.form, error).summary),
      });
  }

  private fill(profile: ProviderProfile): void {
    this.form.setValue({
      displayName: profile.displayName,
      description: profile.description ?? '',
      category: profile.category,
      contactEmail: profile.contactEmail ?? '',
      contactPhone: profile.contactPhone,
      timeZoneId: profile.timeZoneId,
      address: {
        street: profile.address.street,
        number: profile.address.number,
        complement: profile.address.complement ?? '',
        district: profile.address.district,
        city: profile.address.city,
        state: profile.address.state,
        postalCode: profile.address.postalCode,
      },
    });
    this.form.markAsPristine();
  }
}
