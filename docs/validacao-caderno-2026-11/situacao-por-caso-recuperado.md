# Situação por caso — recuperado do contexto do SuperTcL

**Origem:** este texto foi lido por mim (SuperTcL) do `resultado-parcial.md` em 26/11/2026, antes de o arquivo ser perdido. É transcrição verbatim da seção "Situação por caso", não reconstrução.

**Contagem conferida na época:** 42 parciais, 15 não executados, 5 bloqueados, 3 com divergência ou falha ao carregar. Zero aprovados.

---

Parcial indica observação incompleta; não representa aprovação. Os demais permanecem não executados. Perfis específicos, integração externa e massas adicionais dependem dos pré-requisitos do caderno.

- **CT-01 — Conferir ambiente e versão:** Parcial: commit e entradas confirmados; falta confirmar perfil Gestor PCM e sessão nova.
- **CT-02 — Entrar sair e recusar credencial inválida:** Não executado.
- **CT-03 — Navegar por função e abrir os atalhos:** Parcial: Chamados, Clientes, Planejamento e Visitas e Guia do SO abriram; retorno ao PCM funcionou. Sessão é Superadmin, não Gestor PCM; respeito aos acessos do perfil não foi testado.
- **CT-04 — Conferir a fronteira entre módulos:** Não executado.
- **CT-05 — Abrir a Visão 360 do Cliente:** Parcial: cliente, Resumo, Timeline, OS, Estrutura e abertura/fechamento de OS verificados; perfil específico pendente.
- **CT-06 — Pesquisar nome código e TAG com tipo explícito:** Parcial: nome, código, acentuação e vazio conferidos na sessão atual; perfil Gestor PCM pendente.
- **CT-07 — Filtrar os seis tipos da estrutura:** Parcial: filtros positivos conferidos para Área, Local, Sistema, Equipamento e Grupo Quantitativo; Cadastro pelo botão Novo componente criou válvula de teste; pesquisa por identificador a classificou como Equipamento e filtro Componente retornou vazio (DEF-28). Paginação pendente.
- **CT-08 — Navegar pela localização física:** Parcial: Área, Local e equipamento observados; trilha retornou à Área e ao Cliente; identificação por IDs e perfil pendentes.
- **CT-09 — Navegar por Sistema e conferir detalhes:** Parcial: sistema de teste vinculado à Bomba; pesquisa por nome retornou Sistema, navegação exibiu Bomba, detalhe confirmou Local e Sistema. Grupo de teste criado e histórico consultado. Detalhe do Sistema mostra Escritório, categoria Hidráulica, Área/Local de teste, Bomba vinculada e preventiva pausada; seção de OS abertas e histórico exibiu vazios. O grupo Luminárias apresenta três unidades, Área/Local e Sistema de teste; Ver grupo abriu histórico e navegar levou ao contexto do grupo. Histórico detalhado mostra IDs em vez dos nomes de Local, Categoria e Sistema (DEF-27). Planos e pendências no detalhe do grupo seguem pendentes.
- **CT-10 — Conferir a área de reconciliação:** Bloqueado na consulta: na Estrutura do Escritório, com Superadmin, não localizei uma área identificada como Conferência de integração Auvo; há mensagens genéricas de recursos indisponíveis. Ativação e acesso da jornada não foram confirmados; estados, histórico e item específico não testados.
- **CT-11 — Consultar o quadro de operação e os filtros:** Divergências observadas: ver DEF-01 e DEF-02. Na Lista, filtro Escritório + Fabrício retornou CH-2737 e CH-2676, ambos com seu nome; ao selecionar Preventiva, o filtro de técnico voltou sozinho a Todos (DEF-33). Busca direta de CH-HOMOLOG-PCM-02 com categoria Preventiva encontrou o registro esperado. Limpar filtros restaurou os padrões, inclusive Todos os clientes. Teste integral e perfil pendentes.
- **CT-12 — Abrir um Chamado de teste:** Parcial: botão indisponível sem título; CH-3301 criado e persistente após recarga. Busca por CH-3301 retornou um único resultado; resumo e detalhe exibiram título, cliente, status aberto e data de abertura. Anotação interna fictícia foi salva e reapareceu ao reabrir o detalhe. Perfil Operador PCM e conferência de todos os campos previstos continuam pendentes. Detalhe exibe sucessivos avisos técnicos de recursos desativados: ver DEF-30.
- **CT-13 — Recusar salto direto para Finalizado no quadro:** Parcial com Superadmin: OS PRE-A6C3B6A4 em Planejamento foi arrastada até Finalizado; a mensagem informou que validação PCM é necessária e a OS permaneceu em Planejamento após atualizar. Reabertura de OS finalizada de teste e perfil Gestor PCM pendentes. Evidência: `pcm-salto-finalizado.png`.
- **CT-14 — Consultar Backlog de escopo e prioridade:** Parcial: a aba Backlog abriu fila GUT com Cliente "Todos", incluindo OS de Planejamento; confirmar se é painel alvo do caderno. Ver OBS-10. A OS de teste foi confirmada como chamado CH-3302 e o filtro Escritório mostrou três registros do cliente nas páginas carregadas; duas pendências de inspeção fictícias geradas como backlog também apareceram no Kanban em Solicitação; ver DEF-21. A jornada de composição por escopo do caderno segue sem confirmação.
- **CT-15 — Compor e liberar escopo de teste:** Parcial: INSP-0044 recebeu dois itens fictícios Não conforme; selecionados e gerados em backlog com GUT 1/1/1, ambos constam No backlog e aparecem com Origem: Inspeção. Revisão não identifica os itens (DEF-20); PRE-1B4ECBDB e PRE-C0748047 também apareceram na lista de OS e em Solicitação no Kanban antes de Confirmar chamado (DEF-21). Confirmar chamado somente da segunda pendência gerou CH-3303 em Solicitação com Origem: Inspeção; após atualizar a fila, o outro item ainda aparece Aguardando triagem. São dois registros separados, portanto isso não comprova liberação parcial de um escopo composto. A ação Planejar levou CH-3303 para Planejamento e abriu prévia de abertura no Auvo; Agora não foi selecionado, sem confirmar envio, e o Kanban mostrou CH-3303 em Planejamento enquanto PRE-C0748047 continuou em Solicitação. O formulário mostra prioridade divergente da fila (DEF-22). Vínculo de escopo composto não comprovado; esta geração pode ser fluxo diferente da composição descrita no caderno.
- **CT-16 — Conferir a OS de Campo a conciliar:** Parcial: fila e detalhe de CH-HOMOLOG-PCM-01 consultados. Consulta com Operador PCM não executada.
- **CT-17 — Conferir exceção de Visita não confirmada:** Parcial: exceção de visita, horário, zero tentativas e motivo conferidos após reabrir o monitor; perfil Gestor PCM pendente.
- **CT-18 — Conferir a Agenda como projeção da Visita:** Divergência observada: ver DEF-03. Consultas por dia/técnico e troca de semana executadas; perfil Gestor PCM pendente.
- **CT-19 — Validar o retorno de execução pelo PCM:** Não executado.
- **CT-20 — Consultar capacidade e trechos de deslocamento:** Parcial: consulta semanal do Escritório mostrou semana correta e vazio explícito de disponibilidade. Trecho e teste por técnico pendentes; Fabrício está inativo.
- **CT-21 — Executar a rodada específica de integração Auvo:** Bloqueado: Fabrício consta inativo e não está disponível como técnico na nova OS; nenhum envio realizado. Ainda faltam visita, gatilho, verificação no Auvo, reprogramação e contingência.
- **CT-22 — Localizar Diagnóstico Inicial como Inspeção:** Parcial: criado e localizado INSP-0044 para Escritório como Diagnóstico Inicial; perfil Inspetor e vínculos/histórico adicionais pendentes.
- **CT-23 — Criar e revisar uma Inspeção de teste:** Parcial: criado INSP-0044 e item; descrição persistiu ao alternar e reabrir. Mídia e exportação não validadas; PDF e XLS abrem diálogos de importação, não de exportação; ver DEF-04 e DEF-05. Visualmente, indicadores e botão PDF têm contraste reduzido (DEF-32).
- **CT-24 — Consultar Preventivas Planos e pendências:** Parcial: tela global mostrou plano Preventiva Extintores, alvo, recorrência de 24 meses, ocorrência pendente e histórico sem execução. No Escritório, criei preventiva de teste, consultei alvo, recorrência e ocorrência; DEF-15 registra data divergente. Também criei Plano de Manutenção e Rotina em rascunho e validei envio e devolução da revisão. Pendências por alvo e execução histórica seguem pendentes.
- **CT-25 — Conferir PMOC sem ativar a criação manual:** Parcial: consulta de contrato legado H2 em modo leitura mostrou vigência, responsável, ART pendente, equipamentos e cronograma. O botão Novo PMOC está visível; distinguir criação de contrato da criação manual de plano exigida no caderno. Nenhuma ação de criação executada.
- **CT-26 — Consultar relatórios de operação:** Parcial: Relatório do Dia carregou totais e técnicos; Relatório de Planejamento abriu com data padrão divergente, ver DEF-13. Relatório do Cliente gerado para Escritório exibiu inspeção de teste; Apontamento mostrou Fabrício no histórico mas não no filtro (DEF-14). Faltam comparação com massa e Laudo SPDA: tela abriu, mas não havia laudo do Escritório visível.
- **CT-27 — Abrir a entrada única e trocar o Cliente:** Parcial: seleção inicial exigida; lista de teste do Escritório apareceu na revisão 2; ao trocar para [TESTE E2E] Cliente 360 Cockpit A, a lista do Escritório deixou de aparecer e houve estado vazio. Troca com rascunho pendente.
- **CT-28 — Consultar os sete estados de materiais:** Parcial: sete estados encontrados positivamente por filtros: Levantada, Disponibilidade informada, Parcial, Indisponível, Aguardando aquisição, Dispensada e Concluída. Filtro de responsável Sinérgica também conferido. Perfil específico e demais etapas do roteiro pendentes; ver DEF-16.
- **CT-29 — Registrar uma lista e conferir revisão e histórico:** Parcial: lista foi criada, texto original, responsável Cliente e revisão 1 foram exibidos; Organizar linhas falhou e repetiu após nova tentativa. Ver DEF-11. Após informar disponibilidade, estado e histórico mostraram revisão 2 e evento de disponibilidade; o botão "Tentar informar novamente" apareceu durante processamento; a outra lista criada depois persistiu e apresentou formulário normal após recarregar. Concorrência pendente.
- **CT-30 — Consultar orçamento operacional da OS:** Parcial: detalhe da OS de teste exibiu falhas de consulta de orçamentos e oportunidades/listas autorizadas; ver DEF-12. Não havia orçamento de teste para conferir vínculos e revisão.
- **CT-31 — Dashboard e carteira comercial:** Parcial: dashboard carregou com vazios explícitos; pesquisa do Escritório retornou conta correta e abriu Cliente 360. Variação de período e filtros de conta, situação e etapa conferidos com a oportunidade fictícia; comparações completas e perfil Comercial pendentes.
- **CT-32 — Funil e motivo de perda:** Parcial: oportunidade de teste criada e persistente no Lead do Escritório; mudança de etapa e perda não verificadas. A automação de arraste falhou por indisponibilidade da janela para o controle; isso não prova defeito do sistema.
- **CT-33 — Proposta e regras de preço:** Bloqueado: botão Propostas da oportunidade leva a tela vazia, reproduzido após recarga; ver DEF-17.
- **CT-34 — Da proposta aceita ao contrato:** Não executado.
- **CT-35 — Configuração de funil e precificação:** Parcial: etapas e motivos de perda, parâmetros, nível técnico e catálogo carregaram; escrita reservada e perfil de leitura pendentes.
- **CT-36 — Dashboard financeiro e acesso de leitura:** Parcial: dashboard carregou com caixa, fluxo e previsto versus realizado; perfil de leitura não testado.
- **CT-37 — Categorias e contas bancárias:** Parcial: categorias consultadas, criadas categoria e subcategoria de teste. O seletor de categoria pai mostrou somente categorias raiz, impedindo terceiro nível pela interface. Conta bancária fictícia com saldo zero criada e reaberta: nome e saldo persistem, mas data de corte diverge entre cartão e edição (DEF-31). Movimentações e comparação de saldos pendentes.
- **CT-38 — Ciclo de lançamento, baixa e correção:** Não executado.
- **CT-39 — Comprovante e transferência entre contas:** Não executado.
- **CT-40 — Importação OFX e duplicidade:** Não executado.
- **CT-41 — Contas a receber e a pagar:** Parcial: Contas a Receber mostra 0% em atraso; visão Por cliente informa ausência de inadimplentes, mas Por faixa fica sem conteúdo ou estado vazio (DEF-18). Contas a Pagar carregou uma provisão vencida e exibiu 67 dias de atraso; apenas leitura. Testes com lançamentos reservados pendentes.
- **CT-42 — Contratos financeiros e custos de pessoal:** Parcial: Contratos mostrou "Nenhum contrato cadastrado"; Custos de Pessoal mostrou uma pessoa existente, consultada sem edição, com custo/hora divergente da divisão apresentada (DEF-23). Fabrício não apareceu na listagem observada; cadastro e histórico de custo de pessoa de teste pendentes.
- **CT-43 — DRE, rentabilidade e orçamento:** Parcial: DRE e orçamento carregaram; rentabilidade falhou, ver DEF-06. Comparação e filtros pendentes.
- **CT-44 — Impostos e fechamento mensal:** Parcial: configuração de impostos e provisões históricas carregaram; fechamento exibiu competências e estados. Nenhuma provisão ou alteração de fechamento realizada; efeitos e auditoria pendentes.
- **CT-45 — Cobrança e integrações de pagamento:** Parcial: régua e histórico carregaram com estados vazios explícitos; nenhum ponto criado ou envio executado. Integrações e fluxo completo pendentes.
- **CT-46 — Cockpit financeiro restrito:** Falha ao carregar mesmo como Superadmin; ver DEF-07. Restrição a outros perfis não testada.
- **CT-47 — Dashboard e consulta de conversas:** Parcial: dashboard e lista Inbox carregaram com a conta Superadmin. Nenhuma conversa real foi aberta ou alterada; cenários com conversa de teste pendentes.
- **CT-48 — Atendimento humano e devolução ao Zé:** Não executado.
- **CT-49 — Instagram Direct e limites do envio implementado:** Não executado.
- **CT-50 — Configuração, conhecimento e automações:** Parcial: abas IA, Operação, Conhecimento, Canal, Templates, Opt-outs, Tags, Personas, Agentes e Fluxos consultadas. Conhecimento vazio permaneceu vazio após preencher título e cancelar nova entrada; templates informaram ausência de conexão Meta WA. Nenhuma configuração ou automação alterada. Perfil de leitura pendente.
- **CT-51 — Alma do cliente e memória das conversas:** Parcial: no Escritório, Alma vazia e memória antiga sem resumo aparecem separadas; memória é descrita como somente leitura. Rascunho neutro cancelado preservou Alma vazia. Gravação/restauração, troca de cliente e perfil de leitura pendentes.
- **CT-52 — Indicadores Meta e origem dos números:** Bloqueado por falha de consulta, ver DEF-08; configuração da integração não confirmada.
- **CT-53 — Receita por campanha e falta de atribuição:** Bloqueado por falha de consulta, ver DEF-08; falta de massa e acesso alternativo não avaliados.
- **CT-54 — Sincronização de indicadores:** Não executado.
- **CT-55 — Equipes, funcionários e ferramentas:** Parcial: consultas de equipes, funcionários, catálogo, histórico de unidade e ferramentas por técnico carregaram; Cockpit mostra Em construção. Fabrício inativo não aparece na lista de atribuições; edição reservada e comparação de vínculos pendentes.
- **CT-56 — Roteiros de entrevista e cadastros auxiliares:** Parcial: roteiro de teste criado com duas perguntas, reaberto, cancelamento conferido e depois desativado; quatro catálogos consultados. Teste negativo com Financeiro sem PCM pendente.
- **CT-57 — Grupos, usuários e capacidades:** Parcial: Grupos exibiu vazio; Usuários listou contas e resumo de módulos; Capacidades mostrou perfis e vínculos, inclusive cinco perfis de homologação. Consulta de concessões falhou e repetiu no botão de recuperação (DEF-24). Não houve alteração de acesso; testes por perfil e comparação por cliente pendentes.
- **CT-58 — Entrada e isolamento do portal:** Não executado.
- **CT-59 — Consulta de serviço, documentos e comunicação:** Não executado.
- **CT-60 — Chamado do cliente e decisões com efeito financeiro:** Não executado.
- **CT-61 — Capacidade por cliente e ação sensível:** Não executado.
- **CT-62 — Revogação durante sessão ativa:** Não executado.
- **CT-63 — Troca de contexto, erro e recuperação:** Parcial: iniciado texto de lista sem salvar no Escritório; ao trocar para cliente E2E A, listas do Escritório sumiram e o segundo apresentou vazio; ao voltar, reapareceram duas listas e o rascunho estava vazio. Troca descartou rascunho sem aviso (DEF-25). Com modo Offline do DevTools e busca CH-3302, a opção anterior desapareceu sem mensagem de erro ou carregamento visível durante a observação; ao restaurar No throttling, o seletor e as duas listas do Escritório voltaram. Ver DEF-26; não foi medido tempo limite prolongado nem testada gravação offline.
- **CT-64 — Teclado, tabelas e tamanho de tela:** Parcial: árvore de acessibilidade do Monitor Auvo expõe nome da tabela e cabeçalhos compreensíveis; Escritório apresentou as duas exceções de teste visualmente. Busca e filtro de clientes receberam foco via Tab e Shift+Tab; pesquisa por Escritório retornou o cliente. Diálogo Novo cliente abriu e fechou com teclado sem gravar, mas foco não voltou ao acionador (DEF-19). A 400 px no DevTools, seletor e contadores do Monitor permaneceram visíveis, mas tabela exibiu só as colunas iniciais; rolagem horizontal não pôde ser verificada porque o controle retornou erro de janela na tentativa. Formulário e navegação completa em largura reduzida pendentes; emulação encerrada.
- **CT-65 — Primeira abertura e navegação entre módulos:** Parcial: na sessão existente, troca PCM → Comercial → Financeiro → PCM carregou áreas correspondentes e retornou ao Escritório; componente fictício continuou na lista. Sessão nova e medição de tempo pendentes.

---

## Títulos de defeitos que eu ainda tenho

Só os cabeçalhos; o corpo de cada um (passos, evidência, severidade) se perdeu com o arquivo.

- **DEF-18** — Contas a receber sem estado vazio na visão por faixa
- **DEF-19** — Foco não retorna ao acionador ao fechar Novo cliente
- **DEF-20** — Revisão de backlog não identifica as pendências
- **DEF-21** — Itens gerados da inspeção aparecem como Solicitação no Kanban antes da triagem
- **DEF-22** — Prioridade exibida diverge entre fila e edição
- **DEF-23** — Custo por hora apresentado 100 vezes maior que a divisão dos valores exibidos
- **DEF-24** — Concessões de capacidades não carregam
- **DEF-25** — Troca de cliente descarta rascunho de material sem aviso
- **DEF-26** — Busca de OS sem feedback durante conexão offline
- **DEF-27** — Histórico de grupo mostra identificadores internos em vez de nomes
- **DEF-28** — Componente cadastrado aparece como Equipamento na busca tipada
- **DEF-29** — Resumo 360 apresenta ativo local como atualização Auvo com ID null
- **DEF-30** — Detalhe do chamado sobrecarregado por avisos técnicos
- **DEF-31** — Data de corte da conta bancária aparece um dia antes na listagem
- **DEF-32** — Indicadores e botão PDF com pouco contraste em Inspeções
- **DEF-33** — Filtro de técnico é desfeito ao mudar categoria

**DEF-01 a DEF-17: não tenho os títulos.** Só as menções cruzadas que aparecem nos casos acima — DEF-01 e DEF-02 no CT-11, DEF-03 no CT-18, DEF-04 e DEF-05 no CT-23, DEF-06 no CT-43, DEF-07 no CT-46, DEF-08 nos CT-52 e CT-53, DEF-09 (Central de Materiais sem hierarquia visual), DEF-11 no CT-29, DEF-12 no CT-30, DEF-13 e DEF-14 no CT-26, DEF-15 no CT-24, DEF-16 no CT-28, DEF-17 no CT-33.

**DEF-10 não existia no arquivo.** A numeração pulava do 09 para o 11.

## Outras seções perdidas

O arquivo tinha 283 linhas e estas seções, das quais só sobreviveu a "Situação por caso": Ocorrências; Continuação — backlog, relatórios e Auvo; Continuação de 26/11 — preventivas e capacidade; Continuação — materiais em 26/11; Continuação — sete estados de materiais; Continuação — comercial e administração; Massa criada; Limite para simulação de permissões; e o corpo de DEF-18 a DEF-33.

## Massa de teste criada no ambiente

CH-3301, CH-3302, CH-3303, PRE-C0748047, PRE-1B4ECBDB, PRE-A6C3B6A4, INSP-0044, válvula/componente de teste, sistema de teste vinculado à Bomba, grupo de teste, preventiva de teste pausada, Plano de Manutenção e Rotina em rascunho, conta bancária fictícia com saldo zero, categoria e subcategoria de teste, oportunidade de teste no Lead do Escritório, roteiro de entrevista de teste (desativado).

## Capturas perdidas

As 15 imagens foram para 0 byte e não têm recuperação: `agenda-por-tecnico.png`, `central-materiais-usuario.png`, `financeiro-cockpit.png`, `financeiro-rentabilidade.png`, `inspecao-nao-avaliado.png`, `kanban-filtro.png`, `marketing-indicadores.png`, `marketing-receita.png`, `monitor-visita.png`, `pcm-backlog-gut.png`, `pcm-grupo-visual.png`, `pcm-materiais-linhas.png`, `pcm-salto-finalizado.png`, `relatorio-dia-data.png`, `relatorio-planejamento-data.png`. Precisam ser recapturadas quando o teste correspondente for refeito.
