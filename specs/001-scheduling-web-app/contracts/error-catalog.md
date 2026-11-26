# Contrato Interno — Catálogo de Erros por `code`

**Feature**: `001-scheduling-web-app` | Implementado em `src/app/core/errors/error-messages.ts` como `Record<ApiErrorCode, ErrorMessageSpec>`. `ApiErrorCode` é uma união `as const` dos 36 códigos do briefing mais `http.error` (código genérico emitido pela API para respostas de status sem corpo, ex.: 405/415 — encontrado em `Scheduling.Api/Program.cs`, ausente do briefing). Um teste garante que todos têm mensagem (SC-007).

Resolução da mensagem:

1. mensagem do catálogo pelo `code`;
2. `detail` da API (já em pt-BR), se o `code` for desconhecido;
3. mensagem genérica com `traceId`.

`validation.failed` mapeia `errors` aos campos; chaves sem campo correspondente aparecem num resumo no topo do formulário.

**Apresentação**:

- **campo**: erro junto ao controle (com `aria-describedby`);
- **inline**: alerta na própria tela;
- **toast**: aviso temporário anunciado via `LiveAnnouncer`;
- **página**: rota de erro.

| code | HTTP | Mensagem pt-BR | Apresentação / comportamento |
|---|---|---|---|
| `validation.failed` | 400 | Alguns campos precisam de correção. | campo + resumo |
| `server.internal_error` | 500 | Algo deu errado do nosso lado. Tente novamente. Código para suporte: {traceId} | inline com "Tentar novamente" |
| `route.not_found` | 404 | Página não encontrada. | página 404 |
| `auth.unauthenticated` | 401 | Sua sessão expirou. Entre novamente. | limpa a sessão → `/entrar?returnUrl` |
| `auth.invalid_credentials` | 401 | E-mail ou senha inválidos. | inline no login (não revela se o e-mail existe) |
| `auth.forbidden` | 403 | Você não tem permissão para esta ação. | toast; em navegação, `/sem-permissao` |
| `user.email_taken` | 409 | Este e-mail já está em uso. | campo `email` |
| `user.not_found` | 404 | Usuário não encontrado. | inline (admin) |
| `provider.not_found` | 404 | Prestador não encontrado. | página 404 com link para a busca |
| `provider.inactive` | 422 | Este prestador não está aceitando reservas no momento. | inline; volta à página do prestador |
| `service.not_found` | 404 | Serviço não encontrado ou indisponível. | inline; volta à escolha de serviço |
| `service.inactive` | 422 | Este serviço não está mais disponível. | inline; volta à escolha de serviço |
| `service.name_taken` | 409 | Você já tem um serviço com este nome. | campo `name` |
| `service.in_use` | 409 | Este serviço já foi agendado e não pode ser excluído. Você pode desativá-lo. | diálogo com ação "Desativar" |
| `schedule.invalid_working_hours` | 422 | Revise as faixas de horário: o início deve ser antes do fim e as faixas não podem se sobrepor. | campo (faixa) |
| `schedule.invalid_exception` | 422 | Revise os dados da exceção. | campo |
| `schedule.exception_in_past` | 422 | Não é possível criar exceções em datas passadas. | campo `startDate` |
| `schedule.special_hours_overlap` | 422 | Já existe um horário especial nessas datas. | inline |
| `schedule.exception_not_found` | 404 | Esta exceção já foi removida. | toast + recarrega a lista |
| `availability.date_in_past` | 422 | Escolha uma data a partir de hoje. | inline; volta à escolha de data |
| `availability.beyond_horizon` | 422 | O prestador ainda não abriu a agenda para esta data. Escolha uma data mais próxima. | inline; volta à escolha de data |
| `availability.outside_working_hours` | 422 | Este horário está fora do expediente do prestador. | inline; recarrega os horários |
| `availability.closed` | 422 | O prestador não atende nesta data. | inline; volta à escolha de data |
| `availability.misaligned_start` | 422 | Este horário não é válido para a agenda do prestador. | inline; recarrega os horários |
| `availability.too_soon` | 422 | Este horário exige mais antecedência para ser reservado. | inline; recarrega os horários |
| `appointment.not_found` | 404 | Agendamento não encontrado. | página/inline |
| `appointment.slot_unavailable` | 409 | Este horário acabou de ser ocupado. Escolha outro. | inline; **recarrega os horários da data automaticamente** |
| `appointment.customer_overlap` | 409 | Você já tem um agendamento nesse horário. | inline; não recarrega |
| `appointment.concurrency_conflict` | 409 | Este agendamento foi alterado por outra pessoa. Veja o status atual. | inline; **recarrega o detalhe** |
| `appointment.precondition_failed` | 412 | Este agendamento foi alterado por outra pessoa. Veja o status atual. | inline; **recarrega o detalhe** |
| `appointment.invalid_transition` | 422 | Esta ação não é mais possível para o status atual do agendamento. | inline; recarrega o detalhe |
| `appointment.cancellation_window` | 422 | O prazo para cancelar pelo site terminou: este prestador exige antecedência mínima. Entre em contato com o prestador. | inline com os contatos do prestador; mantém o agendamento |
| `appointment.already_started` | 422 | Este atendimento já começou e não pode mais ser cancelado. | inline; recarrega |
| `appointment.not_started` | 422 | O atendimento ainda não começou. Só é possível concluí-lo após o horário de início. | inline |
| `idempotency.key_reused` | 422 | Não foi possível concluir a reserva. Revise os dados e confirme novamente. | inline; gera nova chave |
| `admin.cannot_deactivate_self` | 422 | Você não pode desativar a sua própria conta. | inline (a ação já fica indisponível na própria linha) |
| `http.error` | 4xx/5xx | Não foi possível concluir a solicitação. Código para suporte: {traceId} | inline com "Tentar novamente" (indica requisição malformada; não deve ocorrer em uso normal) |

## Erros sem `code` (`kind = 'network' | 'unknown'`)

| Situação | Mensagem | Comportamento |
|---|---|---|
| `status 0` (sem conexão / proxy fora) | Não foi possível conectar. Verifique sua internet e tente novamente. | inline com "Tentar novamente"; a reserva reutiliza a `Idempotency-Key` |
| `5xx` sem ProblemDetails | Algo deu errado do nosso lado. Código para suporte: {traceId ou "indisponível"} | inline; em navegação crítica, `/erro?trace=` |
