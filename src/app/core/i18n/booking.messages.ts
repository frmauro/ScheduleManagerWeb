/** Textos pt-BR da reserva (US3, R12). */
export const BOOKING_MESSAGES = {
  pageTitle: 'Reservar · ScheduleManager',
  title: 'Reservar horário',
  backToProvider: 'Voltar ao prestador',
  steps: {
    label: 'Etapas da reserva',
    choose: 'Escolha o horário',
    review: 'Revise e confirme',
    done: 'Pronto',
  },
  chooseTitle: (serviceName: string) => `Escolha um horário para ${serviceName}`,
  serviceMissingTitle: 'Escolha um serviço',
  serviceMissingDescription:
    'O serviço escolhido não está disponível. Escolha outro na página do prestador.',
  chooseService: 'Escolher serviço',
  summary: {
    title: 'Resumo da reserva',
    provider: 'Prestador',
    service: 'Serviço',
    duration: 'Duração',
    price: 'Preço',
    when: 'Data e horário',
    notesLabel: 'Observações',
    notesHint: 'Algo que o prestador deva saber antes do atendimento.',
    notesCounter: (count: number, max: number) => `${count}/${max} caracteres`,
    changeSlot: 'Trocar horário',
    confirm: 'Confirmar reserva',
    submitting: 'Reservando…',
    loginNotice:
      'Para confirmar, entre ou crie sua conta de cliente. Suas escolhas serão mantidas.',
    onlyCustomers: 'Somente clientes podem fazer reservas. Entre com uma conta de cliente.',
  },
  success: {
    pendingTitle: 'Reserva enviada — aguardando confirmação do prestador',
    pendingDescription:
      'O prestador ainda precisa confirmar. Você será avisado quando isso acontecer.',
    confirmedTitle: 'Agendamento confirmado',
    confirmedDescription: 'Está tudo certo. Te esperamos no horário marcado.',
    viewAppointment: 'Ver agendamento',
    myAppointments: 'Meus agendamentos',
  },
} as const;
