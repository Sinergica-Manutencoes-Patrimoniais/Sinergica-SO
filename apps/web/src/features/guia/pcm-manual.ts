export interface AssuntoManualPcm {
  id: string;
  titulo: string;
  resumo: string;
  palavrasChave: string;
  quando: string;
  passos: Array<{ titulo: string; texto: string }>;
  conferir: string[];
  duvidas: Array<{ pergunta: string; resposta: string }>;
  relacionados: string[];
}

/** E01-S164: conteúdo de operação conferido nos formulários atuais, sem dados reais. */
export const MANUAL_PCM: [AssuntoManualPcm, ...AssuntoManualPcm[]] = [
  {
    id: "inicio",
    titulo: "Começar o dia e escolher o fluxo",
    resumo: "Um roteiro para organizar a fila, planejar o campo e conferir o que foi entregue.",
    palavrasChave: "rotina Fabricio Fabrício novo abrir OS chamado backlog prioridade emergencia",
    quando:
      "Ao iniciar o expediente ou quando surgir uma demanda e você não souber por onde começar.",
    passos: [
      {
        titulo: "Faça a triagem do dia",
        texto:
          "Entre em PCM · Operação. No Dashboard, confira pendências e execução. Use Chamados para a fila geral; para tratar um condomínio, vá a Clientes e abra seu Cliente 360.",
      },
      {
        titulo: "Escolha o registro certo",
        texto:
          "Use Novo Chamado para registrar uma solicitação ainda em análise. Se ela já existe, abra seu detalhe e use Gerar OS ou Enviar ao backlog. Use Nova OS para cadastrar diretamente um trabalho conhecido. Para uma rotina recorrente, use um plano em Preventivas.",
      },
      {
        titulo: "Confira antes de duplicar",
        texto:
          "Busque o cliente e consulte OS abertas e histórico. O mesmo problema pode ter vindo do WhatsApp, do portal ou de uma inspeção. Acrescente informações ao registro existente quando for a mesma demanda.",
      },
      {
        titulo: "Planeje o que pode ser executado",
        texto:
          "Avalie a prioridade, confira local e alvo, tipo de tarefa, técnico e data. Depois de preparar a OS, confirme separadamente sua abertura no Auvo quando for encaminhar o trabalho ao campo.",
      },
      {
        titulo: "Feche o dia com evidência",
        texto:
          "Revise execução, histórico e pendências de sincronização. Consulte o Relatório do Dia e o Relatório do Cliente conforme a necessidade. Uma data planejada não comprova uma visita executada.",
      },
    ],
    conferir: [
      "Toda demanda está no cliente correto e tem uma descrição compreensível.",
      "O que ficou para depois tem prioridade e próximo passo definidos.",
      "O que foi enviado ao campo tem confirmação e vínculo Auvo conferidos.",
    ],
    duvidas: [
      {
        pergunta: "Chamado, OS, backlog e Auvo são quatro cadastros para o mesmo problema?",
        resposta:
          "Não é preciso abrir quatro registros. Chamado registra a solicitação; a OS organiza o trabalho que atende à demanda; backlog é a fila do que aguarda decisão ou planejamento; a tarefa Auvo é o registro usado na execução em campo. Prefira evoluir o registro existente e preservar o vínculo.",
      },
      {
        pergunta: "Como agir em uma emergência?",
        resposta:
          "Acione o procedimento de emergência da equipe e os responsáveis. Registre cliente, local, impacto e ação necessária, usando a categoria Atendimento Emergencial quando aplicável. Cadastrar uma OS não significa que alguém já recebeu ou confirmou o atendimento.",
      },
    ],
    relacionados: ["cliente-360", "chamados", "os", "backlog"],
  },
  {
    id: "cliente-360",
    titulo: "Trabalhar pelo Cliente 360",
    resumo:
      "O espaço de trabalho do condomínio: operação, ativos, histórico e relacionamento no mesmo contexto.",
    palavrasChave: "360 cliente resumo timeline filtro detalhes drawer navegacao abas mais",
    quando: "Quando você vai consultar, organizar ou cadastrar trabalhos de um único cliente.",
    passos: [
      {
        titulo: "Abra o cliente e confirme sua identidade",
        texto:
          "Em PCM · Operação → Clientes, busque por nome, cidade, contato, CNPJ ou ID Auvo e selecione o cadastro. Confira nome, endereço, situação e contato no cabeçalho antes de iniciar qualquer ação.",
      },
      {
        titulo: "Comece pelo Resumo",
        texto:
          "Confira os indicadores e as pendências. Em Operação, use Resumo para triagem, Timeline para acontecimentos, OS para trabalhos abertos e histórico, Preventivas para rotina recorrente e Inspeções/Assessment para diagnósticos.",
      },
      {
        titulo: "Use as ações rápidas",
        texto:
          "Novo chamado, Nova OS, Nova preventiva e Novo componente iniciam o cadastro no contexto desse cliente. Antes de salvar, confira o título e o local. Ações aparecem conforme a permissão do seu usuário.",
      },
      {
        titulo: "Abra detalhes sem perder o lugar",
        texto:
          "Selecione uma OS no Resumo, na Timeline ou em OS. O painel lateral mostra o detalhe e, quando houver, o Chamado associado. Feche pelo X ou Escape para voltar à lista. Nas preventivas, selecione a ocorrência ou use Ver plano.",
      },
      {
        titulo: "Encontre os ativos",
        texto:
          "No grupo Ativos, escolha Estrutura, Componentes, Sistemas, Ferramentas, Árvore ou Board. Estrutura representa os lugares; Árvore e Board ajudam a localizar os ativos; Componentes e Sistemas permitem consultar e cadastrar. Em telas menores, confira o menu Mais.",
      },
      {
        titulo: "Combine filtros e consulte os outros grupos",
        texto:
          "Componentes: nome/Identificador, categoria, posição, sistema, situação e sincronização quando disponível. Sistemas: nome/Identificador, categoria, posição e composição. Ferramentas: nome, categoria, alocação e período. Gestão e relacionamento reúne as áreas disponíveis ao seu acesso, como Comunicação, Comercial e Financeiro.",
      },
    ],
    conferir: [
      "O cliente do cabeçalho é o mesmo da demanda e dos ativos consultados.",
      "A contagem de visíveis e os filtros explicam o conjunto apresentado; use Limpar antes de concluir que um cadastro sumiu.",
      "Use a fila global em Chamados para comparar clientes e organizar a equipe; volte ao 360 para investigar um condomínio.",
    ],
    duvidas: [
      {
        pergunta: "Por que não vejo Início visita e Fim visita nas OS do 360?",
        resposta:
          "Esses registros marcam a jornada dos técnicos e são retirados das listas e indicadores de manutenção do Cliente 360. Para consultar horários, use Agenda do Técnico e Apontamento de Horas.",
      },
      {
        pergunta: "Uma aba ou ação não aparece. É erro?",
        resposta:
          "Confira o grupo e o menu Mais. Algumas áreas dependem de permissão de módulo; usuários de leitura não recebem ações de escrita. Se precisar executar uma ação ausente, peça ao administrador que confira seu acesso.",
      },
      {
        pergunta: "Qual a diferença entre a Timeline do cliente e a das preventivas?",
        resposta:
          "A Timeline do cliente reúne acontecimentos do condomínio. A Timeline dentro de Preventivas organiza as ocorrências do planejamento preventivo; alternar essa visão não muda de cliente.",
      },
    ],
    relacionados: ["chamados", "os", "estrutura", "componentes", "preventivas", "consulta-360"],
  },
  {
    id: "chamados",
    titulo: "Abrir e tratar um Chamado",
    resumo:
      "Registre a solicitação, reúna o contexto e encaminhe para OS ou backlog mantendo o histórico.",
    palavrasChave:
      "novo chamado abrir solicitacao sindico whatsapp portal gerar OS cancelar anotacoes",
    quando:
      "Quando chega uma solicitação e você ainda precisa entender, priorizar ou decidir a execução.",
    passos: [
      {
        titulo: "Procure a solicitação existente",
        texto:
          "Abra Chamados na navegação PCM ou consulte OS/histórico no Cliente 360. Se a mesma demanda já existe, abra o detalhe e registre a atualização; evite criar outra só porque o cliente telefonou novamente.",
      },
      {
        titulo: "Selecione Novo Chamado",
        texto:
          "Na fila geral, escolha o cliente. No Cliente 360, use Novo chamado e confirme o contexto do cabeçalho. Cliente e Título são obrigatórios.",
      },
      {
        titulo: "Escreva um título que localize o problema",
        texto:
          "Exemplo: Vazamento na tubulação — térreo da Torre A. Na Descrição, informe o que ocorreu, desde quando, o efeito observado e o que já foi tentado. Selecione o Local quando disponível e informe o Solicitante.",
      },
      {
        titulo: "Crie e confira o registro",
        texto:
          "Acione Criar Chamado. Confira a identificação CH, cliente e descrição na fila/detalhe. Um Chamado criado registra a solicitação; ele ainda não confirma uma tarefa no Auvo.",
      },
      {
        titulo: "Decida o próximo passo no detalhe",
        texto:
          "Use Gerar OS quando o trabalho já estiver definido: confira Tipo de tarefa, técnico responsável e data prevista e confirme. Use Enviar ao backlog quando precisar priorizar/aguardar planejamento; preencha Gravidade, Urgência e Tendência de 1 a 5. Consulte Anotações internas e histórico de atendimento para manter contexto.",
      },
      {
        titulo: "Acompanhe o vínculo",
        texto:
          "Depois de gerar a OS, confira o status e o trabalho associado. Continue no registro existente. Se a solicitação for cancelada, informe a justificativa no fluxo de cancelamento e anexe a evidência quando necessário.",
      },
    ],
    conferir: [
      "Cliente, local e solicitante corretos; título específico e descrição com contexto.",
      "Antes de Gerar OS, o tipo de tarefa representa o serviço pretendido.",
      "Após converter, confira a OS associada antes de tentar gerar novamente.",
    ],
    duvidas: [
      {
        pergunta: "Gerar OS está indisponível?",
        resposta:
          "A ação depende de permissão de escrita, Chamado aberto e dados de abertura carregados. Confira também se já foi convertido. Se não houver Tipo de tarefa disponível, peça a revisão do cadastro em PCM → Configurações → Tipos de Tarefa.",
      },
      {
        pergunta: "Por que Enviar ao backlog exige GUT?",
        resposta:
          "A fila precisa de uma prioridade comparável. Informe Gravidade (impacto), Urgência (prazo para agir) e Tendência (piora com o tempo). O botão só libera com os três fatores preenchidos.",
      },
      {
        pergunta: "Posso usar Anotações internas como instrução ao técnico?",
        resposta:
          "Use-as para o contexto de gestão. A instrução de execução deve estar na OS e ser conferida na prévia de abertura Auvo. Não presuma que uma anotação interna foi enviada ao aplicativo do técnico.",
      },
    ],
    relacionados: ["os", "backlog", "auvo"],
  },
  {
    id: "os",
    titulo: "Abrir OS e encaminhar ao campo",
    resumo: "Cadastre o trabalho no PCM, planeje a execução e confira a abertura no Auvo.",
    palavrasChave:
      "abrir OS nova ordem servico gerar tecnico data agendar tipo tarefa prioridade auvo",
    quando:
      "Quando o serviço está definido. Se já existe Chamado para a demanda, prefira Gerar OS no próprio detalhe.",
    passos: [
      {
        titulo: "Parta do cliente ou da solicitação",
        texto:
          "No Cliente 360, use Nova OS para um trabalho conhecido. Na tela global Chamados/Operação, use Nova OS e confira o cliente selecionado. Se houver um Chamado aberto para esse problema, use Gerar OS nele para preservar o histórico.",
      },
      {
        titulo: "Descreva o trabalho",
        texto:
          "Preencha Título e Descrição com problema, local e orientação executável. Exemplo: Inspecionar vazamento junto à bomba de recalque 01, verificar conexão e registrar causa e correção. Na abertura global, confira também Origem e Solicitante quando exibidos.",
      },
      {
        titulo: "Classifique e localize",
        texto:
          "Escolha Categoria da OS, Tipo de tarefa e Local. Se disponível, selecione o Componente alvo do cliente. Categoria da OS classifica o trabalho (por exemplo Corretiva); categoria do Componente classifica o ativo (por exemplo HID).",
      },
      {
        titulo: "Avalie prioridade e planejamento",
        texto:
          "Confira Gravidade, Urgência, Tendência e, quando avaliada, Dor do cliente. Revise a prioridade sugerida. Defina Técnico responsável e Data prevista quando souber a execução. Tipo de tarefa é obrigatório ao informar técnico ou data. Sem técnico, o registro pode nascer como pré-triagem PRE, a ser confirmado depois.",
      },
      {
        titulo: "Salve e confira no PCM",
        texto:
          "Salve o formulário e localize o registro criado. Abra o detalhe e confira cliente, alvo, descrição, prioridade, técnico e data. Salvar a OS no PCM não confirma a abertura da tarefa Auvo.",
      },
      {
        titulo: "Confirme a abertura Auvo",
        texto:
          "Na tela global Chamados/Operação, abra o detalhe da OS e use Abrir OS Auvo quando disponível. A janela Abrir OS no Auvo? mostra a prévia e as pendências. Confira os Campos enviados e a Conferência PCM; use Confirmar abertura somente após revisar. Agora não fecha a prévia sem confirmar o envio.",
      },
      {
        titulo: "Confira a execução no destino",
        texto:
          "Após a confirmação, verifique o vínculo Auvo # e abra-o para conferir a tarefa. O contrato atual exibe técnico, data e local para conferência, mas não garante o envio desses campos: confirme a atribuição e a agenda no Auvo antes de considerar o despacho concluído. Acompanhe o retorno de execução e o histórico pelo PCM.",
      },
    ],
    conferir: [
      "A demanda tem uma única OS, vinculada ao Chamado quando houver.",
      "Título, orientação e alvo correspondem ao serviço; técnico e data foram revisados.",
      "Para o campo: há número Auvo e a tarefa/atribuição/agenda foram conferidas no destino.",
    ],
    duvidas: [
      {
        pergunta: "Mudar para Planejamento envia a OS ao técnico?",
        resposta:
          "A mudança de fase pode abrir a janela de conferência, mas a criação da tarefa exige Confirmar abertura. Se você fechou a janela, volte ao detalhe e use Abrir OS Auvo. Depois confira a tarefa e o responsável no destino.",
      },
      {
        pergunta: "Gerar título está desabilitado. Preciso da IA?",
        resposta:
          "Você pode preencher o título manualmente. A geração depende de IA configurada e de uma descrição suficiente; não é requisito para cadastrar a OS.",
      },
      {
        pergunta: "Apareceu PRE em vez de CH. Perdi o cadastro?",
        resposta:
          "PRE identifica uma pré-triagem ainda sem Chamado confirmado. Localize o trabalho no backlog, revise seu contexto e use Confirmar chamado quando decidir que a demanda deve seguir. Não recadastre para obter outro número.",
      },
      {
        pergunta: "Como editar depois?",
        resposta:
          "Abra o detalhe e use as ações disponíveis para seu usuário. Confira novamente prioridade, técnico e data após salvar. Verifique o estado da sincronização antes de presumir que a mudança chegou ao Auvo.",
      },
    ],
    relacionados: ["chamados", "backlog", "auvo", "componentes"],
  },
  {
    id: "backlog",
    titulo: "Priorizar o backlog e planejar",
    resumo: "Transforme pendências em uma fila de decisão e escolha o que vai para execução.",
    palavrasChave:
      "GUT GUTD gravidade urgencia tendencia dor cliente PRE confirmar chamado planejar",
    quando: "Quando há várias demandas ou uma manutenção ainda não tem execução definida.",
    passos: [
      {
        titulo: "Abra a fila de decisão",
        texto:
          "Na tela Chamados/Operação, use a aba Backlog. No Cliente 360, consulte as OS abertas do condomínio para entender o contexto antes de decidir.",
      },
      {
        titulo: "Revise os fatores",
        texto:
          "Avalie cada fator de 1 a 5. Gravidade: efeito do problema. Urgência: quanto pode esperar. Tendência: como piora se não for tratado. Dor do cliente, quando preenchida, registra o impacto percebido. Use os critérios da equipe e a prioridade sugerida; não aumente todos os fatores por padrão.",
      },
      {
        titulo: "Confirme a demanda quando necessário",
        texto:
          "Um registro PRE é pré-triagem. Abra o detalhe e use Confirmar chamado quando decidir que deve virar uma solicitação rastreável. Confira o número CH resultante antes de prosseguir.",
      },
      {
        titulo: "Prepare a execução",
        texto:
          "Use Planejar ou a ação de planejamento disponível. Revise Tipo de tarefa, técnico, data, local e orientação. Resolver dependências de material/acesso antes do despacho reduz visitas improdutivas.",
      },
      {
        titulo: "Verifique a passagem ao campo",
        texto:
          "Confira a nova fase e a agenda. Se a OS ainda não tem tarefa Auvo, revise a prévia de abertura e confirme o envio. Confira responsável e data no Auvo.",
      },
    ],
    conferir: [
      "A prioridade representa impacto e prazo reais, com justificativa no contexto.",
      "O planejamento define próximo passo, técnico e data quando conhecidos.",
      "Registro PRE não foi duplicado; fase no PCM e tarefa Auvo foram verificadas separadamente.",
    ],
    duvidas: [
      {
        pergunta: "A OS não aparece no backlog?",
        resposta:
          "Confira filtros, cliente e fase. Um trabalho com técnico/data ou já em planejamento/execução pode estar fora da fila de backlog. Procure também em Lista ou Kanban e não crie outro antes de localizar o original.",
      },
      {
        pergunta: "Qual o melhor formato para acompanhar?",
        resposta:
          "Lista facilita localizar e comparar; Kanban mostra fases; Timeline ajuda na sequência; Calendário organiza datas; Backlog concentra a triagem. Os filtros da visão escolhida podem ocultar trabalhos que continuam cadastrados.",
      },
    ],
    relacionados: ["os", "chamados", "auvo"],
  },
  {
    id: "estrutura",
    titulo: "Montar a Estrutura do cliente",
    resumo: "Organize os lugares antes de posicionar os ativos: Cliente → Área → Local → sublocal.",
    palavrasChave: "cadastro area torre local andar sala escadaria estrutura arvore importar excel",
    quando:
      "Ao preparar um condomínio novo ou corrigir onde um Componente/Sistema está localizado.",
    passos: [
      {
        titulo: "Confira o que já existe",
        texto:
          "Abra Cliente 360 → Ativos → Estrutura. Expanda a árvore e busque por nome/caminho; filtre tipo de nó, Área e presença de ativos. Os ancestrais ficam visíveis para contextualizar resultados.",
      },
      {
        titulo: "Cadastre a Área",
        texto:
          "Use a ação de nova Área e dê um nome reconhecível, como Torre A ou Garagem. Revise a sigla sugerida de três caracteres e salve. Evite criar outra Área para corrigir apenas uma grafia.",
      },
      {
        titulo: "Cadastre os Locais",
        texto:
          "Na Área correta, crie o Local. Use um Local pai para representar níveis: 1º andar → Escadaria. Confira nome, sigla e posição na árvore antes de salvar.",
      },
      {
        titulo: "Posicione o ativo no cadastro próprio",
        texto:
          "Depois vá a Componentes ou Sistemas e escolha Área/Local. Cliente é obrigatório; Área e Local são opcionais. Quando há Local, a Área vem desse Local. Não use o nome do Sistema para substituir um endereço físico.",
      },
      {
        titulo: "Confira por Árvore ou Board",
        texto:
          "Volte à Árvore para ver a organização hierárquica ou ao Board para localizar por Local. Se usar importação por planilha, primeiro revise a simulação e só aplique após conferir vínculos e alterações propostas.",
      },
    ],
    conferir: [
      "O caminho representa um lugar real do cliente e não um agrupamento funcional.",
      "Nome e sigla são consistentes com o padrão do condomínio.",
      "Área/Local selecionados pertencem ao mesmo cliente do ativo.",
    ],
    duvidas: [
      {
        pergunta: "Preciso cadastrar todos os andares antes de cadastrar Componentes?",
        resposta:
          "Não. É possível cadastrar o Componente apenas no Cliente ou na Área e completar a posição depois. Cadastre a estrutura suficiente para localizar o trabalho de forma inequívoca.",
      },
      {
        pergunta: "Mover de Local muda a etiqueta?",
        resposta:
          "O Identificador existente é preservado. Não espere que mover ou renomear a posição regenere o código. Alterar o Identificador é uma ação separada e pode exigir substituir etiquetas já impressas.",
      },
    ],
    relacionados: ["componentes", "sistemas", "identificador"],
  },
  {
    id: "componentes",
    titulo: "Cadastrar e editar Componentes",
    resumo:
      "Cadastre o ativo físico com categoria, posição e Identificador para rastrear manutenção e histórico.",
    palavrasChave:
      "cadastro itens ativo equipamento extintor bomba quadro nome categoria sigla identificador etiqueta",
    quando:
      "Ao incluir um ativo do cliente, como extintor, bomba ou quadro elétrico, ou completar um cadastro existente.",
    passos: [
      {
        titulo: "Pesquise antes de incluir",
        texto:
          "No Cliente 360 → Ativos → Componentes, busque nome ou Identificador. Combine categoria, Área/Local e Sistema, incluindo Sem sistema, para evitar duplicatas. A tela global Componentes serve para consultar vários clientes.",
      },
      {
        titulo: "Use Novo componente",
        texto:
          "Abra pelo atalho do cabeçalho ou pelo botão da aba. Confira o cliente e preencha Nome e Categoria. Use um nome que diferencie o ativo: Extintor 01 ou Bomba de recalque 01, em vez de apenas Manutenção.",
      },
      {
        titulo: "Defina a categoria e a posição",
        texto:
          "Selecione a categoria do catálogo. Nova categoria permite cadastrar outra quando necessário; confira o padrão existente antes. Escolha Área/Local quando conhecidos. Você também pode manter o ativo diretamente no Cliente ou na Área.",
      },
      {
        titulo: "Revise a etiqueta sugerida",
        texto:
          "No bloco Siglas faltando, revise os valores propostos e altere os que não servirem. Use Aplicar recomendações para preencher a prévia do Identificador. Para um código diferente, use Editar identificador. O cadastro só é concluído em Salvar.",
      },
      {
        titulo: "Salve e reabra para conferir",
        texto:
          "Confira observações e salve. Localize o Componente na lista, abra novamente e verifique categoria, posição e Identificador persistidos. Consulte o estado de sincronização; o nome e o código usados no Auvo devem ser conferidos no vínculo correspondente.",
      },
      {
        titulo: "Relacione ao Sistema quando fizer sentido",
        texto:
          "Abra o Sistema e edite sua composição para incluir o Componente. Cada Componente pode pertencer a no máximo um Sistema. Posição física e participação em Sistema são informações diferentes.",
      },
    ],
    conferir: [
      "O cadastro não duplica um ativo já existente.",
      "Nome identifica o ativo, categoria classifica e posição localiza.",
      "Identificador está correto antes de imprimir/usar a etiqueta; confira novamente após salvar.",
    ],
    duvidas: [
      {
        pergunta: "O formulário mostra Equipamento em outro lugar?",
        resposta:
          "No SO, o nome de uso do ativo é Componente. No Auvo, a entidade correspondente chama-se Equipment/Equipamento. Os nomes podem aparecer em integrações ou dados antigos; não cadastre outro ativo apenas por essa diferença.",
      },
      {
        pergunta: "Salvar retornou erro. O que faço?",
        resposta:
          "Mantenha o formulário aberto e leia a mensagem. Confira Categoria, Cliente, siglas válidas e conflito de Identificador. Corrija o campo e tente novamente; antes de repetir uma criação após falha de conexão, procure o ativo na lista.",
      },
      {
        pergunta: "Posso desativar um Componente que tem manutenção aberta?",
        resposta:
          "Confira as OS antes. O sistema verifica pendências e pode bloquear a desativação. Resolva o trabalho ou peça orientação ao responsável; não crie um substituto só para contornar o bloqueio.",
      },
    ],
    relacionados: ["identificador", "estrutura", "sistemas", "os"],
  },
  {
    id: "identificador",
    titulo: "Preencher o Identificador e conferir etiquetas",
    resumo:
      "Aceite ou ajuste as siglas recomendadas e preserve a rastreabilidade dos códigos já usados.",
    palavrasChave:
      "etiqueta QR code recomendacoes siglas GUA TOR PCI codigo identificador preencher editar",
    quando:
      "Quando o campo Identificador aparece vazio, há Siglas faltando ou você precisa corrigir uma etiqueta.",
    passos: [
      {
        titulo: "Complete os dados que formam o código",
        texto:
          "Informe Cliente, Nome e Categoria no cadastro de Componente/Sistema. Área e Locais entram no caminho quando selecionados. Sem esses dados mínimos, a prévia ainda não pode ser calculada.",
      },
      {
        titulo: "Revise as siglas de cada nível",
        texto:
          "O bloco Siglas faltando mostra sugestões de três caracteres. Exemplo: Guainumbí → GUA, Torre → TOR. Você pode trocar a sugestão antes de aplicá-la, respeitando os caracteres e a validação do campo.",
      },
      {
        titulo: "Aplique e confira a prévia",
        texto:
          "Clique em Aplicar recomendações e aguarde o cálculo. O Identificador deve aparecer no campo acima. O formato reúne Cliente, Área/Locais quando houver, Categoria, nome abreviado e sequência. Exemplo ilustrativo: GUA-TOR-A01-E01-PCI-EXT-01; o código real depende do cadastro e da sequência disponível.",
      },
      {
        titulo: "Substitua o código se necessário",
        texto:
          "Use Editar identificador para digitar outro. Na edição de cadastro, leia e confirme o aviso sobre etiquetas/QR Code antes de alterar. Um código existente não é substituído automaticamente por uma recomendação.",
      },
      {
        titulo: "Salve antes de usar a etiqueta",
        texto:
          "A prévia não substitui Salvar. Ao concluir, o sistema valida o cadastro e a unicidade; a sequência pode ser ajustada em caso de concorrência. Reabra o ativo para conferir o Identificador final antes de imprimir ou fixar etiquetas.",
      },
    ],
    conferir: [
      "Cada bloco representa o cliente, a posição e a categoria pretendidos.",
      "O código salvo é o mesmo que será usado na etiqueta.",
      "Se o código de um ativo existente mudou, avalie a substituição das etiquetas e a conferência no Auvo.",
    ],
    duvidas: [
      {
        pergunta: "As sugestões aparecem, mas o campo ainda está com um traço?",
        resposta:
          "Revise Nome, Cliente e Categoria, complete siglas inválidas e use Aplicar recomendações. Aguarde a prévia. Se continuar com traço, não imprima etiqueta: confira a mensagem de erro, tente reabrir o formulário e informe ao suporte o cliente/ativo e a ação que falhou.",
      },
      {
        pergunta: "Por que a sigla foi recusada?",
        resposta:
          "Ela deve ter três caracteres e seguir a validação do campo. Confira se foi apagada, ficou curta ou contém caracteres não permitidos. Quando houver conflito, escolha outra sigla conforme o padrão do cadastro.",
      },
      {
        pergunta: "Posso alterar o nome ou a posição sem refazer o código?",
        resposta:
          "Sim, o Identificador já existente permanece fixo. Se houver motivo para mudar a etiqueta, edite o Identificador explicitamente e confira o impacto antes de salvar.",
      },
    ],
    relacionados: ["componentes", "sistemas", "estrutura"],
  },
  {
    id: "sistemas",
    titulo: "Cadastrar Sistemas e sua composição",
    resumo: "Agrupe Componentes que funcionam juntos, sem confundir Sistema com localização.",
    palavrasChave: "novo sistema composicao vincular componente bomba hidraulico incendio PCI",
    quando:
      "Quando precisa acompanhar um conjunto funcional, como bombeamento ou prevenção e combate a incêndio.",
    passos: [
      {
        titulo: "Confira o conjunto existente",
        texto:
          "Abra Cliente 360 → Ativos → Sistemas. Busque nome/Identificador e filtre categoria, Área/Local ou composição vazia/não vazia. Verifique se já há Sistema para o mesmo conjunto.",
      },
      {
        titulo: "Cadastre o Sistema",
        texto:
          "Use Novo Sistema. Confira Cliente e Nome, escolha Categoria e informe descrição quando necessário. Selecione Área/Local quando o conjunto tiver posição definida, ou mantenha no Cliente.",
      },
      {
        titulo: "Revise o Identificador",
        texto:
          "Confira siglas, aplique recomendações e revise o código. Para outro código, use Editar identificador e leia o aviso na edição. Salve e confirme o cadastro na lista.",
      },
      {
        titulo: "Monte a composição",
        texto:
          "No detalhe/edição da composição, selecione Componentes do mesmo cliente e confirme. Um Componente já associado a outro Sistema aparece indisponível, com indicação do vínculo; revise a composição atual antes de transferir.",
      },
      {
        titulo: "Confira o conjunto e o histórico",
        texto:
          "Abra o detalhe do Sistema para consultar seus Componentes, posição e histórico disponível. Use o Sistema como alvo de preventiva quando a rotina se aplicar ao conjunto. O vínculo de composição é gerenciado no SO; não presuma que o Auvo reproduz a mesma hierarquia.",
      },
    ],
    conferir: [
      "Sistema representa uma função e Área/Local representa um lugar.",
      "Todos os Componentes pertencem ao mesmo cliente e a apenas um Sistema.",
      "Identificador e composição foram conferidos após salvar.",
    ],
    duvidas: [
      {
        pergunta: "Preciso colocar o Componente no mesmo Local do Sistema?",
        resposta:
          "Não necessariamente. Um Sistema pode atender Componentes distribuídos em posições diferentes do mesmo cliente. Preserve a localização real de cada ativo.",
      },
      {
        pergunta: "Por que o Componente não pode ser selecionado?",
        resposta:
          "Ele pode pertencer a outro Sistema. Consulte a indicação de vínculo e ajuste a composição de origem antes da transferência. Não duplique o Componente.",
      },
    ],
    relacionados: ["componentes", "identificador", "preventivas"],
  },
  {
    id: "preventivas",
    titulo: "Planejar e acompanhar Preventivas",
    resumo:
      "Diferencie o plano recorrente de cada ocorrência e consulte execução sem reescrever o passado.",
    palavrasChave:
      "preventiva calendario lista timeline plano recorrencia vencimento visita historico pausar",
    quando:
      "Quando a manutenção precisa se repetir por período ou quando você quer investigar um ciclo executado.",
    passos: [
      {
        titulo: "Abra Preventivas no cliente",
        texto:
          "No Cliente 360, escolha Preventivas ou use Nova preventiva. O cliente fica no contexto atual. A tela global Preventivas permite consultar vários clientes.",
      },
      {
        titulo: "Crie o plano recorrente",
        texto:
          "Use Novo plano. Preencha Nome, Tipo de alvo (Componente ou Sistema), Alvo, Questionário do Auvo, Tipo de tarefa do Auvo, Primeiro vencimento, A cada e Unidade (semanas/meses). Exemplo: inspeção mensal de uma bomba; revise a periodicidade técnica aprovada pela equipe antes de salvar.",
      },
      {
        titulo: "Escolha a visão de consulta",
        texto:
          "Lista facilita triagem; Timeline mostra sequência; Calendário distribui o planejamento por mês. As três visões mantêm o escopo do cliente. A última visão usada é lembrada neste navegador.",
      },
      {
        titulo: "Investigue uma ocorrência",
        texto:
          "Clique na ocorrência para ver plano, alvo, vencimento, visita, técnico, estado, resultado e vínculos disponíveis. Use Ver plano para consultar recorrência, próximas ocorrências e histórico. Uma ocorrência é um ciclo do plano, não um novo plano.",
      },
      {
        titulo: "Planeje e confira a visita",
        texto:
          "Quando a ação de agendamento/envio estiver disponível, confira técnico, data/hora e pendências antes de confirmar. Planejamento, disponibilidade no Auvo e resultado de execução são estados diferentes. Consulte a OS associada e o link Auvo quando houver.",
      },
      {
        titulo: "Altere a rotina preservando o histórico",
        texto:
          "Sem ocorrência materializada, Editar plano permite alterar os campos oferecidos. Depois da primeira materialização, alvo e recorrência ficam protegidos. Para iniciar outro ciclo estrutural, use Pausar e criar novo plano e confira os dados da cópia antes de salvar. Pausar não apaga o que já foi executado.",
      },
      {
        titulo: "Revise os resultados",
        texto:
          "No histórico, filtre período e resultado (Pendente, OK, Não OK). Consulte evidências completas no Auvo quando necessário. Para uma não conformidade que exige corretiva, use Enviar achado ao backlog quando a ação estiver disponível e revise a prioridade.",
      },
    ],
    conferir: [
      "Plano tem alvo e periodicidade corretos, sem duplicar rotina existente.",
      "Vencimento previsto, visita agendada e execução concluída não foram confundidos.",
      "Histórico e vínculos anteriores continuam acessíveis após a revisão do plano.",
    ],
    duvidas: [
      {
        pergunta: "Não consigo escolher um alvo ou questionário?",
        resposta:
          "Confira se o Componente/Sistema pertence ao cliente e se os catálogos Auvo estão disponíveis. Aguarde ou tente novamente no estado de erro. Se a integração indicar pendência de configuração/validação, peça ao administrador que a resolva antes de enviar.",
      },
      {
        pergunta: "Pausar desfaz uma tarefa já enviada ao Auvo?",
        resposta:
          "Não trate a pausa como cancelamento de tarefa já enviada. Confira as ocorrências e a OS/tarefa associada e use o procedimento apropriado para qualquer cancelamento. O histórico de execução deve permanecer rastreável.",
      },
    ],
    relacionados: ["sistemas", "componentes", "backlog", "auvo"],
  },
  {
    id: "ferramentas",
    titulo: "Alocar e devolver Ferramentas",
    resumo: "Controle o que está em uso no cliente e preserve o histórico de alocação.",
    palavrasChave: "ferramentas unidade kit emprestimo alocacao devolver tecnico periodo categoria",
    quando: "Ao disponibilizar ou recolher ferramentas da Sinérgica para um serviço ou condomínio.",
    passos: [
      {
        titulo: "Consulte as alocações do cliente",
        texto:
          "Abra Cliente 360 → Ativos → Ferramentas. Busque por nome e combine categoria, situação de alocação e período. Confira a diferença entre alocação ativa e devolvida.",
      },
      {
        titulo: "Confira a ferramenta disponível",
        texto:
          "Use Alocar ferramenta conforme sua permissão e escolha a ferramenta disponível. Confira o nome no seletor e confirme em Alocar. Não cadastre ferramenta como Componente do condomínio.",
      },
      {
        titulo: "Registre a devolução",
        texto:
          "Ao recolher, use Devolver na alocação correspondente. Confira o que foi retornado e se o estado passou para devolvida. O histórico continua disponível para consulta.",
      },
      {
        titulo: "Use o cadastro global quando necessário",
        texto:
          "No menu Ferramentas, gerencie o catálogo e as unidades/códigos. Em Ferramentas por Técnico, consulte a responsabilidade da equipe. O 360 concentra o vínculo com o cliente.",
      },
    ],
    conferir: [
      "A ferramenta selecionada é a correta; o cliente é o destino real.",
      "A devolução foi registrada no vínculo original e não só informada verbalmente.",
      "Filtros de situação/período permitem recuperar o histórico.",
    ],
    duvidas: [
      {
        pergunta: "Qual a diferença entre Ferramenta e Componente?",
        resposta:
          "Componente é um ativo do cliente que recebe manutenção. Ferramenta é um recurso da Sinérgica usado para executar o trabalho, com controle de disponibilidade e alocação.",
      },
      {
        pergunta: "Não achei uma ferramenta para alocar?",
        resposta:
          "Confira o cadastro global e a disponibilidade. Ela pode já estar em uso. Verifique as alocações e a visão por técnico antes de cadastrar uma duplicata.",
      },
    ],
    relacionados: ["cliente-360", "componentes"],
  },
  {
    id: "consulta-360",
    titulo: "Consultar diagnósticos e relacionamento no 360",
    resumo: "Leia Inspeções, Assessment, Comunicação e os recortes de gestão com o contexto certo.",
    palavrasChave:
      "inspecoes assessment laudo SPDA financeiro comercial comunicacao contato portal relatorio historico",
    quando:
      "Quando precisa entender o estado do condomínio, suas evidências e o histórico antes de decidir uma ação.",
    passos: [
      {
        titulo: "Consulte os diagnósticos",
        texto:
          "Em Operação → Inspeções, o 360 lista as inspeções e laudos SPDA disponíveis, com data e situação. Para criar, editar ou analisar o documento completo, use a tela global Inspeções ou Laudo SPDA. Consulte a data do documento antes de tratá-lo como retrato atual.",
      },
      {
        titulo: "Confira o Assessment vigente",
        texto:
          "A aba Assessment apresenta o documento de estado vigente do cliente e a contagem de achados já derivados para Chamado, backlog ou OS. Para cadastrar ou tratar o diagnóstico, vá a PCM → Assessment. Confira os vínculos existentes antes de abrir outra demanda para o mesmo achado.",
      },
      {
        titulo: "Revise o contato e a Comunicação",
        texto:
          "Em Gestão e relacionamento → Comunicação, confira telefone, e-mail, observações e mensagens vinculadas. As informações sobre o atendimento do cliente ajudam a contextualizar o trabalho; para operar a conversa, use Atendimento · Zé conforme sua permissão.",
      },
      {
        titulo: "Leia os recortes de gestão",
        texto:
          "Financeiro no 360 apresenta situação comercial e volume de OS por categoria, baseado no recorte recente informado pela tela. Esse volume não é faturamento nem saldo. Para recebimentos e valores, consulte o módulo Financeiro. Comercial aparece conforme o acesso e concentra os dados comerciais associados ao cliente.",
      },
      {
        titulo: "Produza o acompanhamento apropriado",
        texto:
          "Use a Timeline para reconstruir acontecimentos e as telas Relatório do Dia/Relatório do Cliente para acompanhamento operacional. Para acesso externo, Criar acesso ao portal é uma ação administrativa: confira o cliente e o destinatário e siga o formulário. O 360 interno e o portal do síndico têm finalidades e permissões diferentes.",
      },
    ],
    conferir: [
      "Data e situação do diagnóstico correspondem à decisão em análise.",
      "Achados existentes foram localizados antes de gerar outro trabalho.",
      "Indicadores operacionais não foram interpretados como receita, saldo ou comprovação financeira.",
    ],
    duvidas: [
      {
        pergunta: "Inspeções ou Assessment estão vazios?",
        resposta:
          "A ausência de um documento na aba não comprova que o condomínio está sem problemas. Confira o cadastro e a data na tela global, verifique filtros/acesso e peça confirmação ao responsável técnico quando necessário.",
      },
      {
        pergunta: "O Financeiro do 360 mostra tudo que o cliente pagou?",
        resposta:
          "Não. Esse painel é um recorte operacional de situação e volume de atendimento, não um extrato financeiro. Use o módulo Financeiro para consultar lançamentos e pagamentos com a permissão adequada.",
      },
      {
        pergunta: "O síndico vê o mesmo Cliente 360 que eu?",
        resposta:
          "Não. O Cliente 360 é a área interna de operação. O portal oferece ao cliente as informações autorizadas para seu próprio condomínio. Criar acesso ao portal não concede acesso interno ao PCM.",
      },
    ],
    relacionados: ["cliente-360", "chamados", "backlog", "auvo"],
  },
  {
    id: "auvo",
    titulo: "Resolver pendências e conferir sincronização",
    resumo: "Saiba o que verificar quando falta vínculo, envio ou retorno do Auvo.",
    palavrasChave:
      "erro sync sincronizacao auvo offline duplicado permissao falha suporte sem dados",
    quando:
      "Quando um dado não aparece no destino, a abertura fica pendente ou há mensagem de erro.",
    passos: [
      {
        titulo: "Diferencie cadastro, envio e execução",
        texto:
          "Salvar no PCM registra o trabalho local. Confirmar abertura inicia a tarefa Auvo. Check-in, fotos, formulário e encerramento são realizados em campo pelo Auvo e dependem de retorno da integração. Um desses passos não comprova os demais.",
      },
      {
        titulo: "Confira a identidade e os vínculos",
        texto:
          "No cliente, revise vínculo Auvo, endereço, contato e CNPJ nos indicadores de cadastro. Na OS, confira número e vínculo Auvo #. No ativo, confira Identificador e situação de sincronização quando exibida.",
      },
      {
        titulo: "Leia a pendência antes de repetir",
        texto:
          "Na abertura Auvo, corrija as pendências apresentadas na prévia. Se a tarefa já existe, abra o vínculo informado. Após uma falha de conexão, confira o registro existente antes de criar outro ou tentar enviar repetidamente.",
      },
      {
        titulo: "Use a saúde da integração",
        texto:
          "Consulte a saúde Auvo no Dashboard e os erros da OS/cadastro. Tente novamente quando a ação estiver disponível e a causa tiver sido corrigida. O retorno não é necessariamente imediato; atualize a consulta antes de concluir que houve perda.",
      },
      {
        titulo: "Peça suporte com contexto suficiente",
        texto:
          "Anote cliente, número do Chamado/OS ou Identificador do ativo, ação feita, mensagem exibida e horário aproximado. Informe se existe Auvo # e se o trabalho aparece lá. Isso ajuda a resolver sem recadastrar ou perder o histórico.",
      },
    ],
    conferir: [
      "Cadastro local foi localizado e não foi duplicado.",
      "Há confirmação do destino para considerar o envio concluído.",
      "Suporte recebeu registro, ação e erro exatos; nunca é necessário enviar sua senha.",
    ],
    duvidas: [
      {
        pergunta: "Uma seção não carregou, posso usar o restante?",
        resposta:
          "Leia o erro daquela seção e use Tentar de novo quando disponível. As áreas podem carregar separadamente. Evite tomar decisões com base em indicadores ainda carregando ou em mensagem de falha como se fosse uma lista vazia.",
      },
      {
        pergunta: "O botão está ausente, mas eu consigo consultar?",
        resposta:
          "Consulta pode estar liberada apenas em leitura. Peça ao administrador para conferir seu nível de acesso ao PCM. Permissão de leitura não permite criar/editar ou despachar trabalho.",
      },
      {
        pergunta: "Posso marcar finalizado só para a fila ficar limpa?",
        resposta:
          "Não. Confira execução e evidência, registre a situação verdadeira e use o fluxo de cancelamento quando o serviço não for realizado. A fase do registro orienta operação, relatórios e histórico do cliente.",
      },
    ],
    relacionados: ["os", "chamados", "preventivas", "cliente-360"],
  },
];
