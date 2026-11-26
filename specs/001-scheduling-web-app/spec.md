# Feature Specification: Aplicação Web do Agendador Online (ScheduleManager Web)

**Feature Branch**: `001-scheduling-web-app`

**Created**: 2026-11-25

**Status**: Approved (2026-11-26)

**Input**: User description: "Aplicação web do Agendador Online (ScheduleManager Web) que consome a Web API REST já implementada (`/api/v1`): catálogo público de prestadores, reserva de horários pelo cliente, configuração e gestão de agenda pelo prestador, área do cliente, notificações e administração. A API é a fonte da verdade; necessidades sem suporte na API viram lacunas documentadas." (briefing completo em `prompt-frontend.md`)

---

## Visão Geral

Plataforma única de agendamento (marketplace, sem isolamento por organização). Prestadores de serviço (profissionais individuais, cada um com uma única agenda — salões, barbearias, clínicas, consultórios) publicam serviços e expediente; clientes encontram prestadores, consultam horários livres e reservam sozinhos. O serviço de agendamento existente impede *overbooking* e gera notificações (simuladas, canal e-mail).

- Idioma da interface: **pt-BR**; moeda **BRL**; datas no formato brasileiro `dd/MM/yyyy HH:mm`.
- Todo horário de agendamento é exibido **no fuso horário do prestador**, com indicação explícita do fuso sempre que ele diferir do fuso do dispositivo do usuário.

### Personas

| Persona | Como entra | Objetivo principal |
|---|---|---|
| **Visitante** | Sem conta | Descobrir prestadores, ver serviços e horários livres; entrar/cadastrar-se para reservar. |
| **Cliente** | Auto-cadastro | Reservar, acompanhar e cancelar seus agendamentos; manter o perfil; ver notificações. |
| **Prestador** | Auto-cadastro (já cria o estabelecimento) | Configurar estabelecimento, serviços, expediente, exceções e política; gerenciar a agenda. |
| **Admin** | Provisionado na implantação (sem auto-cadastro) | Ativar/desativar contas, auditar notificações, intervir em qualquer agendamento pelo identificador. |

---

## Clarifications

### Session 2026-11-25

- Q: Quando a sessão de 60 minutos estiver perto de expirar, a aplicação deve avisar o usuário antes? → A: Sim — aviso 5 minutos antes ("Sua sessão expira em 5 min — salve seu trabalho") com opção de entrar novamente; ao expirar, leva ao login com "Sua sessão expirou" e retorna à página depois.
- Q: No "Reagendar", em que ordem o cliente cancela o horário antigo e escolhe o novo? → A: Escolhe e revisa o novo horário primeiro; ao confirmar, a aplicação cancela o antigo e, em seguida, reserva o novo; se a reserva falhar, avisa que o antigo já foi cancelado e mantém a escolha de horários aberta.
- Q: Quando o checklist de configuração do prestador deve sumir da área dele? → A: Quando houver ≥ 1 serviço ativo e ≥ 1 dia com expediente; "Revisar política" é passo recomendado e opcional, que não bloqueia a conclusão.
- Q: Como o botão "Cancelar" do cliente deve se comportar, já que ele não sabe antes qual é a antecedência mínima de cancelamento do prestador? → A: Sempre visível em agendamentos Pendente/Confirmado ainda não iniciados, com aviso fixo de que o cancelamento está sujeito à antecedência mínima do prestador; a recusa é explicada após a tentativa.


### Session 2026-11-26

- Q: Onde aparecem agendamentos futuros já cancelados na área do cliente? → A: Em "Próximos", com o selo de estado; as abas dividem apenas pelo horário de início (Próximos = início a partir de agora; Histórico = início antes de agora), qualquer estado.
- Q: Como o cliente filtra por prestador, se a API não lista os prestadores com quem ele agendou? → A: O filtro é aplicado a partir de um agendamento ("Ver todos com este prestador", `?prestador=<id>`) e exibido como rótulo removível com o nome do prestador; não há lista suspensa.
---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descobrir prestadores e consultar horários livres (Priority: P1)

O visitante (ou cliente) busca prestadores por categoria, cidade e nome, abre a página pública de um prestador, vê descrição, contatos, endereço e serviços ativos, escolhe um serviço e uma data e vê os horários livres no fuso do prestador.

**Why this priority**: É a porta de entrada do marketplace e pré-requisito da reserva; sem ela não há demanda para os prestadores.

**Independent Test**: Com prestadores já cadastrados, um visitante sem conta consegue filtrar, abrir um prestador e ver a lista de horários de uma data — entrega valor de vitrine mesmo sem reserva.

**Acceptance Scenarios**:

1. **Given** existem prestadores ativos em várias categorias e cidades, **When** o visitante filtra por categoria "Barbearia" e cidade "São Paulo", **Then** a lista mostra apenas prestadores correspondentes, paginada, com nome, categoria, cidade e UF.
2. **Given** o visitante aplicou filtros, **When** copia o endereço da página e o abre em outra aba (ou usa "voltar" do navegador), **Then** os mesmos filtros, ordenação e página são restaurados.
3. **Given** o visitante está na página de um prestador com fuso diferente do seu dispositivo, **When** escolhe um serviço e uma data, **Then** vê os horários livres no fuso do prestador com o fuso indicado explicitamente (ex.: "horário de Manaus").
4. **Given** a data escolhida não tem expediente, está em férias ou está lotada, **When** a disponibilidade é consultada, **Then** é exibido o estado vazio "Sem horários nesta data" com sugestão de escolher outra data, sem mensagem de erro.
5. **Given** a data escolhida está além do horizonte de reserva do prestador, **When** a disponibilidade é consultada, **Then** é exibida mensagem amigável de que o prestador ainda não abriu a agenda para essa data.
6. **Given** o endereço aponta para um prestador inexistente ou desativado, **When** a página é aberta, **Then** é exibida a página "não encontrado" com caminho de volta à busca.
7. **Given** nenhum prestador corresponde aos filtros, **When** a busca é feita, **Then** é exibido estado vazio com opção de limpar filtros.

---

### User Story 2 - Cadastro, login e sessão (Priority: P1)

O visitante cria conta de cliente ou de prestador (assistente em etapas: conta → estabelecimento → endereço), ou entra com e-mail e senha. Após entrar, é levado à área do seu perfil (Cliente → Meus agendamentos ou à reserva em andamento; Prestador → Agenda; Admin → Usuários). A sessão dura 60 minutos, sem renovação automática; ao expirar, o usuário é levado ao login e, ao entrar de novo, retorna à página onde estava.

**Why this priority**: Toda ação além da vitrine depende de identidade e perfil.

**Independent Test**: Cadastrar um cliente e um prestador, sair, entrar novamente e verificar o redirecionamento por perfil e o comportamento de sessão expirada.

**Acceptance Scenarios**:

1. **Given** um visitante no cadastro de cliente, **When** informa nome, e-mail, senha e telefone válidos, **Then** a conta é criada, ele já fica autenticado e é levado a "Meus agendamentos".
2. **Given** um visitante no cadastro de prestador, **When** completa as etapas conta → estabelecimento → endereço, **Then** a conta e o estabelecimento são criados com política de reservas padrão e ele é levado à área do prestador com o checklist de configuração.
3. **Given** um e-mail já usado (com qualquer combinação de maiúsculas/minúsculas), **When** alguém tenta se cadastrar com ele, **Then** o campo e-mail mostra "Este e-mail já está em uso".
4. **Given** credenciais inválidas, **When** o usuário tenta entrar, **Then** vê mensagem genérica ("E-mail ou senha inválidos") que não revela se o e-mail existe.
5. **Given** um usuário autenticado com 5 minutos restantes de sessão, **When** esse momento chega, **Then** vê o aviso "Sua sessão expira em 5 min — salve seu trabalho" com a opção "Entrar novamente"; **and given** a sessão expirou, **When** realiza qualquer ação ou navegação protegida, **Then** é levado ao login com o aviso "Sua sessão expirou" e, após entrar, volta à página original.
6. **Given** um usuário autenticado reabre a aplicação na mesma aba/sessão do navegador, **When** a aplicação inicia, **Then** a sessão é validada e o usuário continua autenticado se ainda dentro da validade.
7. **Given** um usuário autenticado, **When** clica em "Sair", **Then** a sessão local é descartada e ele volta à vitrine pública.
8. **Given** um cliente autenticado, **When** tenta abrir uma página do prestador ou do admin, **Then** vê a página "Você não tem permissão".
9. **Given** o servidor rejeita campos do formulário de cadastro, **When** a resposta chega, **Then** cada mensagem aparece junto ao campo correspondente (incluindo campos aninhados como cidade do endereço).

---

### User Story 3 - Reservar um horário (Priority: P1)

O cliente escolhe serviço e data, escolhe um horário livre, revisa o resumo (prestador, serviço, duração, preço, data/hora no fuso do prestador, observações opcionais) e confirma. Se for visitante, é levado ao login/cadastro e retorna à mesma reserva com serviço, data e horário preservados. Meta: até 3 interações e menos de 2 minutos.

**Why this priority**: É o valor central do produto para clientes e prestadores.

**Independent Test**: Com um prestador configurado, um cliente conclui uma reserva e vê o status resultante; o horário some da disponibilidade.

**Acceptance Scenarios**:

1. **Given** um cliente autenticado escolheu serviço, data e horário, **When** confirma a reserva, **Then** vê a tela de sucesso deixando claro se o agendamento está **Pendente** (aguardando o prestador) ou **Confirmado** (auto-confirmação do prestador).
2. **Given** um visitante escolheu serviço, data e horário, **When** clica em "Reservar", **Then** é levado ao login/cadastro e, ao concluir, retorna ao resumo da reserva com as mesmas escolhas, podendo confirmar.
3. **Given** a reserva foi concluída, **When** a disponibilidade da mesma data é recarregada, **Then** o horário reservado e os que se sobrepõem a ele não aparecem mais.
4. **Given** o cliente clica duas vezes em "Confirmar reserva" ou a conexão falha e o envio é repetido, **When** as respostas chegam, **Then** existe exatamente **um** agendamento e o cliente vê uma única confirmação.
5. **Given** outro cliente ocupou o horário entre a consulta e a confirmação, **When** o cliente confirma, **Then** vê "Este horário acabou de ser ocupado" e a lista de horários da data é recarregada automaticamente.
6. **Given** o cliente já tem outro agendamento que se sobrepõe ao horário, **When** confirma, **Then** vê "Você já tem um agendamento nesse horário".
7. **Given** o horário deixou de ser válido (fora do expediente, dia fechado, antecedência mínima não atendida, além do horizonte, data passada, serviço ou prestador desativado), **When** o cliente confirma, **Then** vê uma mensagem específica do motivo e volta à escolha de horário.
8. **Given** o cliente digita observações, **When** ultrapassa 500 caracteres, **Then** o formulário impede o envio e mostra o limite.

---

### User Story 4 - Configuração do prestador (Priority: P1)

O prestador recém-cadastrado segue um checklist de configuração — cadastrar ao menos um serviço → definir o expediente semanal → revisar a política de reservas — até ter horários disponíveis. Também mantém o perfil do estabelecimento, cadastra exceções (feriados, férias, horários especiais) e acessa sua página pública.

**Why this priority**: Sem serviços e expediente não existe disponibilidade; a oferta é pré-requisito da reserva.

**Independent Test**: Um prestador novo cria um serviço, um expediente com intervalo de almoço e revisa a política; a página pública passa a exibir horários e o intervalo de almoço não aparece.

**Acceptance Scenarios**:

1. **Given** um prestador recém-cadastrado, **When** acessa sua área, **Then** vê o checklist com as etapas pendentes e o progresso; **and when** passa a ter ≥ 1 serviço ativo e ≥ 1 dia com expediente, **Then** o checklist deixa de aparecer, mesmo sem ter revisado a política.
2. **Given** o prestador definiu expediente de segunda a sexta 09:00–12:00 e 13:00–18:00, **When** um cliente consulta a disponibilidade de uma segunda-feira, **Then** nenhum horário começa ou atravessa o intervalo 12:00–13:00.
3. **Given** o prestador cadastra duas faixas sobrepostas no mesmo dia (ex.: 09:00–12:00 e 11:00–14:00) ou uma faixa com início ≥ fim, **When** tenta salvar, **Then** o erro aparece na própria faixa e nada é enviado ao servidor.
4. **Given** existem agendamentos futuros que ficam fora do novo expediente, **When** o prestador salva o expediente, **Then** a tela lista esses agendamentos (que não são cancelados automaticamente) com ações para abrir ou cancelar cada um.
5. **Given** o prestador cria férias (fechamento de dias inteiros) sobre datas com agendamentos, **When** salva a exceção, **Then** a tela lista os agendamentos afetados com as mesmas ações.
6. **Given** o prestador tenta criar exceção em data passada ou horário especial sobreposto a outro, **When** salva, **Then** vê mensagem específica do motivo.
7. **Given** o prestador tenta excluir um serviço que já foi agendado, **When** confirma a exclusão, **Then** é informado de que o serviço está em uso e recebe a opção de desativá-lo.
8. **Given** o prestador cadastra um serviço com nome já usado por outro serviço seu, **When** salva, **Then** o campo nome indica a duplicidade.
9. **Given** o prestador altera duração ou preço de um serviço, **When** abre o formulário, **Then** é avisado de que agendamentos existentes mantêm os valores do momento da reserva.
10. **Given** o prestador edita a política de reservas, **When** visualiza os campos, **Then** vê os tempos em unidades amigáveis (minutos/horas/dias) e o aviso de que mudanças valem apenas para novas reservas.
11. **Given** o prestador está em "Meu estabelecimento", **When** clica em "Ver minha página pública", **Then** abre a página pública do seu estabelecimento como os clientes a veem.

---

### User Story 5 - Gestão da agenda pelo prestador (Priority: P2)

O prestador vê sua agenda em lista e em calendário (dia/semana), com destaque para agendamentos pendentes; abre o detalhe (com contatos do cliente, serviço do momento da reserva, observações e linha do tempo) e confirma, cancela (com motivo) ou conclui agendamentos conforme o estado.

**Why this priority**: Operação diária do prestador; depende das histórias P1 para existir conteúdo.

**Independent Test**: Com agendamentos existentes, o prestador confirma um pendente, cancela outro e conclui um já iniciado, vendo os estados atualizados.

**Acceptance Scenarios**:

1. **Given** existem agendamentos na semana, **When** o prestador abre a agenda em calendário semanal, **Then** vê cada agendamento no seu horário (fuso do prestador), com os pendentes destacados de forma perceptível sem depender só de cor.
2. **Given** um agendamento Pendente, **When** o prestador confirma, **Then** o status passa a Confirmado e a linha do tempo registra a mudança.
3. **Given** um agendamento Confirmado que ainda não começou, **When** o prestador tenta concluí-lo, **Then** a ação não é oferecida; se forçada, é recusada com "O atendimento ainda não começou".
4. **Given** um agendamento Confirmado que já começou, **When** o prestador conclui, **Then** o status passa a Concluído.
5. **Given** um agendamento Pendente ou Confirmado ainda não iniciado, **When** o prestador cancela informando motivo (3–500 caracteres), **Then** o status passa a "Cancelado pelo prestador".
6. **Given** o mesmo agendamento aberto em duas abas, **When** a segunda aba tenta uma ação depois que a primeira já alterou o status, **Then** a segunda vê "Este agendamento foi alterado por outra pessoa" e o detalhe é recarregado com o status atual.
7. **Given** a agenda filtrada não tem agendamentos, **When** é exibida, **Then** mostra estado vazio adequado.

---

### User Story 6 - Área do cliente (Priority: P2)

O cliente acompanha seus agendamentos nas abas "Próximos" (início a partir de agora, qualquer estado, do mais próximo ao mais distante) e "Histórico" (início antes de agora), abre o detalhe com linha do tempo, cancela com motivo respeitando a antecedência mínima do prestador, usa "Reagendar" (cancelar + nova reserva, explicitamente) e mantém o perfil.

**Why this priority**: Autonomia do cliente após a reserva; reduz contato manual com o prestador.

**Independent Test**: Um cliente com reservas cancela uma com antecedência suficiente, tenta cancelar outra dentro da janela mínima e edita o perfil.

**Acceptance Scenarios**:

1. **Given** o cliente tem agendamentos futuros e passados, **When** abre "Meus agendamentos", **Then** vê "Próximos" ordenados pelo mais próximo e "Histórico" com os demais, ambos paginados.
2. **Given** um agendamento com início além da antecedência mínima de cancelamento, **When** o cliente cancela informando motivo, **Then** o status passa a "Cancelado pelo cliente".
3. **Given** um agendamento dentro da janela mínima de cancelamento, **When** o cliente abre o detalhe, **Then** a ação "Cancelar" está visível com o aviso "Cancelamentos estão sujeitos à antecedência mínima definida pelo prestador"; **and when** tenta cancelar, **Then** vê mensagem explicando a política do prestador e o agendamento permanece inalterado.
4. **Given** um agendamento já iniciado ou em estado final, **When** o detalhe é aberto, **Then** a ação de cancelar não é oferecida.
5. **Given** o cliente escolhe "Reagendar" num agendamento cancelável, **When** escolhe um novo horário e confirma no resumo (que mostra o horário atual, o novo e o aviso de que o atual será cancelado primeiro), **Then** o atual passa a "Cancelado pelo cliente" e o novo agendamento é criado; **and given** a nova reserva falha após o cancelamento, **Then** o cliente vê que o anterior já foi cancelado e continua na escolha de horários.
6. **Given** o cliente edita o perfil com um e-mail já usado por outra conta, **When** salva, **Then** o campo e-mail indica a duplicidade.

---

### User Story 7 - Caixa de notificações (Priority: P3)

Qualquer usuário autenticado vê suas notificações (criação, confirmação, cancelamento e lembrete de agendamento) como uma caixa de entrada paginada, filtrável por tipo, com link para o agendamento relacionado.

**Why this priority**: Complementar — as notificações são simuladas; a informação principal já está nas telas de agendamento.

**Independent Test**: Após criar e confirmar uma reserva, cliente e prestador veem as notificações correspondentes e abrem o agendamento a partir delas.

**Acceptance Scenarios**:

1. **Given** o usuário tem notificações, **When** abre a caixa, **Then** vê assunto, tipo, situação de envio e datas, da mais recente para a mais antiga.
2. **Given** uma notificação ligada a um agendamento, **When** o usuário clica no link, **Then** abre o detalhe daquele agendamento na sua área.
3. **Given** o usuário filtra por "Lembrete", **When** aplica o filtro, **Then** vê apenas notificações desse tipo.
4. **Given** o usuário não tem notificações, **When** abre a caixa, **Then** vê estado vazio.

---

### User Story 8 - Administração (Priority: P3)

O Admin lista e busca usuários (por perfil, situação, nome ou e-mail), ativa/desativa contas com confirmação, audita notificações (por situação de envio ou agendamento) e abre qualquer agendamento pelo identificador para confirmar, concluir ou cancelar — informando, no cancelamento, se age em nome do cliente ou do prestador.

**Why this priority**: Operação de suporte; volume baixo e usuários internos.

**Independent Test**: O Admin desativa um prestador e verifica que ele some da busca pública; abre um agendamento pela auditoria e o cancela em nome do cliente.

**Acceptance Scenarios**:

1. **Given** o Admin na lista de usuários, **When** desativa um prestador e confirma, **Then** o prestador aparece como inativo e deixa de constar na busca pública e de aceitar reservas.
2. **Given** a confirmação de desativação, **When** é exibida, **Then** explica as consequências (para prestador: some do catálogo e não aceita novas reservas).
3. **Given** a linha do próprio Admin, **When** a lista é exibida, **Then** a ação de desativar está indisponível com explicação.
4. **Given** a auditoria de notificações, **When** o Admin clica no agendamento de uma notificação, **Then** abre o detalhe daquele agendamento.
5. **Given** o Admin cancela um agendamento, **When** abre o formulário de cancelamento, **Then** precisa escolher "em nome do cliente" ou "em nome do prestador" e informar motivo; o status resultante corresponde à escolha.
6. **Given** o Admin informa um identificador inexistente na busca por ID, **When** busca, **Then** vê "Agendamento não encontrado".

---

### Edge Cases

- **Fuso horário**: prestador em fuso diferente do dispositivo → todos os horários exibidos no fuso do prestador com indicação explícita; a data escolhida para disponibilidade é interpretada no fuso do prestador; datas próximas à virada do dia (ex.: 23:30 em um fuso = dia seguinte em outro) aparecem no dia correto do prestador.
- **Mudança de fuso pelo prestador**: agendamentos existentes continuam exibidos corretamente pelo instante real, no novo fuso.
- **Horário de verão/mudanças de offset**: o horário escolhido é enviado exatamente como oferecido, sem recálculo local.
- **Concorrência**: horário ocupado entre consulta e confirmação; duas abas alterando o mesmo agendamento; prestador desativado enquanto o cliente está no meio da reserva.
- **Reagendamento parcial**: cancelamento aceito e nova reserva recusada (horário ocupado, sobreposição) → anterior permanece cancelado; cliente é informado e segue escolhendo; cancelamento recusado → nada é alterado.
- **Repetição de envio**: duplo clique e nova tentativa após falha de rede reutilizam a mesma tentativa de reserva; uma nova reserva (outra escolha) é uma nova tentativa.
- **Sessão**: expiração durante o preenchimento de um formulário longo (assistente de prestador, expediente) → aviso de sessão expirada e retorno à página após novo login; o usuário recebe aviso 5 minutos antes da expiração (FR-017a); conteúdo não salvo no momento da expiração é perdido.
- **Listas vazias**: busca sem resultados, prestador sem serviços ativos (página mostra "Este prestador ainda não oferece serviços"), agenda vazia, sem notificações, sem exceções.
- **Prestador sem expediente**: toda data retorna sem horários; o checklist continua indicando a pendência.
- **Falha de rede ou servidor**: mensagem com opção de tentar de novo; em erros inesperados, exibir código de rastreio para suporte.
- **Acesso negado**: rota de outro perfil acessada manualmente → página "sem permissão"; o servidor também recusa.
- **Agendamento de outro usuário**: abrir um identificador que não pertence ao usuário → "não encontrado" ou "sem permissão", conforme resposta do servidor.
- **Paginação além do fim**: página inexistente na URL → exibir a última página válida ou estado vazio com volta à primeira.
- **Filtros de período**: intervalo máximo de 366 dias e fim posterior ao início; violações indicadas no próprio filtro.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Gerais

- **FR-001**: O sistema MUST usar exclusivamente as operações, campos, estados e regras do contrato do serviço de agendamento existente (ver Apêndice A); qualquer necessidade sem suporte MUST ser registrada como lacuna, nunca contornada.
- **FR-002**: Toda a interface MUST estar em pt-BR, com valores em BRL e datas no formato `dd/MM/yyyy HH:mm`.
- **FR-003**: Todo horário de agendamento MUST ser exibido no fuso do prestador, com indicação explícita do fuso quando diferir do fuso do dispositivo.
- **FR-004**: Toda tela com dados remotos MUST tratar os estados carregando, vazio, erro e sucesso.
- **FR-005**: Botões de envio MUST ficar indisponíveis enquanto a solicitação está em andamento.
- **FR-006**: Erros de validação devolvidos pelo servidor MUST aparecer junto aos campos correspondentes (incluindo campos aninhados); erros de regra MUST ser traduzidos por código para mensagens pt-BR, usando a descrição do servidor como reserva; erros inesperados MUST exibir o código de rastreio.
- **FR-007**: Os formulários MUST validar no próprio formulário as mesmas regras do servidor (nome 2–120; e-mail válido ≤ 254; senha 8–128 com ao menos uma letra e um dígito; telefone em formato internacional com máscara brasileira; endereço com rua ≤ 200, número ≤ 20, complemento ≤ 100, bairro ≤ 100, cidade ≤ 100, UF de 2 letras, CEP de 8 dígitos com máscara `00000-000`; nome de exibição 2–120; descrição ≤ 2000; fuso escolhido de uma lista), mantendo o servidor como autoridade final.
- **FR-008**: Listas paginadas MUST oferecer navegação entre páginas e escolha de itens por página (1–100, padrão 20).
- **FR-009**: Estados de agendamento MUST usar os rótulos Pendente, Confirmado, Cancelado pelo cliente, Cancelado pelo prestador e Concluído, cada um com cor **e** ícone/texto distintos.
- **FR-010**: Categorias MUST ser exibidas como Beleza, Barbearia, Saúde, Odontologia, Terapia, Fitness, Bem-estar, Educação, Consultoria e Outros.
- **FR-011**: A interface MUST atender WCAG 2.1 AA (teclado, foco visível, rótulos, contraste, anúncio de erros) e ser responsiva com prioridade para celular, especialmente no fluxo de reserva.
- **FR-012**: Páginas de erro MUST existir para "não encontrado", "sem permissão" e "erro inesperado" (com código de rastreio).

#### Autenticação e sessão

- **FR-013**: Visitantes MUST poder se cadastrar como cliente (nome, e-mail, senha, telefone) e ficar autenticados imediatamente.
- **FR-014**: Visitantes MUST poder se cadastrar como prestador em assistente de etapas (conta → estabelecimento → endereço), com categoria obrigatória, e-mail de contato opcional (padrão: e-mail da conta) e fuso padrão `America/Sao_Paulo`.
- **FR-015**: Usuários MUST poder entrar com e-mail e senha; falhas MUST exibir mensagem genérica que não revela a existência do e-mail.
- **FR-016**: Após entrar, o sistema MUST redirecionar: Cliente → reserva em andamento ou "Meus agendamentos"; Prestador → Agenda (ou checklist, se incompleto); Admin → Usuários; quando houver página de retorno, MUST priorizá-la.
- **FR-017**: O sistema MUST considerar a sessão expirada ao fim da validade informada (60 minutos) ou ao receber recusa de autenticação do servidor, descartando a sessão e levando ao login com o aviso "Sua sessão expirou" e a página de retorno preservada.
- **FR-017a**: 5 minutos antes do fim da validade, o sistema MUST exibir aviso não bloqueante e acessível (anunciado a leitores de tela) "Sua sessão expira em 5 min — salve seu trabalho", com a opção "Entrar novamente" (novo login preservando a página atual); o aviso MUST ser exibido uma única vez por sessão e não renova a sessão.
- **FR-018**: A sessão MUST sobreviver a recarregamentos na mesma aba e ser descartada ao fechar o navegador/aba; ao iniciar, a aplicação MUST validar a sessão com o servidor.
- **FR-019**: "Sair" MUST descartar a sessão localmente.
- **FR-020**: Rotas e ações MUST ser ocultadas conforme o perfil, e acessos manuais a áreas de outro perfil MUST mostrar "sem permissão".
- **FR-021**: Credenciais e tokens MUST nunca ser registrados em logs ou expostos na URL.

#### Catálogo público

- **FR-022**: Visitantes e clientes MUST poder buscar prestadores ativos por categoria, cidade e texto no nome, ordenando por nome (A–Z / Z–A), com filtros, ordenação e página refletidos no endereço da página.
- **FR-023**: A página do prestador MUST exibir nome, descrição, categoria, contatos, endereço, fuso e serviços ativos (nome, descrição, duração, preço).

#### Reserva

- **FR-024**: O cliente MUST poder escolher serviço, data (de hoje em diante) e um horário livre e confirmar em até 3 interações.
- **FR-025**: O resumo antes da confirmação MUST mostrar prestador, serviço, duração, preço, data/hora no fuso do prestador e observações opcionais (≤ 500 caracteres).
- **FR-026**: O horário enviado na confirmação MUST ser exatamente o oferecido pela disponibilidade, sem recálculo.
- **FR-027**: Cada tentativa de reserva MUST ter um identificador único reutilizado em reenvios, garantindo um único agendamento; uma resposta de "já processado" MUST ser tratada como sucesso.
- **FR-028**: Visitantes que tentarem reservar MUST ser levados ao login/cadastro e retornar à reserva com serviço, data e horário preservados.
- **FR-029**: A tela de sucesso MUST indicar se o agendamento está Pendente ou Confirmado e oferecer acesso ao detalhe.
- **FR-030**: Em caso de horário ocupado, o sistema MUST avisar e recarregar automaticamente os horários da data; em caso de sobreposição com outro agendamento do cliente, MUST avisar sem recarregar; demais recusas de regra MUST exibir mensagem específica e voltar à escolha de horário.
- **FR-031**: Datas além do horizonte do prestador MUST resultar em mensagem amigável (o horizonte não é conhecido antecipadamente pela vitrine — ver Lacunas).

#### Área do cliente

- **FR-032**: O cliente MUST ver seus agendamentos em "Próximos" (início a partir de agora, qualquer estado, do mais próximo; cancelados aparecem com o selo de estado) e "Histórico" (início antes de agora, qualquer estado, do mais recente), com filtros por estado, período (máx. 366 dias) e prestador (aplicado a partir de um agendamento: "Ver todos com este prestador").
- **FR-033**: O detalhe do agendamento MUST mostrar prestador, serviço (nome, duração e preço do momento da reserva), data/hora, estado, observações, motivo de cancelamento e linha do tempo de mudanças (de/para, quem alterou, motivo, quando).
- **FR-034**: O cliente MUST poder cancelar agendamentos Pendente/Confirmado ainda não iniciados, informando motivo (3–500 caracteres). A ação MUST ficar visível em todos esses agendamentos (a janela mínima não é conhecida antecipadamente), acompanhada do aviso fixo "Cancelamentos estão sujeitos à antecedência mínima definida pelo prestador"; recusas por janela mínima MUST explicar a política e manter o agendamento inalterado.
- **FR-035**: "Reagendar" MUST levar o cliente à escolha de novo horário do mesmo prestador e serviço **antes** de qualquer cancelamento; o resumo MUST mostrar o horário atual e o novo, com aviso explícito de que, ao confirmar, o atual será cancelado primeiro e só então o novo será reservado. Na confirmação, o sistema MUST cancelar o atual (motivo pré-preenchido "Reagendamento solicitado pelo cliente", editável, 3–500 caracteres) e, somente se o cancelamento for aceito, reservar o novo.
- **FR-035a**: Se o cancelamento for recusado (ex.: janela mínima), o sistema MUST interromper o reagendamento sem reservar o novo e explicar o motivo. Se o cancelamento for aceito mas a nova reserva falhar, o sistema MUST informar claramente que o agendamento anterior já foi cancelado e manter a escolha de horários aberta para nova tentativa.
- **FR-036**: O cliente MUST poder ver e editar nome, e-mail e telefone.

#### Área do prestador

- **FR-037**: O prestador MUST ver um checklist de configuração com as etapas "Cadastrar serviço" → "Definir expediente" → "Revisar política (opcional)" enquanto não tiver **ao menos 1 serviço ativo e ao menos 1 dia com expediente**; o progresso MUST ser calculado apenas a partir desses dados do serviço, e o checklist MUST deixar de aparecer quando as duas condições forem atendidas (e reaparecer se deixarem de ser, ex.: todos os serviços desativados). "Revisar política" é recomendada, mas não bloqueia a conclusão.
- **FR-038**: O prestador MUST poder ver e editar dados do estabelecimento (nome de exibição, descrição, categoria, contatos, endereço, fuso) e abrir sua página pública.
- **FR-039**: O prestador MUST poder editar a política de reservas: auto-confirmação; passo da grade (5–60 min, múltiplos de 5); intervalo entre atendimentos (0–120 min, múltiplos de 5); antecedência mínima de reserva (0–7 dias); horizonte (1–365 dias); antecedência mínima de cancelamento (0–7 dias) — exibindo unidades amigáveis e o aviso de que vale só para novas reservas.
- **FR-040**: O prestador MUST poder listar (incluindo inativos, com filtro), criar, editar, ativar/desativar e excluir serviços (nome 2–100 único, descrição ≤ 1000, duração 5–720 min em múltiplos de 5, preço 0–99.999,99); exclusão de serviço já agendado MUST oferecer desativação.
- **FR-041**: O prestador MUST poder editar o expediente semanal (domingo a sábado, 1–10 faixas por dia, dia sem faixas = fechado), com validação local de início < fim, sem atravessar meia-noite e sem sobreposição; o salvamento substitui o expediente inteiro.
- **FR-042**: O prestador MUST poder listar (por período), criar e remover exceções: fechamento de dia(s) inteiro(s), fechamento parcial (com horário) e horário especial (com horário obrigatório), com motivo opcional ≤ 200 e período de no máximo 366 dias (`endDate − startDate + 1 ≤ 366`).
- **FR-043**: Após salvar expediente ou criar exceção, o sistema MUST listar os agendamentos futuros afetados (não cancelados automaticamente) com ações para abrir ou cancelar cada um.
- **FR-044**: O prestador MUST ver a agenda em lista e em calendário dia/semana, filtrável por estado, período e serviço, com destaque para pendentes.
- **FR-045**: O prestador MUST poder confirmar (Pendente), cancelar com motivo (Pendente/Confirmado, antes do início) e concluir (Confirmado, após o início) agendamentos; o detalhe MUST exibir e-mail e telefone do cliente.

#### Regras transversais de agendamento

- **FR-046**: As ações oferecidas MUST seguir a máquina de estados: Pendente → Confirmado (prestador, admin); Pendente/Confirmado → Cancelado pelo cliente (cliente respeitando antecedência, admin); Pendente/Confirmado → Cancelado pelo prestador (prestador, admin); Confirmado → Concluído (prestador, admin, só após o início); estados cancelados e concluído são finais.
- **FR-047**: Mesmo com a ação visível, recusas de regra do servidor MUST ser tratadas com mensagem específica.
- **FR-048**: Toda ação sobre um agendamento MUST referenciar a versão exibida; se o agendamento mudou nesse meio-tempo, o sistema MUST avisar "Este agendamento foi alterado por outra pessoa" e recarregar o detalhe.

#### Notificações

- **FR-049**: Todo usuário autenticado MUST ver suas notificações paginadas, filtráveis por tipo (Criado, Confirmado, Cancelado, Lembrete), com assunto, conteúdo, situação de envio, tentativas, datas e link para o agendamento.

#### Administração

- **FR-050**: O Admin MUST poder listar usuários filtrando por perfil, situação e texto (nome ou e-mail).
- **FR-051**: O Admin MUST poder ativar/desativar contas mediante confirmação que explica as consequências; a ação MUST estar indisponível na própria conta.
- **FR-052**: O Admin MUST poder auditar notificações filtrando por situação de envio (Pendente, Enviada, Falhou, Cancelada) e por agendamento, vendo tentativas, data agendada e data de envio.
- **FR-053**: O Admin MUST poder abrir um agendamento por identificador (digitado ou a partir da auditoria) e confirmar, concluir ou cancelar; no cancelamento MUST escolher em nome de quem (cliente ou prestador).
- **FR-054**: O sistema MUST NOT oferecer listagem geral de agendamentos nem criação de Admin (sem suporte no serviço).

### Key Entities

- **Usuário / Sessão**: identidade autenticada com nome, e-mail, perfil (Cliente, Prestador, Admin), vínculo opcional a cliente ou prestador, e validade da sessão.
- **Cliente**: nome, e-mail, telefone, data de criação.
- **Prestador (Estabelecimento)**: nome de exibição, descrição, categoria, contatos, endereço, fuso, situação (ativo/inativo) e política de reservas.
- **Política de reservas**: auto-confirmação, passo da grade, intervalo entre atendimentos, antecedência mínima de reserva, horizonte, antecedência mínima de cancelamento.
- **Serviço**: nome, descrição, duração, preço, ativo/inativo; pertence a um prestador.
- **Expediente semanal**: por dia da semana, lista de faixas início–fim no fuso do prestador.
- **Exceção de agenda**: tipo (fechamento ou horário especial), período de datas, horário opcional, motivo.
- **Horário livre**: início e fim oferecidos para um serviço numa data; não reserva nada.
- **Agendamento**: prestador, cliente, cópia do serviço no momento da reserva, início/fim, estado, observações, motivo de cancelamento, versão e linha do tempo de mudanças.
- **Mudança de estado**: estado anterior, novo estado, perfil que alterou, motivo, momento.
- **Notificação**: agendamento relacionado, tipo, canal (e-mail), assunto, conteúdo, situação de envio, tentativas, datas agendada/enviada/criada.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um cliente autenticado conclui uma reserva, da página do prestador à confirmação, em no máximo 3 interações principais e em menos de 2 minutos em 90% das tentativas de teste de usabilidade, inclusive no celular.
- **SC-002**: 100% das tentativas de reserva com duplo clique ou reenvio resultam em exatamente um agendamento.
- **SC-003**: 100% dos horários exibidos em testes com prestadores em fuso diferente do dispositivo correspondem ao horário local do prestador e mostram a indicação do fuso.
- **SC-004**: Um prestador recém-cadastrado completa o checklist (serviço, expediente, política) e passa a ter horários disponíveis em menos de 10 minutos.
- **SC-005**: Os 17 cenários de aceitação obrigatórios do briefing passam em testes ponta a ponta contra o serviço real em ambiente de desenvolvimento.
- **SC-006**: 100% das operações do contrato (34) têm ao menos uma tela ou fluxo consumidor (Apêndice A).
- **SC-007**: 100% dos códigos de erro do catálogo têm mensagem pt-BR específica; nenhum erro técnico em inglês é exibido ao usuário.
- **SC-008**: Telas de dados exibem conteúdo ou estado de carregamento em até 1 segundo em conexão comum, e listas paginadas respondem a mudança de página em até 2 segundos.
- **SC-009**: Auditoria de acessibilidade das telas críticas (busca, reserva, cancelamento, expediente) não aponta violações de nível A ou AA.
- **SC-010**: Em 100% dos casos de sessão expirada, o usuário volta à página original após novo login.

---

## Assumptions

- O serviço de agendamento (`/api/v1`) está pronto, estável e é a fonte da verdade; seu contrato (OpenAPI em `api/specs/001-online-scheduling-api/contracts/openapi.yaml`) foi conferido e contém as 34 operações listadas no Apêndice A.
- Front-end e serviço são servidos na mesma origem em produção (o serviço não libera acesso de outras origens); em desenvolvimento, um redirecionamento local cumpre esse papel. O serviço não será alterado.
- A sessão é mantida apenas durante a aba/sessão do navegador (descartada ao fechá-lo), equilibrando conveniência e risco de roubo de sessão em computadores compartilhados; justificativa técnica detalhada fica para o plano.
- Notificações são simuladas e apenas consultadas; não há marcação de "lida".
- Não existe recuperação de senha nem troca de senha; telas para isso não serão criadas.
- O calendário de reserva permite datas de hoje até 365 dias à frente (máximo possível do horizonte) e trata a recusa de horizonte com mensagem amigável.
- "Próximos" e "Histórico" são derivados apenas pelo horário de início em relação a "agora" (qualquer estado).
- A lista de fusos oferecida ao prestador contempla os fusos brasileiros em destaque e permite os demais fusos padrão.
- O Admin de desenvolvimento é provisionado pela implantação do serviço.
- Escolhas de tecnologia (bibliotecas de UI, testes, estrutura de pastas) seguem a constituição do projeto e serão decididas no plano.

## Dependências justificadas (Constituição §3.2)

| Pacote | Tipo | Justificativa | Detalhe |
|---|---|---|---|
| `@angular/cdk` | runtime | Acessibilidade WCAG 2.1 AA: foco preso em diálogos e anúncio a leitores de tela (FR-011, FR-017a) | research R2 |
| `postcss`, `autoprefixer` | dev | Exigidos pelo TailwindCSS 3.4, definido na constituição (§3.1) | research R2 |
| `openapi-typescript` | dev | Tipos derivados do contrato autoritativo (FR-001) | research R5 |
| `@playwright/test`, `@axe-core/playwright` | dev | 17 cenários E2E contra a API real (SC-005) e auditoria de acessibilidade (SC-009) | research R4 |
| `angular-eslint`, `eslint`, `typescript-eslint`, `prettier` | dev | Garantia automática do Art. III (sem `any`, sem valores mágicos) | research R14 |
| `jsdom` | dev | Ambiente de testes exigido pelo Art. IV.1 | research R3 |

## Lacunas e Perguntas para a Etapa de Clarify

1. **Sem renovação de sessão**: a sessão de 60 minutos expira mesmo em uso ativo. *Resolvido*: aviso 5 minutos antes (FR-017a); renovação continua sem suporte no serviço.
2. **Horizonte de reserva não público**: a vitrine não sabe até quando o prestador aceita reservas; o calendário não pode desabilitar datas além do horizonte com antecedência.
3. **Antecedência de cancelamento não visível ao cliente**: o cliente só descobre a janela mínima ao tentar cancelar. *Resolvido*: botão sempre visível com aviso fixo; recusa explicada (FR-034).
4. **Sem listagem geral de agendamentos para o Admin**: o Admin depende do identificador (digitado ou via auditoria de notificações).
5. **Sem criação de Admin e sem recuperação/troca de senha**.
6. **Sem reagendamento nativo**: "Reagendar" é cancelar + nova reserva. *Resolvido*: novo horário escolhido antes; cancelamento e reserva em sequência na confirmação (FR-035, FR-035a). O risco residual (horário novo ocupado no instante entre as duas operações) permanece.
7. **Checklist do prestador**: não há indicador do serviço de "configuração concluída". *Resolvido*: progresso inferido de serviço ativo + expediente; "revisar política" é opcional (FR-037).
8. **Conflitos entre o briefing e a constituição** (a constituição prevalece; confirmar no plano):
   - Biblioteca de UI: briefing sugere Angular Material; constituição define TailwindCSS + Lucide.
   - Testes unitários: briefing permite Vitest ou Jest; constituição exige Vitest + jsdom.
   - Testes E2E com Playwright exigem justificativa documentada (constituição proíbe dependências sem justificativa).
   - Localização do código: constituição citava `Frontend/` no Artigo II e `src/` no Artigo V. *Resolvido*: emenda 1.2.0 (Art. II.1 → `src/app/`).
   - Formatação/lint (ESLint + Prettier) não constam da matriz de tecnologia da constituição.
9. **Fuso ausente nas listas de agendamentos**: `AppointmentSummary` não traz `timeZoneId`. Para o prestador, o fuso é o do próprio perfil; para o cliente, a lista obtém o fuso pelo perfil público de cada prestador (operação #9), com cache. Para prestador desativado (`404`), exibe no fuso do dispositivo com indicação explícita. Ver R18 do research.
10. **Sem lista de prestadores do cliente**: a API não lista com quem o cliente já agendou. O filtro por prestador em "Meus agendamentos" é aplicado a partir de um agendamento (`?prestador=<id>`) e exibido como rótulo removível com o nome do prestador.

---

## Apêndice A — Matriz de Rastreabilidade (Operação do serviço → Tela → User Story)

> Incluída a pedido do briefing. As operações são dependência externa já existente, não decisão de implementação desta especificação.

| # | Operação | Tela / Fluxo | User Story |
|---|---|---|---|
| 1 | POST `/auth/register/customer` | Cadastro de cliente | US2 |
| 2 | POST `/auth/register/provider` | Cadastro de prestador (assistente) | US2, US4 |
| 3 | POST `/auth/login` | Login | US2 |
| 4 | GET `/auth/me` | Início da aplicação / validação da sessão | US2 |
| 5 | GET `/customers/me` | Meu perfil (cliente) | US6 |
| 6 | PUT `/customers/me` | Editar perfil (cliente) | US6 |
| 7 | GET `/customers/me/appointments` | Meus agendamentos (Próximos/Histórico) | US6 |
| 8 | GET `/providers` | Início / Busca de prestadores | US1 |
| 9 | GET `/providers/{providerId}` | Página do prestador; Reserva | US1, US3 |
| 10 | GET `/providers/me` | Meu estabelecimento; Política; Checklist | US4 |
| 11 | PUT `/providers/me` | Editar estabelecimento | US4 |
| 12 | PUT `/providers/me/booking-policy` | Política de reservas | US4 |
| 13 | GET `/providers/me/appointments` | Agenda (lista e calendário) | US5 |
| 14 | GET `/providers/{providerId}/services` | Página do prestador; Reserva | US1, US3 |
| 15 | GET `/providers/me/services` | Serviços; Checklist | US4 |
| 16 | POST `/providers/me/services` | Novo serviço | US4 |
| 17 | PUT `/providers/me/services/{serviceId}` | Editar serviço | US4 |
| 18 | DELETE `/providers/me/services/{serviceId}` | Excluir serviço | US4 |
| 19 | PATCH `/providers/me/services/{serviceId}/status` | Ativar/desativar serviço | US4 |
| 20 | GET `/providers/me/schedule` | Expediente; Checklist | US4 |
| 21 | PUT `/providers/me/schedule/working-hours` | Salvar expediente (+ afetados) | US4 |
| 22 | GET `/providers/me/schedule/exceptions` | Lista de exceções | US4 |
| 23 | POST `/providers/me/schedule/exceptions` | Nova exceção (+ afetados) | US4 |
| 24 | DELETE `/providers/me/schedule/exceptions/{exceptionId}` | Remover exceção | US4 |
| 25 | GET `/providers/{providerId}/availability` | Horários livres (página do prestador / reserva) | US1, US3 |
| 26 | POST `/appointments` | Confirmar reserva | US3 |
| 27 | GET `/appointments/{appointmentId}` | Detalhe do agendamento (cliente, prestador, admin) | US5, US6, US8 |
| 28 | POST `/appointments/{appointmentId}/confirm` | Confirmar agendamento | US5, US8 |
| 29 | POST `/appointments/{appointmentId}/cancel` | Cancelar agendamento; Reagendar; Afetados | US4, US5, US6, US8 |
| 30 | POST `/appointments/{appointmentId}/complete` | Concluir agendamento | US5, US8 |
| 31 | GET `/notifications/me` | Caixa de notificações (todos os perfis) | US7 |
| 32 | GET `/admin/users` | Usuários (admin) | US8 |
| 33 | PATCH `/admin/users/{userId}/status` | Ativar/desativar usuário | US8 |
| 34 | GET `/admin/notifications` | Auditoria de notificações | US8 |

## Apêndice B — Mapa de Telas (proposta)

- **Público**: Início/Busca (`/`), Página do prestador (`/prestadores/:id`), Reserva (`/prestadores/:id/agendar?servico=&data=`), Entrar (`/entrar`), Cadastro de cliente (`/cadastro`), Cadastro de prestador (`/cadastro/prestador`).
- **Cliente** (`/cliente`): Meus agendamentos, Detalhe do agendamento, Meu perfil, Notificações.
- **Prestador** (`/prestador`): Agenda (lista + calendário), Detalhe do agendamento, Serviços, Expediente, Exceções, Política de reservas, Meu estabelecimento, Notificações, Checklist de configuração.
- **Admin** (`/admin`): Usuários, Auditoria de notificações, Agendamento por ID, Notificações.
- **Erros**: Não encontrado, Sem permissão, Erro inesperado (com código de rastreio).

## Apêndice C — Cobertura dos Cenários Obrigatórios do Briefing

| Cenário do briefing (§7) | Coberto por |
|---|---|
| 1 Busca → prestador → horários com fuso | US1 #1, #3 |
| 2 Visitante → login → retoma reserva | US3 #2 |
| 3 Pendente/Confirmado; horário some | US3 #1, #3 |
| 4 Duplo clique → um agendamento | US3 #4 |
| 5 Horário ocupado → mensagem + recarga | US3 #5 |
| 6 Data sem expediente → vazio | US1 #4 |
| 7 Cancelamento do cliente / janela mínima | US6 #2, #3 |
| 8 Checklist + almoço fora da disponibilidade | US4 #1, #2 |
| 9 Faixas sobrepostas → erro local | US4 #3 |
| 10 Férias sobre agendamentos → afetados | US4 #5 |
| 11 Confirmar; concluir antes/depois do início | US5 #2, #3, #4 |
| 12 Duas abas → conflito | US5 #6 |
| 13 Sessão expirada → retorno | US2 #5 |
| 14 Cliente em rota de outro perfil | US2 #8 |
| 15 Admin desativa prestador / a si mesmo | US8 #1, #3 |
| 16 Admin cancela pela auditoria em nome de alguém | US8 #4, #5 |
| 17 Erros 400 nos campos certos | US2 #9, FR-006 |
