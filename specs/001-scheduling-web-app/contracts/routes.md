# Contrato de UI — Rotas, Guards e Query Params

**Feature**: `001-scheduling-web-app` | Interface exposta ao usuário: as URLs públicas da aplicação (compartilháveis e usadas pelos testes E2E).

Guards funcionais:

- `authGuard`: exige sessão válida; caso contrário, vai para `/entrar?returnUrl=<url>`.
- `roleGuard(role)`: exige o perfil indicado; caso contrário, vai para `/sem-permissao`.
- `guestGuard`: um usuário autenticado que abre `/entrar` ou `/cadastro*` é levado à home do seu perfil.

Cada área é carregada sob demanda (`loadChildren`).

| URL | Tela | Guard | Query params / Notas | US / FR |
|---|---|---|---|---|
| `/` | Início / Busca de prestadores | — | `q`, `categoria` (enum), `cidade`, `ordem` (`nome` \| `-nome`), `pagina`, `itens` | US1 · FR-022 |
| `/prestadores/:providerId` | Página pública do prestador | — | `servico`, `data` (`yyyy-MM-dd`): seleção que mostra os horários na própria página | US1 · FR-023 |
| `/prestadores/:providerId/agendar` | Reserva (escolha → resumo → sucesso) | — (confirmar exige Customer) | `servico` (obrigatório), `data`, `horario` (startAt codificado), `reagendar` (appointmentId) | US3 · FR-024..031, FR-035 |
| `/entrar` | Login | `guestGuard` | `returnUrl` (caminho interno validado), `motivo=sessao-expirada` | US2 · FR-015..017 |
| `/cadastro` | Cadastro de cliente | `guestGuard` | `returnUrl` | US2 · FR-013 |
| `/cadastro/prestador` | Cadastro de prestador (assistente de 3 etapas) | `guestGuard` | `etapa` (`conta` \| `estabelecimento` \| `endereco`) | US2 · FR-014 |
| `/cliente` | → `/cliente/agendamentos` | auth + Customer | — | — |
| `/cliente/agendamentos` | Meus agendamentos | auth + Customer | `aba` (`proximos` \| `historico`), `status[]`, `de`, `ate`, `prestador`, `pagina` | US6 · FR-032 |
| `/cliente/agendamentos/:id` | Detalhe (cancelar, reagendar) | auth + Customer | — | US6 · FR-033..035 |
| `/cliente/perfil` | Meu perfil | auth + Customer | — | US6 · FR-036 |
| `/cliente/notificacoes` | Notificações | auth + Customer | `tipo`, `pagina` | US7 · FR-049 |
| `/prestador` | → checklist (se incompleto) ou `/prestador/agenda` | auth + Provider | — | US4 · FR-037 |
| `/prestador/primeiros-passos` | Checklist de configuração | auth + Provider | — | US4 · FR-037 |
| `/prestador/agenda` | Agenda (lista / dia / semana) | auth + Provider | `visao` (`lista` \| `dia` \| `semana`), `data`, `status[]`, `servico`, `pagina` | US5 · FR-044 |
| `/prestador/agendamentos/:id` | Detalhe (confirmar, cancelar, concluir) | auth + Provider | — | US5 · FR-045 |
| `/prestador/servicos` | Serviços (lista + formulário em diálogo) | auth + Provider | `ativos` (`todos` \| `sim` \| `nao`), `pagina` | US4 · FR-040 |
| `/prestador/expediente` | Expediente semanal (+ painel de afetados) | auth + Provider | — | US4 · FR-041, FR-043 |
| `/prestador/excecoes` | Exceções (+ painel de afetados) | auth + Provider | `de`, `ate`, `pagina` | US4 · FR-042, FR-043 |
| `/prestador/politica` | Política de reservas | auth + Provider | — | US4 · FR-039 |
| `/prestador/estabelecimento` | Meu estabelecimento (+ "Ver minha página pública") | auth + Provider | — | US4 · FR-038 |
| `/prestador/notificacoes` | Notificações | auth + Provider | `tipo`, `pagina` | US7 · FR-049 |
| `/admin` | → `/admin/usuarios` | auth + Admin | — | — |
| `/admin/usuarios` | Usuários | auth + Admin | `q`, `perfil`, `ativo`, `pagina` | US8 · FR-050..051 |
| `/admin/notificacoes` | Auditoria de notificações | auth + Admin | `status`, `agendamento`, `pagina` | US8 · FR-052 |
| `/admin/agendamentos` | Busca de agendamento por ID | auth + Admin | `id` | US8 · FR-053 |
| `/admin/agendamentos/:id` | Detalhe (confirmar, concluir, cancelar em nome de) | auth + Admin | — | US8 · FR-053 |
| `/admin/minhas-notificacoes` | Notificações do próprio Admin | auth + Admin | `tipo`, `pagina` | US7 · FR-049 |
| `/sem-permissao` | Sem permissão | — | — | FR-012, FR-020 |
| `/erro` | Erro inesperado | — | `trace` (traceId) | FR-012 |
| `**` | Não encontrado | — | — | FR-012 |

## Redirecionamento após login (FR-016)

1. Se houver um `returnUrl` válido (começa com `/`, não com `//`, e não aponta para `/entrar` ou `/cadastro`) **e** compatível com o perfil, vai para ele.
2. Senão, vai à home do perfil: Customer → `/cliente/agendamentos`; Provider → `/prestador` (que leva ao checklist ou à agenda); Admin → `/admin/usuarios`.

## Navegação por perfil

O cabeçalho mostra apenas os links do perfil atual. Para visitantes: Buscar, Entrar, Cadastrar-se e "Sou prestador". O link de notificações aponta para a rota da área do perfil.
