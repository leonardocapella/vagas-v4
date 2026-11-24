/**
 * Vagas abertas da V4 Mendes.
 *
 * Para abrir, fechar ou editar uma vaga, mexa SÓ neste arquivo.
 * - `aberta: false` tira a vaga do ar sem apagar o texto (ela some da lista).
 * - A ordem aqui é a ordem que aparece na página.
 * - `id` vai para a planilha e para o link direto (?vaga=sdr). Não repetir e não mudar depois
 *   de divulgar, senão link antigo para de achar a vaga.
 */
window.VAGAS = [
  {
    id: "sdr",
    aberta: true,
    titulo: "SDR — Sales Development Representative",
    chamada: "Qualificar o lead que chega e marcar reunião para o time comercial.",
    local: "Presencial — Rua Hilário Ribeiro 214, Porto Alegre/RS",
    tipo: "CLT",
    senioridade: "Júnior",
    faixa: "A combinar — fixo + variável por meta",
    sobre:
      "O SDR é o primeiro contato da V4 com quem levanta a mão. Você recebe o lead que entra por " +
      "anúncio, formulário ou indicação, entende o momento da empresa, qualifica e agenda a reunião " +
      "com o closer. É uma posição de volume e de conversa: muita ligação, muito WhatsApp, CRM sempre em dia.",
    responsabilidades: [
      "Atender e qualificar os leads que chegam pelos canais da unidade",
      "Fazer as perguntas de qualificação e registrar tudo no CRM (Kommo)",
      "Agendar reuniões para o time comercial e confirmar presença",
      "Reativar lead antigo que não avançou",
      "Bater meta de reuniões agendadas e realizadas",
    ],
    requisitos: [
      "Comunicação clara, escrita e falada",
      "Organização para trabalhar com CRM e cadência de follow-up",
      "Vontade de trabalhar com meta e ser medido por número",
      "Disponibilidade para atuar presencialmente em Porto Alegre",
    ],
    diferenciais: [
      "Experiência anterior em pré-vendas, telemarketing, atendimento ou varejo",
      "Já ter usado algum CRM (Kommo, RD, HubSpot, Pipedrive)",
      "Noção de marketing digital e de como funciona uma agência",
    ],
  },
  {
    id: "bdr",
    aberta: true,
    titulo: "BDR — Business Development Representative",
    chamada: "Prospectar empresa que ainda não conhece a V4 e abrir a conversa.",
    local: "Presencial — Rua Hilário Ribeiro 214, Porto Alegre/RS",
    tipo: "CLT",
    senioridade: "Júnior",
    faixa: "A combinar — fixo + variável por meta",
    sobre:
      "O BDR trabalha o lead frio: monta a lista, encontra o decisor e abre a conversa com quem nunca " +
      "ouviu falar da V4. É prospecção ativa de verdade — cold call, cold mail, LinkedIn — com pesquisa " +
      "antes de cada abordagem. Se você gosta de caçar oportunidade e não trava no telefone, é esta.",
    responsabilidades: [
      "Montar e manter listas de empresas dentro do perfil de cliente ideal",
      "Prospecção ativa por telefone, e-mail e LinkedIn",
      "Encontrar e alcançar o decisor dentro da empresa",
      "Passar a oportunidade qualificada para o time comercial",
      "Manter a cadência de prospecção e o CRM atualizados",
    ],
    requisitos: [
      "Não travar no telefone — a vaga é de prospecção ativa",
      "Texto bom e direto para e-mail e LinkedIn",
      "Resiliência: a maior parte do contato frio dá não",
      "Disponibilidade para atuar presencialmente em Porto Alegre",
    ],
    diferenciais: [
      "Experiência em prospecção ativa, outbound ou vendas externas",
      "Já ter trabalhado com cadência (Apollo, Sellbird, Reev, Meetime ou similar)",
      "Conhecer o mercado de agências e serviços B2B",
    ],
  },
];
