# Implementation Plan: Aplicação Web do Agendador Online (ScheduleManager Web)

**Branch**: `001-scheduling-web-app` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-scheduling-web-app/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

SPA em Angular 22 (standalone, signals, zoneless) que consome **exclusivamente** a Web API `/api/v1` já existente: 34 operações, cada uma com consumidor (Apêndice A da spec). Ela atende 4 perfis (Visitante, Cliente, Prestador, Admin) em pt-BR, com todos os horários no fuso do prestador.

A abordagem técnica (ver [research.md](./research.md)):

- **Contrato**: tipos gerados do `openapi.yaml` (R5) e um serviço de API por recurso, atrás de interceptors funcionais que normalizam erros RFC 7807 num catálogo por `code` (R8, [error-catalog](./contracts/error-catalog.md)).
- **Regras de integração**: concorrência otimista via ETag/If-Match (R9), idempotência da reserva com chave estável por tentativa (R10) e estado da reserva na URL para retomar após o login (R11).
- **Sessão e fuso**: sessão em memória + `sessionStorage` com aviso 5 minutos antes de expirar (R6); fusos com `Intl` nativo (R7).
- **UI e testes**: TailwindCSS + Lucide + `@angular/cdk` para acessibilidade (R2), conforme a constituição; testes com Vitest + jsdom (R3) e Playwright contra a API real (R4).

## Technical Context

**Language/Version**: TypeScript 6.0 (`strict: true`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `strictTemplates`) sobre Angular 22.3 (CLI 22.3.x); Node 22 LTS ≥ 22.22.3 (ou 24 LTS ≥ 24.15); npm 10.9

**Primary Dependencies**:
- runtime: `@angular/*` 22.3 (core, common, router, forms, platform-browser), `@angular/cdk` 22.3 (a11y/dialog/overlay/layout), `rxjs` 7.8, `@lucide/angular` 1.x, `jwt-decode` 4.x;
- estilos: `tailwindcss` 3.4 + `postcss` + `autoprefixer`;
- desenvolvimento: `openapi-typescript` 7 (ver R5 sobre TS 6), `vitest` 5.x + `jsdom`, `@playwright/test` 1.65 + `@axe-core/playwright`, `angular-eslint` + `typescript-eslint` + `eslint`, `prettier`.

**Storage**: nenhum armazenamento próprio. Estado remoto vem da API. No navegador: `sessionStorage` (`sm.session`, `sm.booking-draft`), descartado ao fechar a aba. Sem `localStorage`.

**Testing**: Vitest 5 + jsdom via `ng test` (unidade: serviços, interceptors, guards, stores, funções de fuso, validadores, `availableActions`; componente: reserva, cancelar/reagendar, editor de expediente, aviso de sessão); Playwright E2E (17 cenários) com axe contra a API real em dev.

**Target Platform**: navegadores modernos (2 últimas versões de Chrome, Edge, Firefox e Safari, incluindo iOS Safari e Chrome Android), mobile-first a partir de 360 px; servido na mesma origem da API (reverse proxy em produção; proxy do Angular CLI em dev).

**Project Type**: aplicação web (SPA front-end) consumindo API REST existente (sem backend novo).

**Performance Goals**: conteúdo ou skeleton em ≤ 1 s e troca de página de lista em ≤ 2 s (SC-008); bundle inicial ≤ 300 kB gzip, com cada área *lazy* ≤ 150 kB gzip. Como os orçamentos do Angular medem o tamanho **sem compressão**, o `angular.json` usa limites brutos mais rígidos que a meta em gzip (achado I3, 2026-11-26): `initial` aviso 500 kB / erro 600 kB e `anyScript` aviso 400 kB / erro 500 kB (≈ 3,5–4× o gzip); o tamanho real transferido aparece em "Estimated transfer size" no `ng build` e é conferido na T166; LCP ≤ 2,5 s em 4G na vitrine e na reserva.

**Constraints**:
- nenhuma operação, campo ou enum fora do contrato (FR-001); a API não é alterada;
- a API não habilita CORS, então a aplicação roda na mesma origem;
- token de 60 minutos sem renovação;
- WCAG 2.1 AA;
- build de produção sem avisos;
- `any` proibido;
- dependências novas só com justificativa (constituição §3.2, ver Complexity Tracking).

**Scale/Scope**: 8 user stories, cerca de 30 rotas ([routes](./contracts/routes.md)), 34 operações em 8 serviços de API ([api-services](./contracts/api-services.md)), 37 códigos de erro, 4 perfis. Volume por usuário: listas paginadas (≤ 100 por página); o calendário semanal do prestador pagina até completar (R16).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Artigo / regra | Como o plano atende | Status |
|---|---|---|
| **I.1** Spec prévia obrigatória | spec.md aprovada e esclarecida (4 Clarifications); tasks só depois do plano | ✅ |
| **I.2** Rastreabilidade | Apêndice A (operação → tela → US), mapa de rotas com US/FR, mapa de cenários E2E no quickstart | ✅ |
| **I.3** Não-assunção | contrato OpenAPI e código da API inspecionados; tipos gerados do contrato (R5); `http.error` descoberto no código e incluído no catálogo | ✅ |
| **II.1** `core/` · `features/` · `shared/` | estrutura abaixo; componentes não chamam `HttpClient` (regra ESLint `no-restricted-imports` em `features/**` e `shared/**`); `shared/` não importa serviços de `core/api` (só apresentacional); componentes de tela ficam em `features/`, guards e singletons em `core/` | ✅ (constituição 1.2.0) |
| **III.1** TS strict, sem `any` | `strict` + `@typescript-eslint/no-explicit-any: error`; `unknown` + type guards no parsing de `ProblemDetails` | ✅ |
| **III.2** Sem valores mágicos | rotas da API em `core/api/endpoints.ts`; enums `as const satisfies`; textos em `core/i18n`; chaves de storage e tempos (5 min de aviso, `pageSize` 100) em `core/config/app.constants.ts` | ✅ |
| **IV.1** Testes Vitest + jsdom | R3; lista de suítes em Technical Context | ✅ |
| **IV.2** Verificação empírica | portões no [quickstart §4](./quickstart.md): `ng build`, `ng test`, lint, `api:types` sem diff, E2E | ✅ |
| **3.1** Stack (Angular 22, TS 6.0, Node 22.22.3+, Tailwind 3.4, SCSS, `@lucide/angular`, jwt-decode, Vitest 4.0+ → 5.x, npm 10.9) | todos adotados; Angular Material do briefing **substituído** por Tailwind (R2) | ✅ |
| **3.2** Dependências novas justificadas | `@angular/cdk`, `postcss`/`autoprefixer`, `openapi-typescript`, `@playwright/test`, `@axe-core/playwright`, `angular-eslint`/`eslint`/`prettier`, `jsdom` (lista na spec, seção "Dependências justificadas"; detalhes em Complexity Tracking) | ✅ justificadas |
| **4.1** Standalone, kebab-case, RxJS + Signals | `standalone: true` explícito; arquivos `*.component.ts`, `*.api.ts`, `*.store.ts`; HTTP em RxJS, estado em signals (`toSignal`/`rxResource`) | ✅ |
| **5.1–5.4** Regras para agentes | leitura antes de editar; sem silenciar erros; contrato da API intocado | ✅ |
| **5.5** Implementação em `src` | todo o código em `web/src/` (app e E2E) | ✅ (ver Complexity Tracking) |

**Gate (pré-Fase 0)**: aprovado; os desvios estão justificados abaixo.

**Re-check pós-Fase 1**: aprovado. O data model usa só aliases do contrato, os contratos internos não introduzem endpoints e nenhuma dependência nova entrou além das listadas.

## Project Structure

### Documentation (this feature)

```text
specs/001-scheduling-web-app/
├── plan.md              # este arquivo
├── research.md          # Fase 0: decisões R1–R17
├── data-model.md        # Fase 1: modelos de API, máquina de estados, estado do cliente
├── quickstart.md        # Fase 1: execução, portões de qualidade, roteiro de validação
├── contracts/
│   ├── routes.md        # URLs, guards e query params (interface com o usuário)
│   ├── api-services.md  # serviços front → /api/v1 (34 operações)
│   └── error-catalog.md # code → mensagem pt-BR → comportamento
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root: `web/`)

```text
web/
├── angular.json · package.json · tsconfig*.json · tailwind.config.js · postcss.config.js
├── eslint.config.js · .prettierrc · proxy.conf.json · playwright.config.ts
└── src/
    ├── index.html · main.ts · styles.scss
    ├── environments/            # environment.ts (apiBaseUrl: '/api/v1'), environment.development.ts
    ├── app/
    │   ├── app.config.ts        # provideRouter, provideHttpClient(withInterceptors), zoneless, LOCALE_ID, initializer de sessão
    │   ├── app.routes.ts        # rotas públicas + loadChildren por área + páginas de erro
    │   ├── app.component.ts     # shell: cabeçalho por perfil, <router-outlet>, toasts, aviso de sessão
    │   ├── core/
    │   │   ├── api/             # schema.gen.ts (gerado), endpoints.ts, http-params.ts, *.api.ts (8 serviços), provider-time-zone.cache.ts
    │   │   ├── models/          # aliases de domínio + enums as const + labels
    │   │   ├── auth/            # session.store.ts, session-timer.service.ts, auth.guard.ts, role.guard.ts, guest.guard.ts, provider-home.guard.ts, return-url.ts
    │   │   ├── http/            # api-base-url / auth / error interceptors, contexts (SKIP_SESSION_401)
    │   │   ├── errors/          # api-error.ts, problem-details.guards.ts, error-messages.ts, form-errors.ts
    │   │   ├── domain/          # appointment-actions.ts (máquina de estados), booking-policy-format.ts
    │   │   ├── i18n/            # *.messages.ts (textos pt-BR por área)
    │   │   └── config/          # app.constants.ts, time-zones.ts (lista IANA, BR em destaque)
    │   ├── shared/
    │   │   ├── ui/              # button, field, select, dialog, toast, status-badge, tabs, pagination,
    │   │   │                    # empty-state, skeleton, error-state, zone-hint, confirm-dialog, affected-appointments-list (só apresentação)
    │   │   ├── forms/           # validators.ts, phone-br.directive.ts, cep.directive.ts, address-form.component.ts
    │   │   ├── time/            # zoned-time.ts (formatInZone, zoneLabel, zonedDayRange/WeekRange, todayInZone), pipes
    │   │   └── state/           # remote-state.ts, list-query.ts (URL ⇄ filtros tipados)
    │   └── features/
    │       ├── catalog/         # provider-search.page, provider-profile.page, availability-picker
    │       ├── booking/         # booking.page, booking.store (BookingAttempt + reschedule), booking-summary, booking-success
    │       ├── auth/            # login.page, register-customer.page, register-provider.page (wizard)
    │       ├── appointments/    # appointment-detail.page + store (compartilhado por cliente/prestador/admin), history-timeline, cancel-dialog
    │       ├── customer/        # customer.routes, my-appointments.page, customer-profile.page
    │       ├── provider/        # provider.routes, setup-checklist, agenda (list/day/week), services, schedule-editor, affected-appointments-panel,
    │       │                    # exceptions, booking-policy, establishment
    │       ├── notifications/   # notifications.page (reutilizada pelas 3 áreas)
    │       ├── admin/           # admin.routes, users.page, notifications-audit.page, appointment-lookup.page
    │       ├── errors/          # not-found.page, forbidden.page, unexpected-error.page
    │       └── shell/           # app-header, session-warning
    └── e2e/                     # Playwright: *.e2e.ts, fixtures/ (dados via API), support/ (axe, clock)
```

Testes unitários e de componente ficam ao lado do código (`*.spec.ts`), padrão do Angular CLI. Os E2E usam a extensão `*.e2e.ts`, o que evita que o builder do Vitest os colete.

**Structure Decision**: Workspace Angular único em `web/` com toda a implementação em `web/src/` (R15). A divisão `core/` (singletons, API, sessão, erros, modelos), `shared/` (UI e utilitários puros) e `features/` (telas por domínio, carregadas sob demanda por área de perfil) segue o Art. II. `features/appointments` e `features/notifications` são compartilhadas pelas áreas e montadas nas rotas de cada perfil.

## Fluxos-chave (referência para tasks)

- **Inicialização**: `provideAppInitializer` → `SessionStore.restore()` → `AuthApi.me()` (se houver token válido) → agenda os timers de aviso e expiração.
- **Reserva**: URL (`servico`, `data`, `horario`) → `availability()` → resumo (gera `idempotencyKey`) → sem Customer, `/entrar?returnUrl` → `create(body, key)` → sucesso (Pendente/Confirmado). Em `409 slot_unavailable`, recarrega os horários (R10/R11, FR-024..031).
- **Reagendar**: `?reagendar=id` → `AppointmentsApi.get` (etag) → escolha do novo horário → confirmação → `cancel(etag, motivo)` → `create(...)`, com estados `cancelRejected` / `bookingFailedAfterCancel` (FR-035/035a).
- **Ações de status**: `availableActions()` decide o que mostrar → ação com `etag` → em `412`/`409 concurrency`, aviso e `reload()` (FR-046..048).
- **Expediente e exceções**: validação local (sem sobreposição) → `PUT`/`POST` → `affected-appointments-panel` com ações abrir/cancelar (FR-041..043).

## Complexity Tracking

> Desvios e dependências que exigem justificativa pela constituição.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dependência `@angular/cdk` (§3.2) | Foco preso em diálogos, `LiveAnnouncer` para erros e aviso de sessão, overlay acessível: requisitos WCAG 2.1 AA (FR-011, FR-017a) | Escrever à mão é caro e arriscado em acessibilidade; Angular Material conflita com o Tailwind da constituição |
| Dependência dev `openapi-typescript` (§3.2) | Tipos derivados do contrato autoritativo (FR-001, Art. I.3, Art. V.4); a CI detecta divergência. Declara peer `typescript ^5.x`: usa `overrides` no `package.json` com o TS 6.0, validado na tarefa de setup (R5) | Modelos à mão divergem silenciosamente em 34 operações |
| Dependências dev `@playwright/test` + `@axe-core/playwright` (§3.2) | SC-005 (17 cenários E2E contra a API real, com duas abas, relógio e fuso) e SC-009 (acessibilidade) | Não há E2E nativo no Angular; Cypress lida mal com múltiplos contextos; só testes unitários não provam os cenários |
| Dependências dev `angular-eslint`, `eslint`, `prettier` (§3.2; não constam da matriz 3.1) | Garantia automática do Art. III (sem `any`, sem `HttpClient` em componentes) e "build sem avisos" do briefing | Revisão manual não garante a regra de forma contínua |
| Dependência dev `jsdom` (§3.1 já cita "jsdom") | Ambiente exigido pelo Art. IV.1 | — (exigido pela própria constituição) |
