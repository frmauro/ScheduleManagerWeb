# Contexto e Objetivo

Você é um Arquiteto de Front-end Sênior, especialista em **Angular** e em UX de produtos SaaS. Vamos iniciar um processo de **Spec-Driven Development (SDD)** para projetar e depois implementar a aplicação **web do Agendador Online (ScheduleManager Web)**, que consome uma **Web API REST já implementada e testada** (ASP.NET Core, `/api/v1`).

A API é a **fonte da verdade**. O front-end **não pode inventar endpoints, campos, status ou regras** que não estejam descritos abaixo (ou no contrato OpenAPI `specs/001-online-scheduling-api/contracts/openapi.yaml` do projeto da API, que deve ser consultado sempre que houver dúvida). Quando uma necessidade de tela não tiver suporte na API, registre como **lacuna** em vez de contorná-la.

Seu objetivo nesta etapa **não é escrever o código final**, e sim produzir a especificação funcional (jornadas, telas, regras de interface, critérios de aceite) e, na fase de planejamento, a arquitetura do front-end, seguindo as fases do SDD:

1. **Constituição** → princípios do projeto (seção 6).
2. **Specify** → o quê e por quê: personas, jornadas, telas, regras e critérios de aceite (seções 1–4).
3. **Clarify** → dúvidas sobre o que estiver ambíguo.
4. **Plan** → arquitetura, estrutura de pastas, modelos TypeScript, serviços HTTP, estratégia de testes (seções 5 e 7).
5. **Tasks / Implement** → somente depois da aprovação da spec e do plano.

---

## 1. Visão Geral do Produto

Plataforma única de agendamento (**marketplace**, sem isolamento por organização). Prestadores de serviço (profissionais individuais, cada um com **uma única agenda**: salões, barbearias, clínicas, consultórios) publicam serviços e expediente; clientes encontram prestadores, consultam horários livres e reservam sozinhos. A API impede *overbooking* e gera notificações (simuladas).

- Idioma da interface: **pt-BR**. Moeda: **BRL**. Datas exibidas em formato brasileiro (`dd/MM/yyyy HH:mm`).
- **Fuso horário**: cada prestador tem um `timeZoneId` (IANA, padrão `America/Sao_Paulo`). Todo horário de agendamento é exibido **no fuso do prestador**, com indicação explícita do fuso quando ele diferir do fuso do navegador.

### Personas / Perfis (`Role`)

| Perfil | Como entra | O que faz |
|---|---|---|
| **Visitante** (não autenticado) | — | Navega no catálogo público de prestadores, vê perfil, serviços e horários livres; para reservar, precisa entrar ou se cadastrar. |
| **Customer** (Cliente) | Auto-cadastro | Reserva, acompanha e cancela seus agendamentos; mantém o perfil; vê suas notificações. |
| **Provider** (Prestador) | Auto-cadastro (já cria o perfil do estabelecimento) | Mantém perfil, política de reservas, serviços, expediente e exceções; gerencia a agenda (confirmar, cancelar, concluir). |
| **Admin** | Provisionado na implantação (dev: `admin@schedulemanager.local` / `Admin12345`). **Não existe auto-cadastro de Admin.** | Lista e ativa/desativa usuários; audita notificações; consulta e altera status de qualquer agendamento pelo ID. |

---

## 2. Funcionalidades (Requisitos Funcionais por módulo)

Cada item indica o endpoint consumido. Rotas relativas a `/api/v1`. Salvo indicação "público", todas exigem `Authorization: Bearer <JWT>`.

### A. Autenticação e Sessão

- **Login** — `POST /auth/login` `{ email, password }` → `AuthResponse { accessToken, tokenType: "Bearer", expiresAt, user: CurrentUser }`. Falha → `401 auth.invalid_credentials`, com mensagem genérica (não revelar se o e-mail existe).
- **Cadastro de cliente** — `POST /auth/register/customer` `{ name, email, password, phone }` → `201 AuthResponse` (já autenticado após o cadastro).
- **Cadastro de prestador** — `POST /auth/register/provider` `{ name, email, password, displayName, description?, category, contactEmail?, contactPhone, address, timeZoneId? }` → `201 AuthResponse`. A política de reservas nasce com valores padrão. Assistente em etapas sugerido: conta → estabelecimento → endereço.
  - E-mail já usado (sem distinção de maiúsculas) → `409 user.email_taken`.
- **Usuário atual** — `GET /auth/me` → `CurrentUser { id, name, email, role, providerId?, customerId? }`. Usar ao iniciar a aplicação para validar o token salvo.
- **Sessão**: o token vale **60 minutos** e **não há refresh token, logout no servidor nem recuperação de senha**. O front deve:
  - guardar token e `expiresAt`; considerar a sessão expirada ao passar de `expiresAt`;
  - em qualquer `401`, limpar a sessão e redirecionar ao login preservando a URL de retorno (`returnUrl`), com aviso "Sua sessão expirou";
  - "Sair" = descartar o token localmente.
- **Após login**, redirecionar conforme o perfil: Customer → "Meus agendamentos" (ou a reserva que estava em andamento), Provider → "Agenda", Admin → "Usuários".

### B. Catálogo Público (Visitante e Cliente)

- **Busca de prestadores** — `GET /providers` (público) com `page`, `pageSize`, `category`, `city`, `q` (texto no nome de exibição) e `sort` (`displayName` | `-displayName`) → `PagedProviderSummary` com itens `{ id, displayName, category, city, state }`. Filtros refletidos na URL (query params) para permitir compartilhar e voltar.
- **Perfil público do prestador** — `GET /providers/{providerId}` (público) → `ProviderPublicProfile { id, displayName, description, category, contactEmail, contactPhone, address, timeZoneId }`. Prestador inativo ou inexistente → `404`.
- **Serviços do prestador** — `GET /providers/{providerId}/services` (público, paginado) → serviços **ativos** `{ id, providerId, name, description, durationMinutes, price, isActive }`.

### C. Reserva (Motor de Agendamento) — fluxo principal do Cliente

Meta de UX: encontrar e concluir a reserva em **até 3 interações** (escolher serviço/data → escolher horário → confirmar) e em menos de 2 minutos.

1. **Escolher serviço** (lista do item B).
2. **Escolher data** — calendário limitado de hoje até o horizonte do prestador (o horizonte não é exposto no perfil público; o calendário deve tratar o `422 availability.beyond_horizon` com mensagem amigável).
3. **Ver horários livres** — `GET /providers/{providerId}/availability?serviceId={id}&date=yyyy-MM-dd` (público) → `AvailabilityResponse { providerId, serviceId, date, timeZoneId, durationMinutes, slots: [{ startAt, endAt }] }`.
   - `date` é interpretada no fuso do prestador. Dia sem expediente, fechado ou lotado → `200` com `slots: []` → mostrar estado vazio ("Sem horários nesta data") e sugerir outra data.
   - Erros: `400 validation.failed` (data inválida), `404` (prestador/serviço inexistente, inativo ou de outro prestador), `422 availability.date_in_past` / `availability.beyond_horizon`.
   - A lista **não reserva** nada; outro cliente pode ocupar o horário antes da confirmação.
4. **Confirmar reserva** (exige login como Customer; se visitante, levar ao login/cadastro e **retomar a reserva** depois) — `POST /appointments` com body `{ providerId, serviceId, startAt, notes? (≤ 500) }` e header **`Idempotency-Key: <uuid>`**.
   - `startAt` deve ser **exatamente** o valor recebido no slot (string ISO 8601 com offset). Não reconstruir a data no front.
   - Gerar **uma** `Idempotency-Key` por tentativa de reserva e reutilizá-la em reenvios (duplo clique, retry de rede). Repetição com a mesma chave → `200` com o mesmo agendamento (tratar como sucesso). Mesma chave com payload diferente → `422 idempotency.key_reused`.
   - Sucesso `201` → `Appointment` com status `Pending` (aguardando confirmação do prestador) ou `Confirmed` (auto-confirmação). A tela de sucesso deve deixar claro qual dos dois.
   - `409 appointment.slot_unavailable` → "Este horário acabou de ser ocupado"; recarregar os horários da data automaticamente.
   - `409 appointment.customer_overlap` → "Você já tem um agendamento nesse horário".
   - `422` com `availability.outside_working_hours`, `availability.closed`, `availability.misaligned_start`, `availability.too_soon`, `availability.beyond_horizon`, `availability.date_in_past`, `service.inactive`, `provider.inactive` → mensagem específica e volta à escolha de horário.
   - Resumo antes de confirmar: prestador, serviço, duração, preço, data/hora no fuso do prestador, observações.
- **Reagendar** não existe como operação: oferecer "Reagendar" como atalho de *cancelar + nova reserva*, deixando isso explícito ao usuário (o cancelamento acontece primeiro e o horário antigo é liberado).

### D. Área do Cliente

- **Meus agendamentos** — `GET /customers/me/appointments` com `page`, `pageSize`, `status` (múltiplo: `?status=Pending&status=Confirmed`), `from`, `to` (date-time com offset; `to` exclusivo e > `from`; período máx. 366 dias), `providerId`, `sort` (`startAt` | `-startAt`, padrão `-startAt`) → `PagedAppointmentSummary` com `{ id, providerId, providerName, customerId, customerName, serviceName, startAt, endAt, status }`. Abas sugeridas: "Próximos" (Pending + Confirmed, a partir de agora, `sort=startAt`) e "Histórico".
- **Detalhe do agendamento** — `GET /appointments/{id}` → `Appointment` completo (prestador com `timeZoneId`, cliente, snapshot do serviço com nome/duração/preço do momento da reserva, `notes`, `cancellationReason`, `version`, `createdAt`, `history[]` com `fromStatus`, `toStatus`, `changedByRole`, `reason`, `changedAt`). Exibir a linha do tempo do histórico. O header `ETag` (igual a `W/"{version}"`) vem na resposta.
- **Cancelar** — `POST /appointments/{id}/cancel` body `{ reason }` (3–500 caracteres, obrigatório), header `If-Match` com o ETag. Resultado `CancelledByCustomer`.
  - Só para `Pending`/`Confirmed` e antes do início. A API exige antecedência mínima (padrão 2h, configurável pelo prestador): `422 appointment.cancellation_window` → explicar a política. Outros: `422 appointment.already_started`, `422 appointment.invalid_transition`.
- **Meu perfil** — `GET /customers/me` → `{ id, name, email, phone, createdAt }`; `PUT /customers/me` `{ name, email, phone }` (e-mail duplicado → `409`).
- **Notificações** — `GET /notifications/me` (paginado, filtro `type`) → `{ id, appointmentId, type, channel: "Email", subject, body, status, attempts, scheduledFor, sentAt, createdAt }`. Exibir como caixa de entrada (com link para o agendamento). Disponível para **qualquer perfil** autenticado.

### E. Área do Prestador

- **Meu estabelecimento** — `GET /providers/me` → `ProviderProfile` (perfil público + `bookingPolicy` + `isActive`); `PUT /providers/me` `{ displayName, description?, category, contactEmail, contactPhone, address, timeZoneId }`. Oferecer link "Ver minha página pública" (`/providers/{providerId}` usando `CurrentUser.providerId`).
- **Política de reservas** — leitura via `GET /providers/me` (`bookingPolicy`); gravação `PUT /providers/me/booking-policy` com todos os campos:
  - `autoConfirm` (bool, padrão false);
  - `slotStepMinutes` (5–60, múltiplo de 5, padrão 15) — passo da grade de horários;
  - `bufferMinutes` (0–120, múltiplo de 5, padrão 0) — preparo entre atendimentos;
  - `minBookingNoticeMinutes` (0–10080, padrão 60) — antecedência mínima de reserva;
  - `bookingHorizonDays` (1–365, padrão 60) — horizonte de reserva;
  - `minCancellationNoticeMinutes` (0–10080, padrão 120) — antecedência mínima de cancelamento pelo cliente.
  - Exibir os minutos em unidades amigáveis (horas/dias) e avisar que a mudança vale só para novas reservas.
- **Serviços** — `GET /providers/me/services` (inclui inativos; filtro `isActive`), `POST /providers/me/services`, `PUT /providers/me/services/{serviceId}`, `PATCH /providers/me/services/{serviceId}/status` `{ isActive }`, `DELETE /providers/me/services/{serviceId}`.
  - Campos: `name` (2–100, único por prestador → `409 service.name_taken`), `description?` (≤ 1000), `durationMinutes` (5–720, múltiplo de 5), `price` (0–99.999,99, 2 casas).
  - Excluir só funciona para serviço nunca agendado; caso contrário `409 service.in_use` → oferecer **desativar**.
  - Avisar que alterar duração/preço não afeta agendamentos existentes (snapshot).
- **Expediente semanal** — `GET /providers/me/schedule` → `WeeklySchedule { timeZoneId (somente leitura), days: [{ dayOfWeek, intervals: [{ start: "HH:mm", end: "HH:mm" }] }] }`; `PUT /providers/me/schedule/working-hours` substitui **o expediente inteiro**.
  - Editor por dia da semana (Domingo → Sábado) com várias faixas por dia (1–10); lacunas entre faixas = intervalos (ex.: almoço). Dia omitido = fechado. Validar no front: `start < end`, sem atravessar meia-noite, sem faixas sobrepostas no mesmo dia (a API rejeita com `400`).
  - Resposta `ScheduleChangeResult { schedule, affectedAppointments[] }`: se houver agendamentos futuros que ficaram fora do novo expediente, **mostrar a lista** (eles não são cancelados automaticamente) com ação para abrir/cancelar cada um.
- **Exceções (feriados, férias, horários especiais)** — `GET /providers/me/schedule/exceptions?from&to` (datas `yyyy-MM-dd`, paginado), `POST /providers/me/schedule/exceptions`, `DELETE /providers/me/schedule/exceptions/{exceptionId}`.
  - Tipos: `Closure` sem horários = dia(s) inteiro(s) fechado(s); `Closure` com `startTime`/`endTime` = fechamento parcial; `SpecialHours` (exige `startTime`/`endTime`) = substitui o expediente nas datas. Campos: `type`, `startDate`, `endDate`, `startTime?`, `endTime?`, `reason?` (≤ 200).
  - Erros: `422 schedule.exception_in_past`, `422 schedule.special_hours_overlap`.
  - Resposta `ScheduleExceptionCreated { exception, affectedAppointments[] }` → mesmo tratamento de agendamentos afetados.
- **Agenda** — `GET /providers/me/appointments` com `page`, `pageSize`, `status[]`, `from`, `to`, `serviceId`, `sort` (padrão `startAt`). Visões: **lista** e **calendário dia/semana** (montado a partir de `from`/`to` da semana visível), com destaque para `Pending` aguardando confirmação.
- **Ações sobre agendamentos** (todas com `If-Match`):
  - **Confirmar** — `POST /appointments/{id}/confirm` (Pending → Confirmed).
  - **Cancelar** — `POST /appointments/{id}/cancel` `{ reason }` → `CancelledByProvider`; pode a qualquer momento antes do início.
  - **Concluir** — `POST /appointments/{id}/complete` (Confirmed → Completed), **somente após o início** (`422 appointment.not_started`). Mostrar o botão apenas quando fizer sentido.
  - O detalhe exibe e-mail e telefone do cliente (o prestador só vê esses dados em agendamentos que recebeu).
- **Notificações** — mesma caixa de entrada do item D (`GET /notifications/me`).

### F. Área do Admin

- **Usuários** — `GET /admin/users` com `page`, `pageSize`, `role`, `isActive`, `q` (nome ou e-mail) → `{ id, name, email, role, isActive, createdAt }`.
- **Ativar/desativar conta** — `PATCH /admin/users/{userId}/status` `{ isActive }` → `204`. Pedir confirmação; explicar que prestador inativo some do catálogo e deixa de aceitar reservas. `422 admin.cannot_deactivate_self` → desabilitar a ação na própria linha.
- **Auditoria de notificações** — `GET /admin/notifications` com `page`, `pageSize`, `status` (`Pending`, `Sent`, `Failed`, `Cancelled`), `appointmentId` → tabela com tentativas, agendada para e enviada em.
- **Agendamento por ID** — a partir da auditoria (campo `appointmentId`) ou de um campo de busca por ID: `GET /appointments/{id}` e ações `confirm`, `complete` e `cancel`. No cancelamento, o Admin **precisa** informar `onBehalfOf: "Customer" | "Provider"` (para os outros perfis esse campo não deve ser enviado).
- **Lacuna conhecida**: não há endpoint de listagem geral de agendamentos nem de criação de Admin; não criar telas que dependam disso.

---

## 3. Máquina de Estados do Agendamento (para habilitar/ocultar ações)

| De \ Para | Confirmed | CancelledByCustomer | CancelledByProvider | Completed |
|---|---|---|---|---|
| **Pending** | Prestador, Admin | Cliente (respeita antecedência), Admin | Prestador, Admin | — |
| **Confirmed** | — | Cliente (respeita antecedência), Admin | Prestador, Admin | Prestador, Admin (só após o início) |
| **CancelledBy\* / Completed** | estados finais — nenhuma ação | | | |

`Pending` e `Confirmed` ocupam o horário; cancelados e concluídos liberam. Rótulos pt-BR: Pendente, Confirmado, Cancelado pelo cliente, Cancelado pelo prestador, Concluído — cada um com cor/ícone próprio e acessível (não depender só de cor).

A interface esconde ações impossíveis, mas a **API é quem decide**: sempre tratar os erros de regra mesmo quando a ação estava visível.

---

## 4. Convenções de Integração com a API (obrigatórias)

- **Base URL**: `/api/v1`, configurada por `environment`. Em dev a API roda em `https://localhost:7154` (perfil `https`) ou `http://localhost:5002` (perfil `http`); Swagger em `/swagger` e documento em `/openapi/v1.json`.
- **CORS**: a API **não habilita CORS**. Em dev, usar o **proxy do Angular CLI** (`proxy.conf.json` mapeando `/api` → `https://localhost:7154`, `secure: false`). Em produção, servir front e API na mesma origem (reverse proxy). Não alterar a API.
- **Tipos TypeScript**: gerar ou escrever interfaces fiéis aos schemas do OpenAPI (ex.: `openapi-typescript` ou modelos à mão revisados contra o contrato). Enums são **strings** (a API recusa inteiros):
  - `Role`: Admin, Provider, Customer
  - `ServiceCategory`: Beauty, Barbershop, Health, Dental, Therapy, Fitness, Wellness, Education, Consulting, Other (exibir em pt-BR: Beleza, Barbearia, Saúde, Odontologia, Terapia, Fitness, Bem-estar, Educação, Consultoria, Outros)
  - `AppointmentStatus`: Pending, Confirmed, CancelledByCustomer, CancelledByProvider, Completed
  - `DayOfWeek`: Sunday … Saturday
  - `ScheduleExceptionType`: Closure, SpecialHours
  - `NotificationType`: AppointmentCreated, AppointmentConfirmed, AppointmentCancelled, AppointmentReminder
  - `NotificationStatus`: Pending, Sent, Failed, Cancelled
- **Paginação**: query `page` (≥ 1, padrão 1) e `pageSize` (1–100, padrão 20); resposta `{ items, page, pageSize, totalCount, totalPages }`. Componente de paginação reutilizável.
- **Datas e horas**:
  - instantes (`startAt`, `endAt`, `from`, `to`, `createdAt`…) são ISO 8601 **com offset**; ao enviar `from`/`to`, sempre incluir o offset;
  - datas puras (`date`, `startDate`, `endDate`) em `yyyy-MM-dd`; horas locais (`start`, `end`, `startTime`, `endTime`) em `HH:mm` (24h);
  - exibir horários de agendamento no fuso do prestador usando `Intl.DateTimeFormat` com `timeZone` (ou biblioteca equivalente); nunca converter `startAt` para enviar de volta.
- **Erros (RFC 7807)** — `application/problem+json` com `{ type, title, status, detail?, code, traceId }`; erros de validação (`400 validation.failed`) trazem `errors: { campo: [mensagens] }` com nomes de campo em camelCase (ex.: `startAt`, `address.city`).
  - Um **interceptor HTTP** central trata `401` (sessão), `403` ("Você não tem permissão"), `0`/`5xx` (falha de rede/servidor, com opção de tentar de novo) e expõe o `ProblemDetails` tipado às telas.
  - Os formulários mapeiam `errors` para os campos correspondentes.
  - Um **catálogo de mensagens por `code`** (pt-BR) traduz os códigos abaixo; o `detail` da API (já em pt-BR) é a mensagem reserva. Mostrar o `traceId` em erros inesperados para suporte.
- **Concorrência otimista**: ações de status enviam `If-Match` com o `ETag` recebido (ou `W/"{version}"` do corpo). `412 appointment.precondition_failed` ou `409 appointment.concurrency_conflict` → "Este agendamento foi alterado por outra pessoa"; recarregar o detalhe e mostrar o status atual.
- **Idempotência**: `Idempotency-Key` (UUID v4) somente em `POST /appointments` (ver seção C).
- **Validação de formulários** (espelhar a API para feedback imediato; a API continua soberana):
  - nome 2–120; e-mail válido ≤ 254; senha 8–128 com ao menos uma letra e um dígito;
  - telefone E.164 `^\+[1-9]\d{7,14}$` (ex.: `+5511999998888`) — usar campo com máscara brasileira que converte para E.164;
  - endereço: `street` ≤ 200, `number` ≤ 20, `complement?` ≤ 100, `district` ≤ 100, `city` ≤ 100, `state` UF com 2 letras maiúsculas, `postalCode` CEP com 8 dígitos sem traço (máscara `00000-000` na tela);
  - `displayName` 2–120, `description` ≤ 2000; `timeZoneId` escolhido de uma lista de fusos IANA (padrão `America/Sao_Paulo`).

### Catálogo de códigos de erro da API

`validation.failed`, `server.internal_error`, `route.not_found`, `auth.unauthenticated`, `auth.invalid_credentials`, `auth.forbidden`, `user.email_taken`, `user.not_found`, `provider.not_found`, `provider.inactive`, `service.not_found`, `service.inactive`, `service.name_taken`, `service.in_use`, `schedule.invalid_working_hours`, `schedule.invalid_exception`, `schedule.exception_in_past`, `schedule.special_hours_overlap`, `schedule.exception_not_found`, `availability.date_in_past`, `availability.beyond_horizon`, `availability.outside_working_hours`, `availability.closed`, `availability.misaligned_start`, `availability.too_soon`, `appointment.not_found`, `appointment.slot_unavailable`, `appointment.customer_overlap`, `appointment.concurrency_conflict`, `appointment.precondition_failed`, `appointment.invalid_transition`, `appointment.cancellation_window`, `appointment.already_started`, `appointment.not_started`, `idempotency.key_reused`, `admin.cannot_deactivate_self`.

### Inventário completo de endpoints (34) — todos devem ter consumidor no front

| # | Método | Rota | Perfil | Tela/uso |
|---|---|---|---|---|
| 1 | POST | `/auth/register/customer` | público | Cadastro de cliente |
| 2 | POST | `/auth/register/provider` | público | Cadastro de prestador |
| 3 | POST | `/auth/login` | público | Login |
| 4 | GET | `/auth/me` | autenticado | Bootstrap da sessão |
| 5 | GET | `/customers/me` | Customer | Meu perfil |
| 6 | PUT | `/customers/me` | Customer | Editar perfil |
| 7 | GET | `/customers/me/appointments` | Customer | Meus agendamentos |
| 8 | GET | `/providers` | público | Busca de prestadores |
| 9 | GET | `/providers/{providerId}` | público | Página do prestador |
| 10 | GET | `/providers/me` | Provider | Meu estabelecimento / política |
| 11 | PUT | `/providers/me` | Provider | Editar estabelecimento |
| 12 | PUT | `/providers/me/booking-policy` | Provider | Política de reservas |
| 13 | GET | `/providers/me/appointments` | Provider | Agenda |
| 14 | GET | `/providers/{providerId}/services` | público | Serviços na página do prestador |
| 15 | GET | `/providers/me/services` | Provider | Gestão de serviços |
| 16 | POST | `/providers/me/services` | Provider | Novo serviço |
| 17 | PUT | `/providers/me/services/{serviceId}` | Provider | Editar serviço |
| 18 | DELETE | `/providers/me/services/{serviceId}` | Provider | Excluir serviço |
| 19 | PATCH | `/providers/me/services/{serviceId}/status` | Provider | Ativar/desativar serviço |
| 20 | GET | `/providers/me/schedule` | Provider | Expediente |
| 21 | PUT | `/providers/me/schedule/working-hours` | Provider | Salvar expediente |
| 22 | GET | `/providers/me/schedule/exceptions` | Provider | Lista de exceções |
| 23 | POST | `/providers/me/schedule/exceptions` | Provider | Nova exceção |
| 24 | DELETE | `/providers/me/schedule/exceptions/{exceptionId}` | Provider | Remover exceção |
| 25 | GET | `/providers/{providerId}/availability` | público | Horários livres (reserva) |
| 26 | POST | `/appointments` | Customer | Confirmar reserva |
| 27 | GET | `/appointments/{appointmentId}` | Customer, Provider, Admin | Detalhe do agendamento |
| 28 | POST | `/appointments/{appointmentId}/confirm` | Provider, Admin | Confirmar |
| 29 | POST | `/appointments/{appointmentId}/cancel` | Customer, Provider, Admin | Cancelar |
| 30 | POST | `/appointments/{appointmentId}/complete` | Provider, Admin | Concluir |
| 31 | GET | `/notifications/me` | autenticado | Caixa de notificações |
| 32 | GET | `/admin/users` | Admin | Usuários |
| 33 | PATCH | `/admin/users/{userId}/status` | Admin | Ativar/desativar usuário |
| 34 | GET | `/admin/notifications` | Admin | Auditoria de notificações |

---

## 5. Mapa de Telas e Navegação (proposta inicial — refinar na spec)

- **Público**: Início/Busca (`/`), Página do prestador (`/prestadores/:id`), Reserva (`/prestadores/:id/agendar?servico=&data=`), Login (`/entrar`), Cadastro de cliente (`/cadastro`), Cadastro de prestador (`/cadastro/prestador`).
- **Cliente** (`/cliente`): Meus agendamentos, Detalhe do agendamento, Meu perfil, Notificações.
- **Prestador** (`/prestador`): Agenda (lista + calendário), Detalhe do agendamento, Serviços, Expediente, Exceções, Política de reservas, Meu estabelecimento, Notificações. Na primeira entrada, um *checklist de configuração* (cadastrar serviço → definir expediente → revisar política) até o prestador ter horários disponíveis.
- **Admin** (`/admin`): Usuários, Auditoria de notificações, Agendamento por ID, Notificações.
- Páginas de erro: 404, "sem permissão", erro genérico com `traceId`.
- Rotas protegidas por **guards** de autenticação e de perfil; módulos de cada perfil carregados sob demanda (*lazy loading*).

---

## 6. Requisitos Não-Funcionais e Princípios (base da Constituição do front-end)

- **Stack**: Angular na versão estável mais recente, com **standalone components**, **signals** para estado, novo *control flow* (`@if`, `@for`), `HttpClient` com **interceptors funcionais**, **Reactive Forms tipados**, roteamento com *lazy loading* e guards funcionais. TypeScript em modo `strict`.
- **UI**: Angular Material (ou biblioteca equivalente justificada no plano), layout **responsivo mobile-first** — o fluxo de reserva do cliente deve funcionar bem no celular.
- **Acessibilidade**: WCAG 2.1 AA (navegação por teclado, foco visível, rótulos em formulários, contraste, mensagens de erro anunciadas).
- **Arquitetura**: separação em `core` (auth, interceptors, tratamento de erro, config), `shared` (componentes de UI, pipes de data/fuso/moeda, paginação) e `features` por domínio (catalog, booking, customer, provider, admin, notifications). Um serviço de API por recurso; componentes não chamam `HttpClient` diretamente.
- **Fidelidade ao contrato**: nenhum endpoint, campo ou enum fora do OpenAPI. Divergências viram lacunas documentadas.
- **Estados de tela**: toda tela com dados remotos trata carregando, vazio, erro e sucesso; botões de envio ficam desabilitados durante a requisição (evita duplo envio).
- **Segurança**: token apenas em memória + `sessionStorage` (justificar a escolha no plano); nunca registrar token ou senha em log; esconder rotas e ações por perfil, sabendo que a autorização real é da API.
- **i18n**: textos em pt-BR centralizados; `LOCALE_ID` `pt-BR` para datas e moeda.
- **Qualidade**: ESLint + Prettier; build de produção sem erros ou avisos.
- **Testes**:
  - unitários de serviços, interceptors, guards, pipes de fuso e validadores (Vitest ou Jest), com `HttpTestingController`;
  - testes de componente nas telas críticas (reserva, cancelamento, editor de expediente);
  - **E2E (Playwright)** contra a API real em dev, cobrindo os cenários da seção 7.

---

## 7. Cenários de Aceitação Obrigatórios (base para testes E2E)

1. Visitante busca prestadores por categoria e cidade, abre um prestador, escolhe serviço e data e vê horários com o fuso indicado.
2. Visitante tenta reservar → é levado ao login/cadastro → volta à mesma reserva com serviço, data e horário preservados → conclui a reserva.
3. Reserva bem-sucedida mostra `Pendente` ou `Confirmado` conforme a política do prestador; o horário reservado (e os sobrepostos) somem ao recarregar a disponibilidade.
4. Duplo clique em "Confirmar reserva" cria **um** agendamento (mesma `Idempotency-Key`).
5. Horário ocupado por outra pessoa entre a consulta e a confirmação → `409` com mensagem clara e lista de horários recarregada.
6. Data sem expediente ou em férias → estado vazio, sem erro.
7. Cliente cancela com antecedência suficiente → `Cancelado pelo cliente`; dentro da janela mínima → mensagem explicando a política.
8. Prestador recém-cadastrado completa o checklist (serviço, expediente com almoço, política) e o horário de almoço não aparece na disponibilidade.
9. Prestador tenta salvar faixas sobrepostas → erro no próprio campo, sem chamada inútil à API.
10. Prestador cria férias sobre datas com agendamentos → a tela lista os agendamentos afetados.
11. Prestador confirma um `Pendente`; tenta concluir antes do início → recusado; conclui depois do início → `Concluído`.
12. Duas abas alteram o mesmo agendamento → a segunda recebe `412`/`409`, vê o aviso e o status atualizado.
13. Token expirado → redirecionamento ao login com `returnUrl` e volta à página original após entrar.
14. Cliente acessa rota de prestador/admin → tela "sem permissão"; a API responde `403` mesmo se a rota for forçada.
15. Admin desativa um prestador → ele some da busca pública; Admin não consegue desativar a si mesmo.
16. Admin abre um agendamento a partir da auditoria de notificações e o cancela informando em nome de quem.
17. Erros de validação da API (`400`) aparecem nos campos certos do formulário.

---

## 8. O Que Deve Ser Entregue Nesta Etapa (SDD)

1. **Constituição do front-end** — princípios da seção 6, com regras verificáveis.
2. **Spec funcional** (`spec.md`) — personas, *user stories* priorizadas (P1: catálogo + reserva + cadastro/login; P1: configuração do prestador; P2: gestão de agendamentos e área do cliente; P3: notificações e admin), critérios de aceite no formato *Given/When/Then*, casos de borda (fuso, concorrência, sessão expirada, listas vazias) e uma **matriz de rastreabilidade** endpoint → tela → user story cobrindo os 34 endpoints.
3. **Lista de lacunas e perguntas** (ex.: ausência de refresh token, de listagem geral de agendamentos para Admin, de exibição pública do horizonte de reserva), para a etapa de *Clarify*.
4. Na fase de **Plan**: estrutura de pastas, modelos TypeScript derivados do OpenAPI, serviços de API, interceptors, guards, estratégia de estado, configuração de proxy e ambientes, catálogo de mensagens por `code` e plano de testes.

Aguarde minhas instruções para detalharmos módulo por módulo.
