# Validação do Caderno Sinérgica SO — reconstrução parcial

Reconstruído em 26/11/2026 após perda do relatório original. Este arquivo contém apenas informações presentes no contexto disponível; não substitui o original. Cliente de teste: Sinérgica - Escritório. Sessão usada: Superadmin. Testes por perfil específico não foram comprovados. As capturas locais originais foram perdidas; recapturar as evidências visuais indicadas. Não foi feita alteração de código.

## Defeitos recuperados

**Evidência visual:** as capturas locais do relatório foram perdidas. Salvo indicação contrária, os passos abaixo foram observados pela interface e precisam de nova captura. Onde falta detalhe, está explicitado; não presumir causa.

### DEF-01 — Filtros não restringem coluna Preventivas do Kanban
Em Chamados, selecionar Escritório e buscar uma OS de teste. O Kanban continuou exibindo itens de outro cliente na coluna Preventivas, apesar do filtro. A Lista apresentou o resultado buscado. Recapturar; não se determinou a causa.

### DEF-02 — Chamado aparece na Lista e não no Kanban
Buscar CH-3301 na Lista e alternar para Kanban: o registro apareceu na Lista, mas não no Kanban. Recapturar e verificar filtros/status aplicáveis.

### DEF-03 — Agenda e Monitor apresentam horário/período divergentes
Reteste em 26/11/2026: PCM > Planejamento e Visitas, semana 23 a 28/11, mostra para CH-HOMOLOG-PCM-02 do Escritório, em 25/11, “Tarde”, tanto Por dia quanto Por técnico. PCM > Monitor Auvo, selecionando Escritório, mostra para a mesma OS uma “Visita não confirmada” com coluna Visita em 25/11/2026 às 20:42:27. O cadastro de homologação já existia; nenhum dado foi modificado. A agenda não mostrou horário exato, e a causa da divergência não foi determinada; verificar regra de turno e fuso. O exemplo usa técnico de homologação preexistente, não Fabrício; o perfil Gestor PCM não foi testado. Captura original perdida, recapturar. Acima está evidência nova; não há certeza de ser exatamente o mesmo detalhe que originou a redação perdida do DEF-03.

### DEF-04 — Inspeção
Conteúdo específico perdido, refazer o teste CT-23. A captura anterior inspecao-nao-avaliado.png foi perdida; o nome não prova o defeito.

### DEF-05 — Botões PDF e XLS de Inspeções abrem importação sem indicar isso
Em Inspeções, selecionar INSP-0044 e clicar PDF: abre “Importar Relatório PDF”; XLS abre “Importar Relatório XLS (Auvo)”. Os rótulos não indicam importação. Nenhum arquivo foi enviado. A disponibilidade de exportação da inspeção não foi confirmada. Recapturar.

### DEF-06 — Rentabilidade não carrega
Em Financeiro > Rentabilidade, com Superadmin, a interface mostra “Falha ao carregar rentabilidade”; “Tentar novamente” reproduziu o erro. Causa não determinada. Recapturar.

### DEF-07 — Cockpit financeiro não carrega
Cockpit financeiro falhou mesmo na sessão Superadmin. Mensagem e passos mais detalhados perdidos; repetir CT-46 e recapturar. Acesso de outros perfis não testado.

### DEF-08 — Indicadores e receita por campanha falham ao consultar
Marketing > Indicadores e Receita por campanha falharam na consulta. Mensagens e detalhes originais perdidos; repetir CT-52/53 e recapturar. Configuração da integração não foi comprovada.

### DEF-09 — Central de materiais sem apresentação adequada; avisos genéricos em grupos
No Cliente 360 > Estrutura do Escritório, Central de materiais mostrou filtros e ações como texto corrido, sem distinção visual adequada. Grupo Quantitativo mostrou avisos genéricos repetidos de recurso indisponível. Em Ver Grupo pela pesquisa, o diálogo exibiu dois avisos idênticos sem nomear os recursos e não mostrou quantidade, Local e Sistema que aparecem no cartão. A imagem enviada pelo usuário também mostrou a central sem estilo; cópia local perdida. Recapturar. Recurso desativado por si só não é defeito.

### DEF-10 — Número ausente
O relatório original saltava esse número. Não há evidência suficiente para concluir se foi apenas salto ou se um defeito se perdeu; não atribuir conteúdo inventado.

### DEF-11 — Organizar linhas de materiais falha
Na lista de materiais de teste da OS CH-3302, clicar “Organizar linhas”: “Não foi possível consultar as linhas”. “Tentar novamente” repetiu o erro; texto original e revisão permaneciam visíveis. Causa não determinada. Recapturar.

### DEF-12 — Consultas de orçamento falham no detalhe da OS
Detalhe da OS de teste apresentou falhas de consulta de orçamentos e oportunidades/listas autorizadas. Não havia orçamento de teste para conferir vínculos e revisão. Mensagens exatas perdidas; repetir CT-30 e recapturar.

### DEF-13 — Data padrão em relatório
Relatório de Planejamento abriu com data padrão divergente. Valores e circunstâncias exatos perdidos; refazer CT-26 e comparar fuso/data local antes de concluir causa. Recapturar.

### DEF-14 — Fabrício ausente no filtro de Apontamento de Horas
Apontamento mostrou Fabrício no histórico, mas ele não apareceu no filtro de técnico. Funcionário consta inativo no cadastro sincronizado do Auvo. Não se estabeleceu se o filtro deveria incluir inativos; confirmar regra e recapturar.

### DEF-15 — Data de preventiva divergente entre calendário e detalhe
No Escritório, criar plano de teste para Bomba Técnica com primeiro vencimento informado 26/11/2027: detalhe e ocorrência mostraram 25/11/2027, antes e após pausa/reabertura. Timeline mostrou 26/11/2027 às 00:00 e, no mesmo cartão, vencimento 25/11; calendário posicionou no dia 26 e, ao abrir, detalhe informou 25/11. Recorrência mensal; plano pausado, técnico não atribuído e OS não criada. Nenhuma visita confirmada. Não se verificou data no banco nem causa; recapturar.

### DEF-16 — Registro posterior em lista concluída
Ocorreu divergência ao tentar registro posterior na lista de materiais Cliente concluída. Resultado exato perdido, refazer teste CT-28/29 em lista fictícia sem presumir comportamento ou causa. Recapturar.

### DEF-17 — Propostas abre tela vazia
No Funil, abrir oportunidade fictícia do Escritório, acessar Cliente 360 > Comercial > Propostas. A área da aplicação fica vazia, sem menu ou mensagem; reproduzido após recarregar e repetir. Recarregar recuperou a página inicial. Causa não determinada. Recapturar.

### DEF-18 — Contas a Receber: faixa sem estado vazio
Em Financeiro > Contas a Receber, Por cliente informou ausência de inadimplentes; Por faixa ficou sem conteúdo nem estado vazio. Recapturar.

### DEF-19 — Foco não retorna após fechar diálogo
Em Clientes, abrir Novo Cliente e fechar pelo teclado sem gravar: foco não voltou ao acionador. O mesmo ocorreu em Ver Grupo fechado com Escape; Tab retornou ao início do menu. Recapturar e verificar com leitor de tela.

### DEF-20 — Revisão de backlog não identifica itens
Em INSP-0044, selecionar duas não conformidades e Gerar backlog: o diálogo de revisão mostra blocos de GUT/esforço/embasamento sem descrição, sistema ou identificador de cada item. Árvore de acessibilidade também não apresentou identificação. Recapturar.

### DEF-21 — Pendências ainda em triagem aparecem no Kanban
Os itens fictícios de INSP-0044 foram gerados em backlog e ficaram “Aguardando triagem” com ação Confirmar chamado. Antes da confirmação, PRE-1B4ECBDB e PRE-C0748047 também apareceram na fila de OS e na coluna Solicitação do Kanban. Confirmar a regra esperada para essa jornada. Recapturar.

### DEF-22 — Prioridade divergente entre fila e formulário
No fluxo de CH-3303 gerado da inspeção, o formulário exibiu prioridade divergente da fila. Valores exatos perdidos; refazer CT-15 e recapturar, sem inferir qual é correto.

### DEF-23 — Custo/hora de pessoal divergente
Financeiro > Custos de Pessoal: consulta de uma pessoa existente mostrou custo/hora divergente da divisão apresentada. O título preservado pelo SuperTcL diz 100 vezes maior; valores exatos e identidade não preservados; repetir somente em leitura e recapturar, sem modificar pessoa.

### DEF-24 — Consulta de concessões falha
Em Grupos de Usuário > Capacidades, consulta de concessões falhou e repetiu no botão de recuperação. Nenhuma permissão alterada. Mensagem exata perdida; repetir e recapturar.

### DEF-25 — Troca de cliente descarta rascunho sem aviso
Na Central de materiais, iniciar texto sem salvar no Escritório, trocar de cliente e voltar: rascunho vazio, sem aviso observado. Listas persistidas reapareceram. Recapturar; conferir regra de preservação pretendida.

### DEF-26 — Busca offline sem erro visível
Na Central de materiais, com DevTools Offline, busca de CH-3302 fez a opção anterior desaparecer sem mensagem visível durante a observação; ao restaurar rede, seletor e listas voltaram. Não foi medido timeout prolongado nem testada gravação offline. Recapturar.

### DEF-27 — Histórico de grupo mostra IDs
Histórico detalhado do Grupo Quantitativo de teste mostrou identificadores no lugar de nomes de Local, Categoria e Sistema. Recapturar.

### DEF-28 — Componente classificado como Equipamento na busca
Criar componente fictício válvula pelo botão Novo componente; pesquisa por seu identificador retornou tipo Equipamento e filtro Componente ficou vazio. Exportação de estrutura o inclui na aba Componentes. Confirmar modelo e recapturar.

### DEF-29 — Resumo 360 apresenta ativo local como atualização Auvo com ID null
Título preservado pelo SuperTcL. No Resumo do Escritório, em Eventos recentes, foi observado “Ativos Auvo atualizados” e “Último equipamento no cache: #null”. Os passos e dados que demonstram a origem local do ativo foram perdidos; refazer essa comparação antes de concluir a causa. Recapturar.

### DEF-30 — Detalhe do chamado exibe avisos técnicos
Detalhe de CH-3301 exibiu seis avisos técnicos de flags/gates de recursos desativados, perceptíveis ao usuário. Textos exatos perdidos; recapturar.

### DEF-31 — Data de corte da conta diverge
Conta bancária fictícia de teste, saldo zero: cartão mostrou data de corte 24/11 e edição 25/11. Não foi feito lançamento ou transação. Recapturar; causa não determinada.

### DEF-32 — Contraste reduzido em Inspeções
No tema escuro, indicadores de inspeção têm baixo contraste e botão PDF aparenta estar desabilitado. Inspeção visual; nenhuma medição de contraste. Recapturar.

### DEF-33 — Filtro de técnico redefine ao mudar categoria
Em Chamados > Lista, filtrar Escritório e Fabrício: CH-2737 e CH-2676 apareceram com seu nome. Ao selecionar categoria Preventiva, o filtro de técnico voltou sozinho a Todos. Recapturar.

### DEF-34 — Mensagem de vazio enganosa
Em Chamados, uma combinação de filtros sem resultado exibiu “Nenhuma OS cadastrada ainda”, embora existam OS fora dos filtros. Recapturar.

### DEF-35 — Passagem para Validação PCM sem retorno comprovado
CH-3303, em Planejamento, sem técnico e sem OS Auvo, aceitou passagem direta para Validação PCM e permaneceu após atualização. Foi devolvida a Planejamento e a prévia Auvo dispensada sem envio. Confirmar regra de negócio para caminho manual; não prova conclusão ou execução real. Recapturar.

### DEF-36 — Inspeção em andamento descrita como trabalho realizado
Relatório do Cliente do Escritório incluiu INSP-0044, em andamento, como trabalho realizado. PDF exportado abriu. Confirmar regra do relatório; recapturar.

### DEF-37 — Exportação usa dados anteriores após alterar período

**Arquivos conferidos em 26/11/2026:** `/Users/lucasazevedo/Downloads/relatorio-sin-rgica-escrit-rio-2026-11-20.pdf` e `/Users/lucasazevedo/Downloads/relatorio-sin-rgica-escrit-rio-2026-11-26.pdf`, cada um com 45.155 bytes. O primeiro identifica período até 26/11 no conteúdo, apesar do nome 20/11; o segundo é evidência adicional da geração anterior. A captura da sequência foi perdida.
Gerar Relatório do Cliente até 26/11/2026, mudar fim para 20/11 e exportar sem regerar: arquivo recebeu nome com 20/11, mas conteúdo ainda correspondia ao período até 26/11. Após gerar novamente os dados atualizaram. Publicação e troca de cliente não testadas. PDF foi salvo em Downloads; disponibilidade atual precisa ser confirmada. Recapturar.

### DEF-38 — Período invertido aceito
Relatório do Cliente aceitou início 25/11/2026 e fim 20/11/2026, habilitando exportar/publicar. Não houve publicação. Período restaurado. Recapturar.

### DEF-39 — Colunas estreitas na planilha de estrutura

**Arquivo conferido em 26/11/2026:** `/Users/lucasazevedo/Downloads/estrutura-sinérgica---escritório-2026-11-26.xlsx`, 25.712 bytes. A captura visual da largura das colunas foi perdida; recapturar.
Excel exportado da estrutura do Escritório apresentou colunas estreitas e textos truncados nas abas de dados. Arquivo em Downloads foi aberto no Excel; reorganização acidental de aba foi descartada sem salvar. Recapturar e confirmar arquivo ainda disponível.

### DEF-40 — Contagem de OS abertas diverge
PCM > Clientes: carteira mostra 1 OS aberta para Escritório; Ver 360 > Resumo mostra 11 OS abertas e backlog 11; aba OS lista 11 sob Backlog. Após recarregar, carteira ainda 1 e 360 11. Confirmar se critérios deveriam ser iguais ou explicitados; causa não determinada. Recapturar.

### DEF-41 — Estado vazio de execução fala em planejamento
Relatório de Planejamento, Escritório, 26/11/2026, modo Execução: texto vazio “Nada planejado para este dia/técnico”. Não comprova perda de registros ou cálculo incorreto. Recapturar.

### DEF-42 — Texto da opção selecionada quase ilegível
Em INSP-0044 > Adicionar item, tema escuro e zoom 200%, opção selecionada Geral tinha texto azul escuro sobre fundo azul; ao selecionar Equipamentos, o mesmo baixo contraste transferiu-se para essa opção. Árvore de acessibilidade mostrou botões sem estado de seleção anunciado; leitor de tela e contraste não foram medidos. Formulário cancelado e zoom restaurado. Recapturar.

## Situação dos 65 casos

A transcrição abaixo foi preservada pelo SuperTcL antes da perda; reflete o estado naquele momento, e não incorpora necessariamente as observações posteriores deste documento.

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


## Massa de teste e limitações recuperadas

- CH-3301 chamado; CH-3302 OS matriz; CH-3303 pendência de inspeção em Planejamento; PRE-C0748047 aguardando triagem; INSP-0044 e dois itens fictícios Não conforme/No backlog.
- Estrutura fictícia Área Técnica, Sala Técnica, Bomba Técnica, Sistema Hidráulico, grupo Luminárias (3 unidades) e componente válvula. Preventiva Bomba pausada; Plano de Manutenção e rotina em rascunho. Não confirmar visita nem disparar Auvo enquanto Fabrício permanecer inativo.
- Listas fictícias CH-3302: Cliente concluída revisão 3; Sinérgica dispensada revisão 5. Oportunidade fictícia do Escritório em Lead. Categoria, subcategoria e conta bancária de teste com saldo zero; nenhum lançamento realizado nesta continuação.
- Sessão Superadmin não prova negação ou capacidades dos perfis Gestor PCM, Operador PCM, Financeiro, Inspetor ou cliente. Fabrício consta inativo no Auvo e não aparece selecionável como técnico. Não houve tarefa enviada ao Auvo.
- Dados marcados [TESTE CADERNO] foram deixados para decisão do dono. Registros [TESTE E2E] e [TESTE HOMOLOGAÇÃO] já existiam; não presumir sua autoria.
- CT-49: Atendimento > Config > Instagram mostrou zero conexões, com vazio explícito; Messenger e Meta WA também mostraram zero, em abas distintas. Integração bloqueada por ausência de canal e interlocutor de teste; nenhum envio efetuado.
- CT-23: filtros Equipamentos e Elétrico mostraram cada um seu item; Todos recuperou os dois, com estados preservados. Busca por INSP-0044 retornou vazio; campo anuncia busca por cliente ou título, por isso não foi registrado defeito.
- CT-38: Novo lançamento abre com status Realizado por padrão; formulário cancelado sem gravar. Competência aberta e valor de teste ainda aguardam definição.

## Evidências perdidas e próximas ações

Todas as capturas do diretório original foram perdidas. Refazer capturas dos defeitos acima e não tratar menções a arquivos de captura como prova existente. O usuário forneceu imagem da Central de materiais na conversa; verificar disponibilidade do anexo original, não da cópia local. Os relatórios PDF e a planilha em Downloads foram gerados, mas precisam ter existência e conteúdo conferidos antes de citá-los como evidência disponível. Situação por caso preservada foi anexada acima; atualizações posteriores permanecem identificadas separadamente.


## Atualização de testes após reconstrução — 26/11/2026

**CT-54 — Bloqueado na consulta e sincronização:** em Marketing > Indicadores, com Superadmin, após o carregamento apareceu “Não foi possível carregar os indicadores” e “Os números que já estavam na tela não foram alterados”. Clicar “Tentar de novo” reproduziu a falha. “Sincronizar 7 dias” permaneceu desabilitado; não se conseguiu conferir conta ativa nem última sincronização. Nenhuma sincronização foi iniciada e a configuração da conta Meta não foi comprovada. O perfil Marketing e janela de integração permanecem sem validação. Esta evidência complementa DEF-08; recapturar imagem.

**CT-49 — Bloqueado:** em Atendimento > Config, Instagram informou zero conexões e ausência de configuração; Messenger e Meta WA também apresentaram estados vazios próprios. Sem canal e interlocutor de teste, passos de envio e janela não foram executados. Nenhuma conexão ou mensagem criada.


## Triagem de veredictos — 26/11/2026

Esta triagem complementa a transcrição histórica, que continua intacta. “Reprovado” indica uma expectativa específica contrariada; etapas adicionais e perfis não ficam automaticamente validados. Os casos não listados ainda exigem exame para não transformarmos uma pendência executável em bloqueio artificial.

- **Reprovado:** CT-07 (DEF-28); CT-11 (DEF-01/33); CT-24 (DEF-15, datas divergentes); CT-26 (DEF-37); CT-33 (DEF-17); CT-43 (DEF-06); CT-46 (DEF-07); CT-52 e CT-53 (DEF-08); CT-57 (DEF-24). Consultas e perfis adicionais continuam conforme registro de cada caso.
- **Bloqueado:** CT-02 (credenciais válidas reservadas indisponíveis para sair e entrar); CT-04 (perfis Operador PCM e Financeiro); CT-10 (jornada de reconciliação não localizada/ativação não confirmada); CT-16 (Operador PCM para teste de permissão); CT-19 e CT-21 (Fabrício inativo, retorno Auvo e perfis exigidos); CT-34 (tela Propostas falha e janela de impacto financeiro); CT-48 (contato controlado e janela de envio); CT-49 (canal e interlocutor Instagram de teste); CT-54 (consulta de indicadores falha e configuração/janela Meta não confirmadas); CT-58–60 (conta de cliente-síndico e massa reservada, além de Operador no CT-60); CT-61 (Gestor e Operador e segundo cliente autorizado); CT-62 (usuário isolado, sessão e janela de revogação).
- **Aguardam passos executáveis ou apuração antes de veredicto:** CT-14/15 (identificar a jornada específica de composição de escopo), CT-32 (movimentação do cartão e perda com controle de arraste viável), CT-38–40 (massa e condições financeiras próprias), CT-63–65 (recuperação, acessibilidade e sessão). Outros casos seguem com os resultados e limitações na transcrição; não são classificados como aprovados por falta de prova completa.


### DEF-43 — Novo item de backlog abre OS com outro cliente selecionado

**Data:** 26/11/2026. **Reprodução:** em PCM > Chamados > Backlog, selecionar Sinérgica - Escritório no filtro. A fila mostrou cinco registros do Escritório nas páginas carregadas. Clicar “Novo item de backlog”: abriu “Nova Ordem de Serviço”, com “Abertura manual no PCM · status solicitação”, botão “Criar OS” e cliente preselecionado “[TESTE E2E] Cliente 360 Cockpit A”, não o Escritório selecionado. Cancelei sem gravar e o filtro do Escritório permaneceu na fila. Antes, o mesmo botão também abriu esse formulário quando a fila estava em Todos.

**Esperado:** respeitar o contexto selecionado ou exigir escolha explícita do cliente; esclarecer se a ação realmente cria backlog ou OS. **Impacto:** risco de atribuir uma criação ao cliente errado e confusão com a composição de escopo descrita no CT-15. Nenhuma OS foi criada; não se conclui como o servidor trata um envio. Recapturar evidência visual. A fila é intitulada Backlog GUT e descreve OS abertas; ainda é necessário confirmar se essa é a jornada específica de backlog de escopo do caderno.


### DEF-44 — Data da inspeção difere entre Cliente 360 e Inspeções

**Data do teste:** 26/11/2026. **Reprodução:** PCM > Clientes > Sinérgica - Escritório > Mais em Operação > Inspeções: o diagnóstico fictício [TESTE CADERNO] mostra 24/11/2026, em andamento, dois itens e duas não conformidades. Abrir PCM > Inspeções: a mesma INSP-0044 aparece com data 25/11/2026 tanto na lista quanto no detalhe, com mesmo cliente e título.

**Esperado:** a mesma inspeção apresentar data consistente entre as visões. A causa e o valor armazenado não foram verificados; não presumir fuso como causa. Nenhum registro alterado. Captura visual pendente. A consulta do Cliente 360 mostrou “Nenhum laudo criado” para o Escritório, sem massa de laudo para comparar.


### DEF-45 — Item “Não avaliado” contado como “N/A”

**Data:** 26/11/2026. **Caso:** CT-23. Em PCM > Inspeções > INSP-0044 do Escritório, havia dois itens Não conforme e contador N/A zero. Adicionei o item fictício “[TESTE CADERNO] Item fictício não avaliado para conferir os totais.” com resultado padrão “Não avaliado”. O item aparece com esse estado, mas o resumo passou a indicar N/A 1 e Total 3. Ao clicar Atualizar inspeções, item e contadores permaneceram.

**Esperado:** deixar inequívoco se N/A significa “Não avaliado” ou “Não aplicável” e apresentar o estado correspondente sem sugerir que um item não examinado seja não aplicável. Não foi examinada a regra ou valor armazenado. O item foi deixado na inspeção como massa identificada; nenhum backlog foi gerado a partir dele. A descrição original do DEF-04 foi perdida e uma antiga captura tinha nome relacionado a “não avaliado”, mas não há prova suficiente de que seja o mesmo defeito. Captura visual nova pendente.


### CT-14/15 — consulta do guia do sistema, 26/11/2026

O Guia do SO > PCM > “Priorizar o backlog e planejar” indica a aba Backlog de Chamados/Operação como fila de decisão e descreve fatores GUT, registro PRE, confirmação de chamado e planejamento. Isso identifica o caminho da fila Backlog GUT observada, mas o guia consultado não descreve “Compor Backlog”, seleção de duas pendências em um escopo, nem liberação parcial como no CT-15. O guia informa revisão em 14/10/2026; o caderno referencia versão posterior. Assim, não prova que a jornada de escopo esteja ativa ou que o fluxo atual seja equivalente. Os CT-14/15 permanecem dependentes de confirmar ativação e localizar a jornada, além do perfil Gestor PCM. Nenhuma criação, liberação ou envio foi realizado nesta consulta.


## Veredictos atualizados dos 15 casos antes não executados

Atualização em 26/11/2026. “Bloqueado” significa que o roteiro integral não pôde ser concluído nas condições atuais; os trechos observados e defeitos permanecem registrados separadamente. Os status históricos transcritos acima não foram apagados.

| Caso | Veredito | Bloqueio ou evidência |
| --- | --- | --- |
| CT-02 | Bloqueado | Credenciais válidas de uma conta de teste não disponibilizadas; não foi feito logout da sessão operacional. |
| CT-04 | Bloqueado | Faltam sessões Operador PCM e Financeiro para provar as negativas. |
| CT-19 | Bloqueado | Fabrício inativo no Auvo; falta retorno real de campo e sessões Operador/Gestor. A passagem manual indevida suspeita foi observada como DEF-35, sem comprovar execução. |
| CT-34 | Bloqueado | A tela Propostas abre vazia (DEF-17); faltam proposta de teste e janela para geração financeira. |
| CT-38 | Bloqueado | Competência aberta e valor de teste combinado com o responsável ainda não foram definidos. Formulário aberto e cancelado sem gravação. |
| CT-39 | Bloqueado | Falta lançamento e segunda conta de teste/saldo para concluir o roteiro; comprovante e transferência não realizados. |
| CT-40 | Bloqueado | Falta OFX sintético e transação de teste preparada; importação e confirmação não executadas. |
| CT-48 | Bloqueado | Falta conversa e contato controlados e janela de envio; nenhuma mensagem enviada. |
| CT-49 | Bloqueado | Instagram mostra zero conexões; faltam canal e interlocutor de teste. Nenhuma mensagem enviada. |
| CT-54 | Bloqueado | Consulta de indicadores falha (DEF-08); botão de sincronização desabilitado; configuração e janela Meta não comprovadas. |
| CT-58 | Bloqueado | Faltam conta cliente-síndico e segundo cliente de teste para isolamento. |
| CT-59 | Bloqueado | Falta sessão cliente-síndico e massa publicável/anexo interno reservados. |
| CT-60 | Bloqueado | Faltam cliente-síndico, Operador PCM e janela/massa de decisão reservada. |
| CT-61 | Bloqueado | Faltam sessões Gestor e Operador e segundo cliente autorizado para prova de capacidade. |
| CT-62 | Bloqueado | Falta usuário isolado, sessão separada e janela de revogação/restauração. |

Contagem deste bloco: 15 bloqueados, zero aprovados e zero reprovados como veredito integral. CT-19, CT-34 e CT-54 têm observações/defeitos registrados acima, mas não completam os respectivos roteiros. CT-38–40 podem ser retomados se suas condições forem disponibilizadas; não representam teste financeiro executado.


### CT-28 — navegação da lista à OS, 26/11/2026

Em Materiais e Aquisições, selecionei Escritório e “Abrir contexto da OS” na lista concluída. Abriu resumo de CH-3302 com o mesmo título de teste e cliente Sinérgica - Escritório. “Voltar ao cliente” levou ao Resumo do Cliente 360 do Escritório; ao reabrir Materiais e Aquisições pelo menu, foi necessário selecionar o cliente novamente. Não houve gravação. Esse trecho correspondeu à OS e ao cliente esperados; o caso completo ainda depende da sessão Gestor PCM.

### Higiene dos DEF-34 a DEF-42 e contagem de triagem

Os nove itens têm reprodução textual e resultado observado no corpo deste relatório. As capturas originais não estão disponíveis: devem ser recapturadas. DEF-35 identifica a OS e a restauração para Planejamento; DEF-37 referencia o PDF que precisa ter a existência atual confirmada; DEF-39 referencia planilha que também precisa de confirmação. DEF-34/36/38/40/41/42 dependem de recaptura, e não se afirma causa sem investigação.

**Contagem consolidada provisória dos 65:** 10 reprovados por expectativa contrariada (CT-07, 11, 24, 26, 33, 43, 46, 52, 53, 57); 15 bloqueados conforme tabela acima; 40 em triagem; zero aprovados integrais. Cada caso foi contado uma vez. “Em triagem” não é resultado aprovado; a contagem poderá mudar após revisão dos demais passos e perfis.


### Evidências exportadas verificadas novamente — 26/11/2026

Os arquivos abaixo existem em Downloads, têm conteúdo e foram lidos nesta rodada:

- DEF-37: `relatorio-sin-rgica-escrit-rio-2026-11-20.pdf` tem 45.155 bytes. O texto interno extraído identifica Escritório e período **01/11 a 26/11/2026**, apesar do nome terminar em 20/11. A inspeção de 25/11 aparece em Trabalho realizado. A sequência da interface que gerou esse arquivo é a descrita em DEF-37; o arquivo, isoladamente, não prova a sequência de cliques.
- DEF-36: `relatorio-sin-rgica-escrit-rio-2026-11-26.pdf` tem 45.155 bytes e texto extraído com a mesma inspeção em Trabalho realizado. A situação em andamento foi observada pela interface na rodada original.
- DEF-39: `estrutura-sinérgica---escritório-2026-11-26.xlsx` tem 25.712 bytes e abre para leitura; contém abas Leia-me, Áreas, Locais, Sistemas, Componentes e Listas. A leitura confirma existência e estrutura, não substitui inspeção visual das larguras.

Os dois PDFs têm hashes distintos apesar do mesmo texto extraído; não se afirma identidade binária. Capturas originais continuam perdidas.


### DEF-46 — PDF exportado com período no nome diferente do conteúdo

**Data:** 26/11/2026. **Origem:** PCM > Relatório do Cliente, cliente Sinérgica - Escritório. Após gerar a prévia de 01/11 a 26/11/2026, alterei a data final para 20/11 e exportei sem gerar novamente. O arquivo `relatorio-sin-rgica-escrit-rio-2026-11-20.pdf` foi salvo em `/Users/lucasazevedo/Downloads/`. Em nova conferência, tinha 45.155 bytes e seu texto interno dizia “Período: 2026-11-01 a 2026-11-26”, incluindo inspeção de 25/11.

**Esperado:** nome e conteúdo devem corresponder aos filtros aplicados à mesma geração; alterações pendentes devem invalidar ou atualizar a prévia antes de exportar. **Impacto:** o usuário pode arquivar ou compartilhar documento associado ao período errado. O arquivo está preservado; a sequência de interação foi observada na rodada original, mas a captura foi perdida. Este defeito destaca o mesmo cenário observado no DEF-37 para facilitar correção; não há evidência de causas independentes e não deve ser contado como falha técnica independente sem investigação. Nenhuma publicação foi realizada.

### Separação de etapas coerentes e aprovação integral

Zero aprovados integrais **não demonstra** que todos os fluxos falharam: a sessão Superadmin e a ausência de pré-requisitos impediram completar etapas exigidas. Abaixo, 17 dos 40 casos em triagem têm **etapas específicas observadas coerentes**, sem que isso prove todos os passos acessíveis ou o roteiro completo. Os outros 23 ainda não receberam essa classificação; não significa que falharam. Os 10 reprovados e 15 bloqueados permanecem nas categorias anteriores.

| Caso | O que funcionou na sessão observada | O que ainda falta |
| --- | --- | --- |
| CT-01 | Commit e entradas conferidos. | Sessão nova e Gestor PCM. |
| CT-03 | Chamados, Clientes, Planejamento e Guia abriram; retorno ao PCM funcionou. | Acessos do Gestor PCM. |
| CT-06 | Busca por nome, código, acentuação e vazio conferida. | Gestor PCM. |
| CT-08 | Navegação Área, Local e equipamento e retorno à Área/Cliente. | Identificadores e Gestor PCM. |
| CT-13 | Salto da OS de teste a Finalizado recusado; fase persistiu após recarga. | Reabertura condicional de OS finalizada e Gestor PCM. |
| CT-17 | Exceção, horário, tentativas e motivo conferidos ao reabrir monitor. | Gestor PCM. |
| CT-22 | INSP-0044 criada e localizada como Diagnóstico Inicial do Escritório. | Inspetor, vínculos e histórico adicionais. |
| CT-35 | Etapas, motivos, parâmetros, níveis e catálogo carregaram. | Conferência completa de vigência/legibilidade, perfil de leitura e escrita reservada. |
| CT-36 | Dashboard, caixa, fluxo e previsto/realizado carregaram. | Comparação numérica e perfil Gestor. |
| CT-44 | Configurações, provisões históricas e competências carregaram. | Comparações, janela reservada, efeitos e auditoria. |
| CT-45 | Régua e histórico abriram com vazios explícitos. | Provedor, destinatário e massa reservados; integração e envio. |
| CT-47 | Dashboard e lista Inbox abriram. | Conversa controlada e teste de acesso específico. |
| CT-50 | Abas consultadas; cancelamento de entrada de Conhecimento preservou vazio. | Revisão completa das demais condições e perfil de leitura. |
| CT-51 | Alma vazia e memória separadas; cancelamento preservou Alma vazia. | Gravação/restauração, troca de cliente e perfil de leitura. |
| CT-55 | Consultas de equipes, funcionários e ferramentas carregaram. | Comparação dos vínculos e Fabrício ativo. |
| CT-56 | Roteiro fictício criado, reaberto e desativado; catálogos consultados. | Confirmar característica obrigatória e negativa com Financeiro sem PCM. |
| CT-65 | Troca PCM → Comercial → Financeiro → PCM e persistência do componente. | Sessão nova e medição inicial. |

A contagem consolidada de vereditos continua **10 reprovados, 15 bloqueados e 40 em triagem, zero aprovados integrais**. Os 17 são um subconjunto dos 40, não uma quarta categoria de veredito. A transcrição anterior e as limitações de evidência continuam aplicáveis.


### CT-09 — Reteste do detalhe do grupo em 26/11/2026

Em Clientes > Sinérgica - Escritório > Estrutura, pesquisei “Luminárias”. O resultado apresentou o Grupo Quantitativo fictício; o cartão da página mostra três unidades, Área Técnica / Sala Técnica, categoria Elétrica e Sistema Hidráulico fictício. “Navegar” abriu o contexto do grupo com “Nenhum resultado neste contexto ou filtro”; como a própria página descreve as unidades como agrupadas sem cadastro individual, esse vazio isolado não comprova falha.

“Ver Grupo Quantitativo” abriu diálogo com nome, código/TAG não informado, evento de criação e detalhes expansíveis. O diálogo não mostrou quantidade, Local ou Sistema, nem identificou áreas de planos e pendências. Dois avisos idênticos diziam “Este recurso existe e ainda não está disponível para a sua operação”, sem nomear os recursos. Inspeção visual confirmou os dois avisos e ausência desses dados; captura não foi salva. Reproduz DEF-09, já registrado, e contraria a consulta dos dados e áreas do grupo prevista no passo 3. Não é possível atribuir cada aviso a planos ou pendências sem informação adicional.

**Veredito CT-09: reprovado no passo 3 (DEF-09).** A consulta por Gestor PCM não foi executada; este resultado foi observado como Superadmin. Nenhuma alteração de dados nesta rodada.

**Contagem consolidada provisória:** 11 reprovados (CT-07, 09, 11, 24, 26, 33, 43, 46, 52, 53, 57), 15 bloqueados, 39 em triagem, zero aprovados integrais. Os 17 casos da tabela anterior continuam sendo subconjunto dos casos em triagem. Esta contagem substitui as contagens anteriores, preservadas para histórico.


### Continuação financeira e lista para limpeza — 26/11/2026

O dono autorizou massa financeira fictícia com valores pequenos. CT-48 e CT-49 foram despriorizados pelo dono nesta data; não são bloqueios a destravar. CT-38, CT-39 e CT-40 retornaram à execução; o veredito anterior de bloqueio por falta de autorização não se aplica mais. Perfis seguem pendentes.

**Registros financeiros de teste para localizar e limpar depois:**

- Conta bancária `[TESTE CADERNO] Codex 25-11-2026 Conta zero`, criada anteriormente em Financeiro > Contas Bancárias; saldo inicial informado zero; identificador interno ainda não capturado.
- Categoria `[TESTE CADERNO] Codex 25-11-2026 Categoria` e subcategoria `[TESTE CADERNO] Codex 25-11-2026 Subcategoria`, criadas anteriormente em Financeiro > Categorias; identificadores internos não capturados.
- Lançamento `[TESTE CADERNO] CT-38 lançamento fictício 26-11-2026`, criado nesta rodada em Financeiro > Lançamentos: saída prevista de R$ 1,37, competência e vencimento 26/11/2026, subcategoria de teste, conta de teste acima, cliente Sinérgica - Escritório. Identificador interno ainda não exibido; localizar pela descrição completa. Após salvar, uma linha com essa descrição, valor e status Previsto apareceu. Baixa, estorno, filtros e exportação ainda não executados.

**CT-32:** tentativa de arraste pela ferramenta retornou `windowNotFoundAtPosition` mesmo após trazer Chrome para frente; isso não comprova defeito da aplicação. Clique no cartão abriu o Cliente 360 do Escritório. Mudança de etapa e perda continuam sem teste.

**Contagem provisória após mudança de prioridade:** 11 reprovados, 10 bloqueados, 42 em triagem e 2 despriorizados; zero aprovados integrais. CT-38 a CT-40 saíram dos bloqueados para triagem; CT-48 e CT-49 foram despriorizados. A contagem anterior fica preservada como histórico.


### Provisionamento de perfis — 26/11/2026

Autorização transmitida pelo SuperTcL: dono autorizou criar usuários de teste, com perfis de homologação existentes, sem alterar usuários existentes. Em Configurações > Usuários > Novo usuário, a interface pede nome, e-mail, senha, papel e permissões; o seletor de grupo pré-criado não apresentou opções. Cancelei sem criar ou alterar usuário. Em Capacidades, os perfis Homologação — Gestor PCM e Homologação — Operador PCM aparecem ativos e já vinculados aos usuários preexistentes de teste; não foram alterados. O vínculo de perfil é uma etapa separada da criação. A interface não esclarece se exige caixa de e-mail acessível. O código local da função de criação usa `email_confirm: true`, mas a versão implantada e o funcionamento do login para e-mail fictício não foram comprovados pela tela. Nenhum novo usuário criado nesta rodada.


### CT-38 — Baixa, estorno e exportação parcial — 26/11/2026

Na conta fictícia `[TESTE CADERNO] Codex 25-11-2026 Conta zero`, o saldo era R$ 0,00. No lançamento `[TESTE CADERNO] CT-38 lançamento fictício 26-11-2026`, a confirmação de baixa mostrou R$ 1,37 e data 26/11/2026; após confirmar, a linha mudou de Previsto para Realizado e a conta mostrou R$ -1,37. O diálogo Estornar baixa identificou o lançamento; após confirmar, a linha voltou a Previsto e a conta voltou a R$ 0,00. Uma única linha de teste apareceu ao filtrar pela conta. O lançamento permanece previsto, sem pagamento; não foi excluído.

Com filtro pela conta de teste, Exportar CSV gerou `/Users/lucasazevedo/Downloads/lancamentos-financeiro-2026-11-26.csv` (310 bytes). O arquivo contém cabeçalho e uma linha do lançamento fictício, com descrição, saída, R$ 1,37, previsto, conta, cliente e vencimento corretos. Faltam filtros de período, tipo, status e categoria, recarga e verificação de histórico/auditoria; perfil Financeiro ainda não testado. O caso permanece em triagem.

### DEF-47 — Resultado negativo sem sinal na tela de lançamentos

**Reprodução:** em Financeiro > Lançamentos, filtrar pela conta `[TESTE CADERNO] Codex 25-11-2026 Conta zero`, que contém uma saída prevista de R$ 1,37 e nenhuma entrada. Os cartões mostram Entradas R$ 0,00, Saídas R$ 1,37 e Resultado do filtro R$ 1,37, sem sinal de menos; visualmente o valor do resultado aparece em vermelho. O mesmo resultado sem sinal aparecia antes do filtro, com apenas saídas. **Esperado:** se o resultado representa entradas menos saídas, exibir R$ -1,37 e não depender apenas de cor para indicar o sinal; confirmar semântica do indicador. Não se afirma que o cálculo armazenado esteja errado: a divergência observada é a apresentação. Captura visual foi examinada, mas não salva; recapturar.


### Usuário Gestor de teste — 26/11/2026

Criação autorizada pelo dono e instruída por SuperTcL. Em Configurações > Usuários, criei `[TESTE CADERNO] Gestor PCM 26-11-2026`, e-mail fictício `gestor-pcm-caderno-20261126@teste.invalid`, papel Supervisor, permissão individual de escrita em PCM; demais módulos deixados como Nenhum. A lista mostrou Supervisor e 1 módulo. Em Capacidades, selecionei esse usuário e `Homologação — Gestor PCM`, com motivo `[TESTE CADERNO] Validação do perfil Gestor PCM 26-11-2026`. Após atribuir, a lista Vínculos mostrou o vínculo ativo. Durante a atualização apareceu aviso de alteração pendente; não repeti a operação, pois a lista já mostrava o vínculo. Confirmar estabilidade após recarga. Cadastro e vínculo ficam na lista de limpeza; senha temporária está no arquivo local privado `credenciais-teste-locais.txt`, não neste relatório. A criação e a atribuição exigiram duas telas; o seletor de grupos pré-criados estava vazio.

Abri uma janela anônima para testar o login sem perder a sessão Superadmin. A navegação ao site ainda estava carregando na última observação; login não comprovado, nem falha de confirmação de e-mail demonstrada. Não criar outros usuários antes desse teste.

**CT-38 — filtros adicionais:** com conta de teste selecionada, Status Realizado apresentou vazio e Previsto mostrou a única linha; Tipo Entrada apresentou vazio para a mesma conta e status. Resultado visual de filtro vazio ficou explícito. Ainda faltam demais filtros, recarga e histórico.


### Login do Gestor PCM confirmado — 26/11/2026

Em janela anônima separada da sessão Superadmin, o login com `gestor-pcm-caderno-20261126@teste.invalid` e a senha temporária local abriu o sistema sem exigir confirmação de e-mail observada. A página inicial apresentou o módulo PCM; o Gestor abriu Clientes e a Visão 360 de Sinérgica - Escritório. Isso prova autenticação e acesso a essas telas, não todas as capacidades do perfil nem o roteiro integral dos CTs. A sessão anônima permaneceu aberta para continuação. Não foram criados os outros usuários nesta rodada. A senha foi removida da área de transferência ao copiar o endereço do site.

Na lista de limpeza, o lançamento CT-38 permanece previsto, com baixa e estorno executados e saldo atual da conta de teste R$ 0,00. O histórico ou identificador próprio dos eventos de baixa e estorno ainda não foi localizado pela interface; verificar antes de afirmar que houve registros separados.


### Operador PCM e repetição do aviso — 26/11/2026

Por autorização do dono transmitida por SuperTcL, criei `[TESTE CADERNO] Operador PCM 26-11-2026`, e-mail fictício `operador-pcm-caderno-20261126@teste.invalid`, papel Colaborador, permissão individual de escrita no PCM e demais módulos Nenhum. Em Capacidades atribuí o perfil preexistente `Homologação — Operador PCM` com motivo identificado de teste. A lista de vínculos mostrou o novo vínculo ativo. Este usuário e vínculo devem constar na limpeza; identificador interno ainda não localizado. Senha temporária distinta, em arquivo local privado `credencial-operador-local.txt`, não consta neste relatório.

Em janela anônima, encerrei a sessão de teste do Gestor e entrei com o Operador; login abriu o PCM. A fila localizou CH-3301 uma vez; o resumo e o detalhe abriram com nome e cliente corretos, e a anotação fictícia anterior permaneceu visível. Não foi criado outro chamado nessa rodada. CT-12 ainda precisa de conferência dos demais passos; os demais casos de perfil seguem pendentes. A sessão Superadmin foi preservada.

### DEF-48 — Aviso de alteração pendente simultâneo a vínculo ativo

**Reprodução:** como Superadmin, em Configurações > Capacidades, selecione o usuário fictício de Operador acima e o perfil `Homologação — Operador PCM`; informe o motivo de teste e clique Atribuir perfil ao usuário. Logo após o clique, a interface exibiu “Há alteração de capacidade pendente nesta sessão. Repita o pedido antes de registrar outra alteração.”, com botão de repetição desabilitado. Na observação seguinte, o aviso ainda aparecia enquanto a seção Vínculos já listava o mesmo usuário e perfil como ativos. Mesma sequência havia ocorrido com o Gestor; depois, sem repetição, a tela do Gestor apresentou “Alteração registrada.”. Não foi feita segunda atribuição para o Operador. **Esperado:** informar claramente processamento em curso e só pedir repetição quando necessário, distinguindo resultado provisório de confirmado. Não se conclui que a gravação falhou nem que o estado ativo esteja incorreto. A combinação contraditória pode induzir repetição desnecessária ou insegurança sobre a permissão. Captura visual a salvar; sequência registrada por árvore de acessibilidade.

**Limpeza financeira:** o lançamento segue identificável pela descrição completa `[TESTE CADERNO] CT-38 lançamento fictício 26-11-2026` em Financeiro > Lançamentos; baixa e estorno foram operações sobre ele. Não foi localizado identificador interno nem tela que mostre IDs próprios dos eventos. Não se conclui que os eventos não possuam IDs no backend; falta obter o identificador do lançamento e verificar o histórico, pois a ausência de referência visível dificulta auditoria.


### CT-12 — Criação e recarga pelo Operador PCM — 26/11/2026

Na sessão anônima do Operador, em Chamados > Novo Chamado, o botão Criar Chamado estava desabilitado sem título. O formulário abriu com outro cliente preselecionado; selecionei explicitamente Sinérgica - Escritório. Informei título `[TESTE CADERNO] CT-12 Operador PCM 26-11-2026` e descrição `Chamado fictício para validar criação e persistência pelo Operador PCM.`; salvei uma vez. O formulário fechou, mas a fila ainda estava filtrada pelo chamado anterior; nenhum número de confirmação foi observado naquele momento. Ao buscar o título, apareceu uma linha CH-3322. Seu resumo apresentou cliente, título e descrição esperados. Recarreguei a página, reabri Chamados e pesquisei CH-3322: apareceu uma linha, com o mesmo título e cliente. Nenhum envio ao Auvo foi confirmado.

**Massa para limpeza:** CH-3322, Sinérgica - Escritório, título acima, criado pelo usuário Operador de teste; permanece aberto. CT-12 segue em triagem até verificar se há indicação do número no momento da criação e se os critérios de validação dos campos faltantes são satisfeitos; ausência de indicação não foi comprovada apenas por não ter sido observada. A repetição de cliente preselecionado de outro contexto é relacionada ao DEF-43, porém a origem e o comportamento deste formulário específico ainda exigem investigação antes de contá-lo como mesmo defeito.


### CT-16 — Recusa da fila pelo Operador PCM — 26/11/2026

Na sessão anônima do Operador de teste, abri Chamados > Kanban, busquei `CH-HOMOLOG-PCM-01` e selecionei Sinérgica - Escritório no filtro de cliente. A coluna Campo a conciliar apresentou: “Campo a conciliar: você não tem a capacidade de validação neste Cliente.” Assim, a interface apresentou recusa explícita em vez de interpretar a fila como vazia, conforme o passo 4. Antes de selecionar o cliente, a coluna pedia seleção; em Planejamento, o cartão comum da OS aparecia com referência Auvo simulada. Não movi nem conclui triagem.

**Situação:** passo de recusa observado conforme esperado para o Operador; a verificação integral ainda exige executar os passos da fila com o Gestor. A recusa observada não prova quais concessões estão armazenadas, já que a tela administrativa de concessões falha (DEF-24).


### CT-16 — Consulta com Gestor PCM — 26/11/2026

Em sessão anônima do Gestor de homologação, Chamados > Kanban > cliente Sinérgica - Escritório apresentou, após carregamento, Campo a conciliar com um cartão `[TESTE HOMOLOGAÇÃO] Campo a conciliar`, motivo “Sem referência de Chamado”, `CH-HOMOLOG-PCM-01` e referência Auvo simulada `890000000190001`. O cartão abriu detalhe da mesma OS e do Escritório; após fechar, o cartão permaneceu na fila. Nenhuma triagem ou envio ao Auvo ocorreu. O Operador recebeu a recusa explícita descrita acima. Os passos de consulta e permissão corresponderam ao esperado; o teste de que a saída não ocorre por arraste comum ainda não foi comprovado: houve seleção por clique, sem tentativa de arraste. CT-16 permanece em triagem até essa verificação.

Na mesma tela, com Escritório selecionado, a coluna Preventiva mostrou 12 cartões de H2 Poker Club - Climatização. Inspeção visual confirmou o cliente divergente; reproduz DEF-01 também na sessão Gestor.


### CT-17 — Consulta do monitor pelo Gestor — 26/11/2026

Em Chamados > Monitor Auvo, selecionei Sinérgica - Escritório. A linha CH-HOMOLOG-PCM-02 mostrou Visita não confirmada, horário 25/11/2026 às 20:42:27, tarefa —, zero tentativas e motivo ‘Visita planejada, sem confirmação’. Após navegar ao Dashboard e voltar ao monitor, selecionei novamente o cliente; os mesmos dados permaneceram. A seleção de cliente não foi preservada na navegação. Nenhuma confirmação ou envio foi acionado. A consulta mostrou tarefa vazia e zero tentativas, mas não comprova por si só a ausência de mensagem no sistema externo. Captura visual não salva. CT-17 permanece em triagem até verificar o critério externo.


### Continuação CT-16 e CT-19 — 26/11/2026

CT-16: antes de testar o arraste comum, o controle do Chrome retornou `cgWindowNotFound`; a tentativa de arraste nesta rodada não foi executada. O caso continua em triagem, sem imputar falha à aplicação.

CT-19: o roteiro exige OS de teste com retorno real de conclusão do Auvo, não incluída nos exemplos semeados. Essa condição ainda não foi comprovada; Fabrício permanece inativo conforme último estado informado. O caso permanece bloqueado pela ausência de retorno real de teste, sem simular aprovação nem enviar tarefa real.

Contagem provisória inalterada: 11 reprovados, 10 bloqueados, 42 em triagem, 2 despriorizados, 0 aprovados integrais.


### Estado das dependências de perfil — 26/11/2026

As tabelas anteriores são histórico: Gestor e Operador PCM de teste já foram criados e autenticados, como documentado acima. CT-04 continua bloqueado para conclusão: a sessão Financeiro e as duas tentativas de endereço direto do roteiro não foram comprovadas. CT-61 continua bloqueado para conclusão: Operador recebeu recusa explícita em Campo a conciliar do Escritório e Gestor consultou a fila, mas faltam segundo cliente de teste e prova por endereço direto. Essas observações não provam o roteiro integral nem a segregação no servidor. CT-19 continua bloqueado pela ausência de retorno real de OS do Auvo. Nenhuma dessas atualizações muda a contagem provisória.

Na retomada, o controle nativo do Chrome retornou `cgWindowNotFound`; tentativa de abrir aba pelo provedor Chrome retornou `The browser access host is unavailable`. Isto é limitação da ferramenta de controle nesta rodada, não defeito confirmado da aplicação.

## Revisão dos 42 casos antes classificados em triagem — 26/11/2026

Esta revisão usa somente a evidência textual preservada. O Chrome travado impede novos testes; não é defeito do produto. “Observável coerente” significa que as etapas efetivamente registradas foram compatíveis com as expectativas correspondentes, não que todos os passos do caso tenham sido executados. Não equivale a aprovação integral. A classificação anterior de 17 casos com trechos coerentes era menos restritiva: vários também tinham passos funcionais não observados.

| Caso | Classificação | Evidência e pendência |
| --- | --- | --- |
| CT-01 | Triagem | Commit e entradas conferidos; falta confirmar todos os dados reservados e sessão do Gestor para o roteiro completo. |
| CT-03 | Observável coerente; integral pendente de perfil | Chamados, Clientes, Planejamento, Guia e retorno abriram; falta comprovar menu e permissões do Gestor. |
| CT-05 | Triagem | Abas e detalhe consultados; registro não comprova retorno oferecido ao Cliente nem todos os passos pelo perfil previsto. |
| CT-06 | Observável coerente; integral pendente de perfil | Busca por nome, código, acento e vazio conferida; falta repetir com Gestor. |
| CT-08 | Triagem | Navegação e retorno observados; identificação por IDs e Gestor pendentes. |
| CT-10 | Bloqueado | Área de reconciliação não localizada; ativação e acesso não confirmados. Não presumir que não exista. |
| CT-12 | Triagem | Operador criou CH-3322 e comprovou persistência; falta evidência da indicação dos campos obrigatórios e do número no momento da criação. |
| CT-13 | Triagem | Salto direto a Finalizado foi recusado; reabertura condicional e Gestor não verificados. |
| CT-14 | Triagem | Fila e filtros consultados; correspondência com jornada de composição por escopo não confirmada. |
| CT-15 | Triagem | Geração da inspeção observada com DEF-20 a DEF-22; composição e liberação parcial de escopo não comprovadas. |
| CT-16 | Triagem | Gestor consultou fila e Operador recebeu recusa; arraste comum não testado por indisponibilidade da ferramenta. |
| CT-17 | Observável coerente; integral pendente de condição externa | Gestor consultou exemplo, horário, zero tentativas e motivo após reabrir; ausência de mensagem externa não comprovada. |
| CT-18 | Triagem | Agenda consultada; divergência de turno/horário em DEF-03 exige regra de fuso e nova conferência, sem presumir causa. |
| CT-20 | Triagem | Semana e vazio explícito vistos; trecho e seleção por técnico não comprovados, Fabrício inativo. |
| CT-21 | Bloqueado | Fabrício inativo; visita, envio e retorno real Auvo não executados. |
| CT-22 | Triagem | Diagnóstico criado e localizado; vínculos, histórico e perfil Inspetor ainda pendentes. |
| CT-23 | Triagem | Inspeção e item persistiram; mídia, exportação e perfil não comprovados; DEF-04 sem detalhes recuperados. |
| CT-25 | Triagem | Contrato legado consultado; distinção entre criação de contrato e de plano manual ainda não esclarecida. |
| CT-27 | Triagem | Troca de cliente consultada; comportamento de rascunho tem DEF-25, e critério integral requer confronto com roteiro. |
| CT-28 | Observável coerente; integral pendente de perfil | Sete estados, responsável e navegação da lista para OS/cliente observados; falta sessão Gestor para o roteiro. DEF-16 tem detalhes perdidos e não comprova falha deste roteiro. |
| CT-29 | Triagem | Lista e revisão persistiram; DEF-11 e teste de concorrência pendente exigem confronto com o roteiro. |
| CT-30 | Triagem | Consultas de orçamento falharam (DEF-12); sem massa para conferir vínculos e revisão. |
| CT-31 | Triagem | Dashboard e filtros consultados; comparações completas e perfil Comercial pendentes. |
| CT-32 | Triagem | Oportunidade persistiu; mudança de etapa e perda não verificadas por falha da ferramenta de arraste. |
| CT-35 | Triagem | Configurações carregaram; vigência, escrita reservada e perfil de leitura pendentes. |
| CT-36 | Triagem | Dashboard carregou; comparação numérica e acesso específico não comprovados. |
| CT-37 | Triagem | Categoria e conta fictícias persistiram; movimentações e comparação de saldos pendentes; DEF-31 observado. |
| CT-38 | Triagem | Baixa e estorno de R$ 1,37 voltaram saldo a zero; faltam filtros, recarga e histórico; DEF-47 observado. |
| CT-39 | Triagem | Falta criar segunda conta fictícia e testar comprovante e transferência interna. |
| CT-40 | Triagem | Falta OFX sintético e teste de importação e duplicidade. |
| CT-41 | Triagem | Consultas abriram; visão por faixa sem vazio (DEF-18) e testes com massa reservada pendentes. |
| CT-42 | Triagem | Consulta existente mostra divergência de custo/hora (DEF-23); massa e histórico de pessoa de teste pendentes. |
| CT-44 | Triagem | Configurações e competências abriram; efeitos e auditoria do fechamento não comprovados. |
| CT-45 | Triagem | Régua e histórico abriram; provedor, destinatário e fluxo completo não testados. |
| CT-47 | Triagem | Dashboard e Inbox abriram; conversa controlada e permissões não testadas. |
| CT-50 | Triagem | Abas e cancelamento consultados; demais condições e perfil de leitura pendentes. |
| CT-51 | Triagem | Alma e memória separadas; gravação/restauração, troca de cliente e perfil pendentes. |
| CT-55 | Triagem | Consultas carregaram; comparação dos vínculos e Fabrício ativo pendentes. |
| CT-56 | Triagem | Roteiro criado e reaberto; característica obrigatória e negativa do Financeiro ainda não comprovadas. |
| CT-63 | Triagem | Rascunho e falha offline observados (DEF-25 e DEF-26); tempo limite e gravação offline não testados. |
| CT-64 | Triagem | Teclado e parte da visualização reduzida consultados; foco divergente (DEF-19), rolagem e navegação completa pendentes. |
| CT-65 | Triagem | Troca de módulos e persistência observadas; primeira abertura em sessão nova e tempo não medidos. |

**Contagem consolidada revisada, provisória:** 11 reprovados, 12 bloqueados, 40 em triagem e 2 despriorizados; 0 aprovados integrais. Dos 40 em triagem, 4 estão identificados acima como observável coerente com perfil ou condição externa pendente; os outros 36 têm etapas funcionais ainda não observadas ou critérios a confrontar. Os dois casos reclassificados como bloqueados são CT-10 e CT-21, antes descritos como bloqueados mas contados indevidamente em triagem. Nenhum novo defeito foi inferido nesta revisão.

## Lista consolidada de limpeza — 26/11/2026

Esta lista registra o que a evidência preservada permite localizar; IDs internos não recuperados são indicados. Não contém senhas. Não executar limpeza sem decisão do dono.

- Usuário `[TESTE CADERNO] Gestor PCM 26-11-2026`, `gestor-pcm-caderno-20261126@teste.invalid`, Supervisor, perfil `Homologação — Gestor PCM` e respectivo vínculo em Capacidades; ID interno não capturado.
- Usuário `[TESTE CADERNO] Operador PCM 26-11-2026`, `operador-pcm-caderno-20261126@teste.invalid`, Colaborador, perfil `Homologação — Operador PCM` e respectivo vínculo; ID interno não capturado. Ambos criados com autorização do dono transmitida por SuperTcL.
- Segundo cliente: não há evidência de criação por esta rodada. `[TESTE E2E] Cliente 360 Cockpit A` já existia e foi apenas consultado; não incluí-lo como criação desta validação.
- Chamados/OS de teste: CH-3301, CH-3302, CH-3303 e CH-3322; este último é `[TESTE CADERNO] CT-12 Operador PCM 26-11-2026`, Escritório. Pendências PRE-C0748047 e PRE-1B4ECBDB; OS PRE-A6C3B6A4; inspeção INSP-0044 e dois itens fictícios. Conferir vínculos antes de limpar.
- Estrutura fictícia Área Técnica, Sala Técnica, Bomba Técnica, Sistema Hidráulico, grupo Luminárias (três unidades) e componente válvula; IDs internos não recuperados. Preventiva da Bomba pausada; Plano de Manutenção e Rotina em rascunho. Listas de materiais fictícias vinculadas a CH-3302. Oportunidade fictícia do Escritório em Lead e roteiro de entrevista de teste desativado; identificadores internos não recuperados.
- Financeiro: conta `[TESTE CADERNO] Codex 25-11-2026 Conta zero`; categoria `[TESTE CADERNO] Codex 25-11-2026 Categoria`; subcategoria `[TESTE CADERNO] Codex 25-11-2026 Subcategoria`; lançamento `[TESTE CADERNO] CT-38 lançamento fictício 26-11-2026`, saída R$ 1,37, previsto após baixa e estorno. Ambos os eventos se referem ao lançamento; IDs internos do lançamento e eventos não foram localizados. Saldo da conta voltou a R$ 0,00 na observação. Localizar por descrição e conferir histórico antes de qualquer limpeza.

## Passagem para nova sessão — 26/11/2026

**Interrupção:** o provedor do Chrome retornou `The browser access host is unavailable` mesmo após reinício autorizado. SuperTcL informou que identificou ausência de variáveis de acesso injetadas na inicialização da sessão; este diagnóstico foi informado por ele, não verificado independentemente aqui. Não atribuir ao produto nem contornar o controle. Próxima sessão deve testar o acesso antes de prosseguir. Capturas originais foram perdidas; recapturar ao reproduzir defeitos.

**CT-16, ponto exato:** entrar como Gestor PCM de teste, abrir PCM > Chamados > Kanban, selecionar Sinérgica - Escritório e localizar Campo a conciliar / CH-HOMOLOG-PCM-01. Gestor já viu cartão com motivo “Sem referência de Chamado”, referência Auvo simulada `890000000190001`, abriu detalhe correto e voltou à fila; Operador recebeu recusa explícita por falta de capacidade. Falta apenas tentar selecionar ou iniciar arraste comum e verificar se não retira o cartão da fila, como pede o passo 3. Não concluir triagem nem soltar em outra coluna; conferir depois se o cartão permanece. Erros `windowNotFoundAtPosition` em outras tentativas foram da ferramenta, não provam defeito. A ausência de arraste mantém o caso em triagem.

**Contas:** Gestor `[TESTE CADERNO] Gestor PCM 26-11-2026`, `gestor-pcm-caderno-20261126@teste.invalid`, perfil preexistente `Homologação — Gestor PCM`; Operador `[TESTE CADERNO] Operador PCM 26-11-2026`, `operador-pcm-caderno-20261126@teste.invalid`, perfil `Homologação — Operador PCM`. Ambos autenticaram sem confirmação de e-mail. Senhas distintas somente nos arquivos locais privados `credenciais-teste-locais.txt` e `credencial-operador-local.txt`, nesta pasta; não copiar ao relatório ou enviar por mensagem. Antes do reinício, Superadmin estava na janela normal e sessão de teste na anônima; após reinício, estado das sessões não foi comprovado. Usar janela separada, não salvar senha no navegador. Outras contas ainda não foram criadas; criar apenas quando seu caso chegar e respeitar as instruções vigentes de autorização. O segundo cliente E2E consultado era preexistente; não afirmar criação.

**Próximas etapas dos 36 casos em triagem com trabalho ainda não observado:**

| Caso | Próxima etapa concreta |
| --- | --- |
| CT-01 | Conferir dados reservados do roteiro e abertura em sessão nova do Gestor, incluindo identificação do deploy. |
| CT-05 | Como Gestor ou Operador, abrir OS pela aba OS do Escritório e conferir o retorno ao Cliente, se oferecido; verificar demais abas. |
| CT-08 | Conferir identificadores na trilha Área/Local/equipamento e repetir no perfil previsto. |
| CT-12 | Verificar indicação dos campos obrigatórios e do número ao criar, com nova massa identificada apenas se necessária; CH-3322 já persiste após recarga. |
| CT-13 | Verificar reabertura condicional de OS finalizada de teste e repetir a negativa de salto como Gestor, sem usar OS operacional real. |
| CT-14 | Comparar painel Backlog com o roteiro de composição por escopo; identificar registros e filtros esperados. |
| CT-15 | Identificar jornada de escopo composto e testar liberação parcial apenas em massa fictícia; itens de inspeção observados não provaram esse fluxo. |
| CT-16 | Executar tentativa de arraste sem concluir triagem conforme instrução acima. |
| CT-18 | Comparar Agenda por dia/técnico com visita e regra de horário/fuso; DEF-03 já registra divergência aparente. |
| CT-20 | Consultar trecho existente, origem, destino e duração; repetir visão por técnico com massa autorizada. Fabrício continua inativo no último estado conhecido. |
| CT-22 | Com Inspetor, localizar Diagnóstico Inicial e conferir vínculos e histórico de INSP-0044. |
| CT-23 | Com Inspetor e massa fictícia, conferir mídia e exportação; revisar DEF-04 cujo detalhe foi perdido e DEF-05. |
| CT-25 | Confrontar roteiro com a interface para distinguir criação manual de plano PMOC de criação de contrato; manter consulta sem ativar criação manual. |
| CT-27 | Comparar troca de cliente e tratamento de rascunho com critérios do caderno; DEF-25 já registra descarte sem aviso. |
| CT-29 | Conferir histórico e concorrência em lista fictícia; Organizar linhas já falhou em DEF-11. Não presumir resultado de concorrência. |
| CT-30 | Repetir consulta de orçamento na OS de teste; registrar falha DEF-12 e preparar orçamento fictício quando permitido para conferir vínculos e revisão. |
| CT-31 | Comparar dashboard e carteira por período e filtros com oportunidade fictícia, usando perfil Comercial quando disponível. |
| CT-32 | Em oportunidade fictícia, testar mudança de etapa e perda conforme roteiro, com motivo de teste; falha anterior de arraste foi da ferramenta. |
| CT-35 | Conferir vigência e legibilidade, escrita em configuração reservada e negativa do perfil de leitura; não alterar configuração operacional. |
| CT-36 | Comparar valores do dashboard com massa identificada e verificar perfil de leitura previsto no roteiro. |
| CT-37 | Comparar movimentações e saldos da conta de teste após operações fictícias; verificar DEF-31 de data de corte. |
| CT-38 | Completar filtros de período, categoria e status, recarga e histórico/auditoria do lançamento de teste já estornado; DEF-47 registra apresentação do resultado. |
| CT-39 | Criar segunda conta identificada e preparar massa pequena fictícia; testar comprovante e transferência conforme roteiro, sem movimentar dinheiro real. |
| CT-40 | Preparar OFX sintético identificado e testar importação e duplicidade na conta fictícia, sem usar extrato real. |
| CT-41 | Preparar lançamentos fictícios para comparar contas a receber/pagar e visão por faixa; DEF-18 registra ausência de vazio. |
| CT-42 | Conferir custo/hora e histórico com pessoa de teste autorizada; não editar pessoa real. DEF-23 carece dos valores originais. |
| CT-44 | Conferir efeitos e auditoria de fechamento em competência reservada antes de qualquer gravação; não alterar competência operacional sem autorização específica. |
| CT-45 | Conferir integração com provedor e fluxo somente com destinatário e massa controlados; nenhum envio real autorizado foi comprovado. |
| CT-47 | Consultar conversa de teste controlada e perfil próprio; não abrir ou alterar conversa real desnecessariamente. |
| CT-50 | Confrontar condições restantes das abas e perfil de leitura; não alterar configurações reais. |
| CT-51 | Testar gravação/restauração e troca de cliente com texto fictício e perfil de leitura; preservar conteúdo existente. |
| CT-55 | Comparar vínculos de equipe, funcionário e ferramentas; Fabrício inativo pode impedir seleção. |
| CT-56 | Reabrir roteiro fictício para conferir pergunta obrigatória; testar recusa de Financeiro sem PCM quando houver conta. |
| CT-63 | Repetir troca de contexto e observar timeout de erro; DEF-25 e DEF-26 já registrados. Gravação offline só com massa reservada. |
| CT-64 | Repetir teclado e foco, testar rolagem horizontal e navegação em largura reduzida; DEF-19 já registrado. |
| CT-65 | Abrir sessão nova, medir primeira abertura e navegar módulos conforme roteiro, verificando preservação de contexto. |

**Suspeitas sem conclusão:** CT-12 abriu formulário com outro cliente pré-selecionado; a origem não foi determinada e a relação com DEF-43 não está comprovada. CT-17 mostrou zero tentativas e tarefa vazia, mas a interface não prova ausência de mensagem no Auvo. CT-18 tem divergência aparente entre turno e horário (DEF-03), cuja regra de fuso não foi estabelecida. CT-15/DEF-21 exige confirmar regra sobre pendências aparecerem antes da triagem. CT-30 falhou na consulta de orçamento sem massa para validar vínculo. Não há outra suspeita específica preservada com evidência suficiente para descrever; não inventar defeitos.

**Limites:** não enviar tarefa real ao Auvo com Fabrício inativo; não alterar usuários existentes; manter massa fictícia identificada e não limpar sem decisão do dono. Não corrigir código, abrir PR, fazer push ou deploy nesta fase. CT-48 e CT-49 despriorizados. Contagem mais recente: 11 reprovados, 12 bloqueados, 40 em triagem, 2 despriorizados, 0 aprovados integrais; 4 dos 40 têm etapas observadas coerentes com perfil ou condição externa pendente. A lista de limpeza consolidada está imediatamente acima.


# Sessão 3 (agente Claude) — 26/11/2026

**Acesso ao navegador:** restabelecido. A extensão Claude in Chrome alcança o Chrome local (`Browser 1`, deviceId `e5a944e4-…`). O provedor do codex não foi usado. Ambiente: <https://so-sinergica.netlify.app>. A sessão encontrada na janela normal é a do Superadmin (barra lateral com os seis módulos mais Configurações); as sessões anônimas de Gestor e Operador não sobreviveram ao reinício.

**Novo insumo que as sessões anteriores não tinham:** o caderno PDF foi extraído em texto com `pdftotext -layout` (3.652 linhas). Os passos e resultados esperados de cada CT agora estão disponíveis, o que permite confrontar o observado com o roteiro em vez de só descrever a tela.

**Limite de autorização desta sessão:** não digito senha em `so-sinergica.netlify.app`, que o repositório identifica como origem de produção (`PROD_ORIGIN` em `scripts/smoke-edge-functions.mjs`). Logo, não consigo autenticar as contas `[TESTE CADERNO] Gestor PCM` e `[TESTE CADERNO] Operador PCM` nem criar/entrar com Inspetor, Financeiro, cliente-síndico ou usuário isolado. Os casos que dependem de perfil ficam na mesma situação de antes; os executáveis pelo Superadmin seguiram.

## CT-16 — Conferir a OS de Campo a conciliar: **APROVADO**

Passos do caderno conferidos (1 e 2 e 4 pelas sessões anteriores nos perfis previstos; 3 nesta sessão):

1. **Cartão localizado.** Com Sinérgica - Escritório selecionado, a coluna `CAMPO A CONCILIAR` mostra 1 cartão `[TESTE HOMOLOGAÇÃO] Campo a conciliar`, com o motivo `Sem referência de Chamado`. Observado hoje como Superadmin; a sessão anterior observou o mesmo como Gestor PCM.
2. **Referência externa e detalhe.** `CH-HOMOLOG-PCM-01`, Tarefa Auvo simulada `890000000190001`; a sessão anterior abriu o detalhe e ele correspondeu à mesma OS.
3. **Não sai por arraste comum — verificado nesta sessão.** O cartão da fila `Campo a conciliar` é um `BUTTON` com `draggable=false` e **sem** o seletor de fase que os cartões das outras colunas têm. Medição pela árvore do DOM, por coluna, com o Escritório selecionado: Solicitação 5 arrastáveis / 5 seletores; Planejamento 4/4; Em execução 2/2; **Campo a conciliar 1 cartão, 0 arrastáveis, 0 seletores**. A tentativa de arraste (pressionar o cartão e mover 103 px para baixo, soltando dentro da própria coluna) não iniciou arraste e não alterou nada. Após recarregar a aplicação inteira e refazer módulo → Chamados → Kanban → Escritório, a coluna continua com 1 cartão e o mesmo `CH-HOMOLOG-PCM-01`. Nenhuma triagem foi concluída e o cartão não foi solto em outra coluna.
4. **Recusa ao Operador PCM.** Registrada pela sessão anterior: `Campo a conciliar: você não tem a capacidade de validação neste Cliente.` — recusa explícita, não fila vazia.

**Ressalva registrada, não omitida:** o passo 3 foi executado como Superadmin, não como Gestor PCM. O argumento é de superconjunto — a afordância de arraste não existe para a conta de maior capacidade, logo não existe para uma conta de capacidade menor. Não é prova direta na sessão do Gestor. Nenhum dado foi alterado.

Evidência: `CT-16-campo-a-conciliar-apos-arraste-2026-11-26.jpg`.

## CT-14 — Consultar Backlog de escopo e prioridade: **REPROVADO**

Caminho: Chamados > aba Backlog ("Backlog GUT — OS abertas priorizadas por gravidade, urgência e tendência"). Superadmin, nenhuma gravação.

- **Passo 1 — "A consulta exige e respeita o Cliente": falhou.** Com o filtro de cliente do módulo em "Todos os clientes", o painel abre sem exigir seleção e mistura clientes: 11 itens de 4 clientes distintos (`Sinérgica - Escritório`, `Aldo Cardarelli`, `[TESTE E2E] Cliente 360 Cockpit A`, `[TESTE E2E] Cliente S90 1791310960607`). Não houve pedido de seleção de cliente em nenhum momento.
- **Passo 2 — "O item não aparece duplicado como Backlog e OS operacional": falhou.** Com o Escritório selecionado, a fila do Backlog lista `CH-3302` (Planejamento), `CH-3303` (Planejamento) e `CH-HOMOLOG-PCM-02` (Planejamento), que estão simultaneamente nos cartões da coluna Planejamento do Kanban; e lista as pendências `Aguardando triagem / Solicitação`, que aparecem na coluna Solicitação. O próprio subtítulo do painel diz "OS abertas priorizadas", ou seja, a duplicação é como a tela foi construída. Reforça o DEF-21, que tratava só das pendências de inspeção.
- **Passo 3 — "Abrir um item e consultar escopo, origem e prioridade GUT": parcialmente contrariado.** Clicar no item `CH-3302` abre o diálogo **`Editar Chamado CH-3302 — Alteração de campos da OS`**, com `Salvar alterações`, num caso que o caderno classifica como Consulta. Os critérios GUT estão presentes (`GUTD Score 3.0 · Média`, Gravidade 3, Urgência 3, Tendência 3, Dor do cliente "Não avaliado"). **Escopo** não é apresentado, e a **origem** não aparece nesse diálogo (os cartões de inspeção exibem `Origem: Inspeção` na fila, mas o `CH-3302` não traz origem em lugar nenhum). Cancelei sem gravar. Evidência: `CT-14-passo3-item-abre-em-edicao-2026-11-26.jpg`.
- **Passo 4 — "O painel não conserva itens do Cliente anterior": passou.** Trocando o cliente do módulo de Sinérgica - Escritório para `H2 Poker Club - Climatização` e reabrindo a aba Backlog, a fila passou a 10 de 10, todos do novo cliente, sem nenhum item do Escritório.

### DEF-49 — Backlog GUT com "Todos os clientes" mostra menos itens do que um único cliente

**Data:** 26/11/2026. **Reprodução:** PCM > Chamados > aba Backlog.
- Filtro de cliente do módulo em `Sinérgica - Escritório`: o painel mostra `OS ABERTAS 40` e a fila `40 de 40`, todos do Escritório.
- Filtro do módulo em `H2 Poker Club - Climatização`: `10 de 10`, todos do novo cliente.
- Filtro do módulo em `Todos os clientes`: `OS ABERTAS 11` e fila `11 de 11`, de 4 clientes. **Onze é menos que os quarenta de um único cliente.** No mesmo cabeçalho a aplicação informa `ABERTAS 2647`.
- Dentro desse estado, usar o seletor próprio do painel ("Todos os clientes" / "Sinérgica - Escritório", dentro de "Fila priorizada") para escolher o Escritório devolve `5 de 11` — o mesmo cliente que, pelo filtro do módulo, devolvia 40. O seletor do painel filtra uma lista já truncada.

**Esperado:** a fila sem filtro de cliente deve conter ao menos tudo o que aparece ao filtrar por um cliente, e os dois seletores de cliente devem produzir o mesmo conjunto para o mesmo cliente. **Impacto:** priorização feita na visão "Todos" omite a maior parte da carteira sem avisar. Não foi investigada a causa nem o que o servidor retorna. Evidência: `DEF-49-backlog-todos-clientes-11-itens-2026-11-26.jpg`.

### OBS — chip "Backlog 0" ao lado de uma aba Backlog com 40 itens

No cabeçalho de Chamados o chip `Backlog 0` aparece em todas as combinações observadas, inclusive quando a aba Backlog lista 40 itens para o Escritório. Não registro como defeito porque o chip pode contar um estado próprio (OS com fase "backlog") diferente da fila GUT; falta confirmar a regra. Fica como suspeita a apurar, não como achado.

### DEF-01 — recapturado

Com `Sinérgica - Escritório` selecionado no Kanban, a coluna `PREVENTIVA` exibe 12 cartões, todos de `H2 Poker Club - Climatização`. Reproduzido hoje na sessão Superadmin, somando-se à reprodução anterior na sessão Gestor. Evidência nova: `DEF-01-kanban-preventiva-cliente-divergente-2026-11-26.jpg`. A causa continua não determinada.

## CT-18 — Conferir a Agenda como projeção da Visita: **APROVADO nos quatro passos**

PCM > Planejamento e Visitas, semana 23 a 28/11/2026, Superadmin, nenhuma gravação.

- **Passo 1 — "A Visita aparece como planejada, vinculada ao Escritório": conferido.** Em QUA. 25/11 aparece `[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo`, turno `Tarde`, `Sinérgica - Escritório`, `Responsável · Visita planejada`.
- **Passo 2 — "A mesma Visita mantém data, horário e responsável": conferido.** Alternando `Por dia` e `Por técnico`, a Visita permanece em 25/11, com o mesmo turno `Tarde` e o mesmo responsável. O que a Agenda apresenta é turno, não hora exata, nas duas visões; a consistência entre as duas visões, que é o que o passo exige, se manteve.
- **Passo 3 — "A projeção mostra CH-HOMOLOG-PCM-02; não é uma nova OS": conferido.** A célula traz `1 OS: CH-HOMOLOG-PCM-02`. O cabeçalho da tela diz "Projeção das Visitas da semana — não é cadastro: a alocação nasce da Visita". Nenhuma OS nova apareceu.
- **Passo 4 — "O filtro muda o período sem duplicar alocação ou Visita": conferido.** Avançando uma semana: "Nenhuma Visita planejada nesta semana. A agenda do técnico deriva da Visita: planeje a Visita e ela aparece aqui." Voltando, a mesma e única Visita reaparece, sem duplicata.

Evidência: `CT-18-agenda-por-tecnico-2026-11-26.jpg`.

**Ressalva que o dono deve arbitrar:** o DEF-03 continua aberto e foi originalmente anotado sob o CT-18. Ele é a divergência entre a Agenda, que mostra turno `Tarde` em 25/11, e o Monitor Auvo, que mostra para a mesma OS `25/11/2026 às 20:42:27` — 20h42 não é tarde. Essa comparação é entre duas telas e **não corresponde a nenhum dos quatro passos do CT-18**, que só exigem coerência entre `Por dia` e `Por técnico`. Por isso classifico o CT-18 como aprovado e mantenho o DEF-03 registrado como defeito independente. Se o dono entender que o caderno pretendia cobrir a hora real aqui, o veredito vira reprovado — é julgamento, não evidência, e fica explícito.

Executado como Superadmin; o caderno prevê Gestor PCM. Os quatro passos são de consulta e não dependem de capacidade além da leitura, mas a repetição no perfil previsto não foi feita.

### DEF-50 — Botões de navegação de semana da Agenda não têm nome acessível

**Data:** 26/11/2026. **Caso:** CT-18, com impacto em CT-64. **Reprodução:** PCM > Planejamento e Visitas. Os dois botões que avançam e retrocedem a semana, à esquerda e à direita de `Hoje`, contêm apenas um `<svg>`: sem texto, sem `aria-label` e sem `title` (verificado no DOM, os três atributos nulos). Um leitor de tela anuncia dois botões sem nome, e não há como saber qual avança e qual retrocede sem enxergar o ícone. Os botões `Hoje`, `Por dia` e `Por técnico`, ao lado, têm texto normal.

**Esperado:** todo controle acionável tem nome acessível. **Impacto:** a navegação de período da Agenda fica indisponível para quem usa leitor de tela. Não foi usado leitor de tela real; o achado vem da árvore do DOM. Nenhum dado alterado.

## CT-17 — Conferir exceção de Visita não confirmada: **APROVADO nos quatro passos**

PCM > Monitor Auvo (T−24), Superadmin, nenhuma gravação. Evidência: `CT-17-monitor-auvo-t24-2026-11-26.jpg`.

- **Passo 1 — "A consulta é carregada para o Cliente selecionado": conferido.** Sem cliente, a tela mostra "Selecione um Cliente para consultar as exceções do Auvo em T−24" e os três contadores zerados. Escolhendo Sinérgica - Escritório, carrega `Falha de envio: 0 · Visita não confirmada: 1 · Tarefa órfã: 1`.
- **Passo 2 — "A linha identifica a Visita não confirmada, a OS e o horário": conferido.** Linha: `Visita não confirmada | Sinérgica - Escritório | CH-HOMOLOG-PCM-02 | Visita 25/11/2026, 20:42:27 | Tarefa Auvo — | Tentativas 0 | Visita planejada, sem confirmação | Quando 24/11/2026, 20:42:27`.
- **Passo 3 — "zero tentativa e o motivo de Visita ainda planejada": conferido.** `Tentativas 0`, motivo `Visita planejada, sem confirmação`.
- **Passo 4 — "A leitura não confirma a Visita nem cria tarefa ou mensagem no Auvo": conferido do lado do SO.** Limpei o registro de rede, desselecionei e reselecionei o cliente para refazer a consulta e capturei **uma única requisição**: `POST .../rest/v1/rpc/sso_listar_excecoes_auvo_t24`, status 200 — uma RPC de listagem. Nenhuma outra chamada foi feita, em particular nenhuma de envio ou confirmação. Depois da consulta repetida, a exceção continua `Visita não confirmada` com `Tentativas 0`. O cabeçalho da própria tela declara "Leitura apenas".

**Ressalva registrada:** não tenho acesso ao Auvo e **não verifiquei o lado externo**. O que está provado é que o cliente não emitiu nenhuma chamada capaz de criar tarefa ou mensagem, e que o estado local não mudou. Isso é mais forte do que a observação anterior, que só tinha a tela, mas não é inspeção no Auvo. Executado como Superadmin; o caderno prevê Gestor PCM, e a sessão anterior já havia feito os passos 1 a 3 como Gestor com os mesmos valores.

**Reforço do DEF-03:** a mesma OS `CH-HOMOLOG-PCM-02` aparece aqui com Visita em `25/11/2026, 20:42:27` e, na Agenda, com turno `Tarde` no mesmo dia. 20h42 não é tarde. A divergência continua aberta e sem causa determinada.

## CT-13 — Recusar salto direto para Finalizado: **permanece em triagem**

- **Passo 1 — conferido.** `CH-3303`, massa `[TESTE CADERNO]`, estava em Planejamento, coluna com 4 cartões, Finalizado com 0 e rótulo "Vazio".
- **Passo 2 — tentativa inconclusiva nesta sessão.** Arrastei o cartão de Planejamento até a coluna Finalizado duas vezes com o controle de mouse da ferramenta. O cartão não se moveu, Finalizado continuou "Vazio" — **e nenhuma mensagem apareceu**. Não consigo distinguir "o quadro recusou em silêncio" de "o arraste sintético nunca disparou o `dragstart`": o cartão tem `draggable=true`, mas eventos de arraste HTML5 gerados por automação nem sempre chegam à aplicação. **Não registro defeito por ausência de mensagem**, porque a sessão anterior, com arraste real sobre `PRE-A6C3B6A4`, viu a recusa com a mensagem de que a validação PCM é necessária. A evidência daquela sessão continua valendo para o passo 2; a desta não acrescenta nada.
- **Tentativa alternativa barrada.** Quis repetir a transição proibida pelo seletor de fase do cartão, que é o outro controle da mesma regra. A camada de permissão do meu ambiente recusou a ação ("Modify Shared Resources"). Não contornei.
- **Passo 3 — coberto pela sessão anterior**, que atualizou e reabriu o detalhe e viu a OS ainda em Planejamento.
- **Passo 4 — condição ausente.** O passo é condicional ("Se houver OS finalizada exclusiva de teste"). Com o Escritório selecionado, a coluna Finalizado tem 0 cartões; não existe OS finalizada exclusiva de teste para tentar reabrir por arraste. O cartão de estatística do cabeçalho diz `FINALIZADAS 9` enquanto a coluna diz 0, mas o filtro de situação está em "Ativos", o que explica a diferença sem ser defeito.

**Próxima etapa concreta:** um humano faz o arraste de uma OS de teste de Planejamento para Finalizado e confirma a mensagem de recusa; e, para o passo 4, finalizar uma OS exclusiva de teste pelo fluxo próprio para então tentar reabri-la por arraste. Ambos dependem de gravação, que esta sessão não executa.

**Observação registrada, sem veredito:** o seletor de fase do cartão em Planejamento oferece `Finalizado` como opção **habilitada**, junto de todas as outras fases, em vez de desabilitar as transições que a regra recusa. Se a recusa só acontece depois da tentativa, o usuário é convidado a uma ação que será negada. Não confirmei o que acontece ao escolher, porque a ação foi barrada no meu ambiente; por isso fica como observação a apurar, não como defeito.

## CT-05 — Abrir a Visão 360 do Cliente: **APROVADO**

PCM > Clientes, Superadmin, nenhuma gravação.

- **Passo 1 — conferido.** Busca por "Sinérgica - Escritório" devolveu `1 de 56 cadastro(s) visíveis`, com CNPJ 37502245000127 e Auvo 12807211. `Ver 360` abriu a Visão 360 do cliente certo.
- **Passo 2 — conferido nas quatro abas.** `Resumo` (OS ABERTAS 11, SINAL AUVO 100%, BACKLOG 11, ATIVOS 3, com Contatos, Grupos e Responsáveis em estados vazios explícitos: "Não pertence a nenhum grupo.", "Nenhum responsável cadastrado."); `Timeline` (10 eventos em ordem cronológica); `OS` (Backlog com 11 OS em aberto e Histórico de OS); `Estrutura` (9 registros tipados). O cabeçalho do cliente permaneceu o mesmo em todas.
- **Passo 3 — conferido.** Abri `CH-3302` pela aba OS: o detalhe corresponde à OS selecionada (`OS CH-3302 · planejamento`, categoria corretiva, origem `solicitacao_cliente`, listas de materiais do caderno com revisões 3 e 5). O detalhe abre **dentro** da Visão 360, de modo que o Cliente de origem nunca é perdido; não há controle separado de retorno nesse caminho, e o passo é condicional ("quando oferecido").

Executado como Superadmin; o caderno admite Gestor PCM ou Operador PCM, e o roteiro é só consulta.

**Defeitos já conhecidos reconfirmados nesta passagem, sem veredito novo:** DEF-40 (carteira de Clientes mostra `OS abertas 1` para o Escritório enquanto a Visão 360 mostra `OS ABERTAS 11` e `BACKLOG 11`); DEF-29 (`Ativos Auvo atualizados` com `Último equipamento no cache: #null`); DEF-30 (o detalhe de CH-3302 exibe seis avisos técnicos que citam nomes de flag e de gate ao usuário final: `VITE_SSO_ORDENS_CHAMADO_ENABLED`, `VITE_SSO_CRIAR_OS_CHAMADO_ENABLED` com `pcm.sso_criacao_os_mediada_gate`, `VITE_SSO_CANONICALIZAR_CHAMADO_ENABLED`, `VITE_SSO_CONVERSAO_INTEGRAL_ENABLED` com `pcm.chamado_os_gate`, `VITE_SSO_ESCOPO_CHAMADO_ENABLED`, `VITE_SSO_GESTAO_ESCOPO_CHAMADO_ENABLED`); DEF-12 (no mesmo detalhe, `Consultando orçamentos…` seguido de dois avisos de recurso indisponível).

## CT-08 — Navegar pela localização física: **APROVADO**

Visão 360 > Estrutura do Escritório, Superadmin, nenhuma gravação. Evidência: `CT-08-estrutura-detalhe-ativo-2026-11-26.jpg`.

- **Passo 1 — conferido.** `Navegar` na Área `[TESTE CADERNO] Codex 25-11-2026 Área Técnica` (TCA): a trilha passou a `Voltar ao Cliente › Área: …Área Técnica` e os resultados caíram para o contexto da Área — apenas o Local `…Sala Técnica` (TCL).
- **Passo 2 — conferido.** `Navegar` no Local Sala Técnica: a trilha virou `Voltar ao Cliente › Área: … › Local: …` e a lista passou aos itens daquele contexto: Equipamento Bomba Técnica, Equipamento "Componente válvula", Grupo Quantitativo Luminárias e Sistema Hidráulico.
- **Passo 3 — conferido.** Clicando no item anterior da trilha (`Área: …`), o contexto recuou corretamente e a lista voltou a mostrar só o Local. `Voltar ao Cliente` limpou a trilha por inteiro e restaurou os 9 registros do cliente.
- **Passo 4 — conferido.** Antes e depois da navegação a lista tem exatamente os mesmos 9 registros, sem cópia. Em `Ver detalhes` da Bomba Técnica, `INSTALADO EM` continua `Sinérgica - Escritório › …Área Técnica › …Sala Técnica`, `Código: TESTE-CADERNO-CODEX-BOMBA-251126`, categoria Bomba Hidráulica, Sistema vinculado `…Sistema Hidráulico`. A navegação não alterou a localização.

Executado como Superadmin; o caderno prevê Gestor PCM, e o roteiro é só consulta.

**DEF-28 reconfirmado:** o registro `[TESTE CADERNO] Codex 26-11-2026 Componente válvula` continua listado com Tipo **Equipamento** na busca tipada da estrutura.

**Extensão do DEF-30 para a Estrutura e para o painel de detalhe do ativo:** a mesma página de Estrutura do Cliente 360 repete, para o usuário final, **doze ocorrências** da frase `Este recurso existe e ainda não está disponível para a sua operação.` sem nomear o recurso, e exibe o nome cru da flag `VITE_SSO_POLITICA_EQUIPMENT_ENABLED` com o rótulo "Política de Equipment existe e ainda não está ativado.". O painel `Detalhe do ativo` repete a mesma frase mais três vezes. Isso é o mesmo defeito de vazamento técnico já registrado no DEF-30 e o mesmo aviso genérico do DEF-09, agora com localização e contagem exatas; não abro número novo.

## CT-06 — Pesquisar nome código e TAG com tipo explícito: **APROVADO**

Visão 360 > Estrutura do Escritório, campo "Nome, código ou TAG" + botão "Pesquisar estrutura". Consultas apenas, nenhuma gravação.

- **Passo 1 — conferido.** `Bomba` devolveu uma linha: `Equipamento · [TESTE CADERNO] Codex 25-11-2026 Bomba Técnica · TESTE-CADERNO-CODEX-BOMBA-251126`, com as três colunas Tipo, Nome e Código / TAG.
- **Passo 2 — conferido.** `TESTE-CADERNO-CODEX-BOMBA-251126` devolveu exatamente a mesma e única entidade. Nenhum registro de outro Cliente apareceu.
- **Passo 3 — conferido.** Busca sem correspondência (`zzxqnaoexiste123`) devolveu `Nenhum resultado neste contexto ou filtro.` — mensagem de filtro, sem erro técnico.
- **Passo 4 — conferido.** `Ventilação` e `Ventilacao` devolveram a mesma entidade `[TESTE CADERNO] Codex 25-11-2026 Ventilação · TESTE-CADERNO-CODEX-251126`.

Executado como Superadmin; o caderno prevê Gestor PCM, e o roteiro é só consulta.

## CT-03 — parcial: grupos do menu conferidos, "respeita o acesso" não é demonstrável nesta sessão

- **Passo 1, primeira metade — conferido.** A barra lateral do PCM apresenta os três grupos que o caderno nomeia: `TRABALHO` (com as seções ROTINA, PLANEJAMENTO E VISITAS, CLIENTES E ESTRUTURA, RELATÓRIOS), `GESTÃO` (Equipes, Funcionários, Ferramentas, Ferramentas por Técnico) e `ADMINISTRAÇÃO` (seções CATÁLOGOS e ACESSOS).
- **Passo 1, segunda metade — não demonstrável como Superadmin.** "respeita o acesso do usuário" exige uma conta de capacidade limitada; a conta disponível vê tudo. Fica pendente de perfil.
- **Passo 1, "não há tela vazia ao clicar" — varri as dezesseis entradas do grupo TRABALHO.** Quinze abriram com conteúdo e título próprios (Materiais e Aquisições, Chamados, Inspeções, PMOC, Preventivas, Planejamento e Visitas, Monitor Auvo, Clientes, Sistemas, Componentes e os relatórios). A exceção está na observação abaixo.
- **Passos 2 e 3** já foram conferidos pela sessão anterior e reconferidos em parte nesta (Chamados, Planejamento e Visitas e Clientes abriram suas jornadas). O Guia do SO não foi reaberto nesta sessão.

**Veredito CT-03: permanece em triagem**, por causa da metade do passo 1 que depende de perfil.

### OBS — PCM > Dashboard demora mais de 8 segundos em esqueleto, sem conteúdo

Clicando em PCM > Dashboard, a área principal ficou com três barras cinzas de esqueleto e `innerText` de comprimento **zero** após 2,5 s e ainda após 8 s. Em medição posterior, já tinha renderizado (3.176 caracteres, título `PCM · Operação — Dados reais de OS, backlog, inspeções e caches sincronizados do Auvo`); o tempo exato de carga ficou entre 8 e 28 segundos, não foi cronometrado com precisão. Durante a espera havia um `POST .../auth/v1/token?grant_type=refresh_token` **pendente**, o que sugere renovação de sessão em curso. Nenhum erro de console foi capturado.

**Não registro defeito.** O esqueleto é feedback legítimo, a tela carregou, e a renovação de token pode explicar a espera. Fica como observação medida para quem for olhar desempenho, e como lembrete de que a leitura de "tela vazia" por automação precisa de espera generosa antes de virar achado.

### DEF-49 — reforço decisivo: três telas, três números e três conjuntos para "OS abertas do Escritório"

Tudo abaixo é leitura de tela, sem gravação. Para o **mesmo cliente Sinérgica - Escritório**, no mesmo dia e na mesma sessão:

| Tela | Número | O que lista |
| --- | --- | --- |
| PCM > Clientes, carteira | `OS abertas 1` | — |
| Visão 360 > Resumo | `OS ABERTAS 11` e `BACKLOG 11` | — |
| Visão 360 > aba OS, "Backlog (OS em aberto)" | 11 itens | CH-3302, PRE-1D306137, CH-3303, PRE-C0748047, CH-HOMOLOG-PCM-01, CH-HOMOLOG-PCM-02, CH-2737, CH-2676, CH-0720, OS-0050, OS-0051 |
| Chamados > aba Backlog ("Backlog GUT"), filtro do módulo em Escritório | `OS ABERTAS 40`, fila `40 de 40` | CH-3302, a pendência "Fiação com emenda inadequada", CH-3303, a pendência "[TESTE CADERNO] Item de inspeção fictício", CH-HOMOLOG-PCM-02, CH-3322, CH-3301, CH-2513, CH-2480, CH-2447, CH-2414, CH-2381, CH-2348, CH-2315, CH-2282, CH-2249, CH-2216, CH-2183, CH-2150, CH-2117, CH-2084, CH-2051, CH-2018, CH-1985, CH-1952, CH-1919, CH-1886, CH-1853, CH-1820, CH-1787, CH-1754, CH-1720, CH-1687, CH-1654, CH-1621, CH-1588, CH-1556, CH-0277, CH-0081, CH-0021 |
| Chamados > aba Backlog, filtro do módulo em "Todos os clientes" | `OS ABERTAS 11`, fila `11 de 11`, 4 clientes | — |
| Chamados > aba Backlog, filtro do módulo em "Todos" e seletor do painel em Escritório | `5 de 11` | — |

**Os dois conjuntos de 11 e de 40 não são um subconjunto do outro.** A lista do Cliente 360 traz seis registros que a fila GUT não traz (`CH-HOMOLOG-PCM-01`, `CH-2737`, `CH-2676`, `CH-0720`, `OS-0050`, `OS-0051`), e a fila GUT traz mais de trinta que o Cliente 360 não traz (`CH-3322`, `CH-3301` e a série `CH-1556` a `CH-2513`, quase toda intitulada "Limpeza Filtros - AC H2"). Cinco apuração do mesmo conceito, cinco respostas: 1, 11, 11, 40 e 5.

**Esperado:** o mesmo cliente, no mesmo instante, deve ter uma contagem de OS abertas; se duas telas usam critérios diferentes, o critério precisa estar escrito na tela. **Impacto:** a priorização e a conversa com o cliente mudam conforme a tela aberta, sem que o usuário saiba qual está certa. **Não investiguei a causa nem o que o servidor devolve**, e não afirmo qual número é o correto. Este bloco absorve e fortalece o DEF-40, que registrava apenas o par 1 contra 11. Evidência: `DEF-49-backlog-todos-clientes-11-itens-2026-11-26.jpg`.

## CT-25 — Conferir PMOC sem ativar a criação manual: **APROVADO**

PCM > PMOC, Superadmin, consulta pura. Evidência: `CT-25-pmoc-contrato-legado-2026-11-26.jpg`.

- **Passo 1 — conferido.** `CONTRATOS ATIVOS 1`; o contrato legado `H2 Poker Club - Climatização` está acessível e abre direto.
- **Passo 2 — conferido.** Contrato: vigência `01/08/2026 a 31/07/2027`. Imóvel: `AV DOUTOR MANOEL AFONSO FERREIRA, 400, JARDIM PARAISO, CAMPINAS, SP, 13.100-029`. `RESPONSÁVEL TÉCNICO Fabrício Medeiros`, `ART pendente`, `PRÓXIMA VISITA 01/12/2026`, `EQUIPAMENTOS 3` (AC-01, AC-02 e AC-03, Split Hi-Wall, estado bom, R-410A). Cronograma anual completo, MÊS 1 a MÊS 12, com 4 meses `Atrasado` e 8 `Agendado`, periodicidades mensal, trimestral, semestral e anual. Alertas legais listados, `ALERTAS LEGAIS 0`. Nada indica conversão ou perda pela reorganização do menu.
- **Passo 3 — conferido, e agora com a distinção que faltava.** A tela **não oferece nenhuma ação de criar Plano**: as únicas ações são `Atualizar`, `Novo PMOC`, `+ Equipamento`, `Criar OS` (por mês do cronograma), `Nova análise` e `Nova NC`. A palavra "Plano" aparece uma única vez na página, no subtítulo `Plano de Manutenção, Operação e Controle…`. O botão `Novo PMOC` é criação de **contrato**, não de plano.
  A dúvida que a sessão anterior deixou em aberto está resolvida pela configuração do próprio deploy, em `netlify.toml`: `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED = "false"`, com o comentário "E01-S203: criacao manual do Plano PMOC a partir de um Contrato PMOC (ADR-1698, decisao (b)). CONTINUA DESLIGADA, de propósito: depende de dois gates COMPARTILHADOS com E01-S166, que não foram abertos." Isso casa exatamente com o texto do caderno, que manda não abrir "os dois gates compartilhados". Ausência esperada, não erro.
- **Passo 4 — registrado.** **Nenhum pedido de ativação foi feito e nenhum gate foi aberto.** Nenhum botão de criação foi clicado, inclusive `Novo PMOC`.

Executado como Superadmin; o caderno prevê Gestor PCM, e o roteiro é só consulta.

## CT-55 — Equipes, funcionários e ferramentas: **passos 2 e 4 aprovados; permanece em triagem pelo passo 1**

PCM > Gestão, Superadmin, consulta pura. Nenhuma edição; nenhum botão `Nova equipe`, `Novo funcionário`, `Nova ferramenta`, `Editar local`, `Desativar local`, `Atribuir` ou `Reservas` foi acionado.

- **Passo 1 — identificação carrega; os vínculos vêm vazios em todas as equipes.** `Equipes` lista **6 equipes**, todas `Ativa` e todas `Sync synced`, com id Auvo próprio: `Fabrício / Davi` (37759), `Fabrício / Weslei` (36161), `Gabriel / Davi` (37869), `Gabriel / Weslei` (38752), `Weslei / Davi` (37819) e `Weslei/Gildeon` (41089). **Em 6 de 6 aparece `Participantes: nenhum` e `Gestores: nenhum`.** `Funcionários` é uma tela separada, com os técnicos sincronizados — entre eles `[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo`, com `Sync: pending`. Não há mistura entre equipe e funcionário: são telas e listas distintas.
  **Por que isso não vira defeito agora:** os nomes das equipes codificam pares de técnicos que existem em Funcionários, e mesmo assim nenhuma tem participante. Mas a própria tela avisa que participantes se mudam no Auvo ("Alterações em Equipes já sincronizadas não refletem no Auvo. Para mudar participantes lá, use o app Auvo."), e **eu não tenho acesso ao Auvo para saber se lá as equipes têm ou não participantes**. Vazio fiel a uma origem vazia é carregamento correto; vazio apesar de origem preenchida é defeito. Não dá para distinguir daqui.
  **Próxima etapa concreta:** conferir no Auvo se as equipes 37759, 36161, 37869, 38752, 37819 e 41089 têm participantes cadastrados. Se tiverem, isto vira defeito de sincronização apresentada como `synced`.
- **Passo 2 — conferido.** `Ferramentas` mostra o catálogo: `Bolsa 01` (Básico, Auvo 7374556, 3/3 unid.), `Colher` (sem categoria, 7374020, 3/3), `Facão` (Especiais, 7374022, 3/3), `Martelete` (sem categoria, 7371515, 2/2) e `Mochila 01` (Básico, 7374584, 1/1). `Ferramentas por Técnico` é outra visão — "Posse por unidade individual" — e lista os 5 técnicos, cada um com `Sem unidade atribuída no PCM`. `Ver técnico` no `[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo` abriu o diálogo "Ferramentas, transferência e histórico" com `Disponíveis` (as 12 unidades FER-0010 a FER-0021, batendo com 3+3+3+2+1 do catálogo) e `Em posse: Sem unidade atribuída.` — corresponde ao técnico escolhido. Catálogo e vínculos são distinguíveis. Fechei o diálogo pelo X, sem atribuir nada.
- **Passo 3 — não aplicável por falta de reserva.** O caderno condiciona: "Se houver cadastro reservado… Sem reserva, manter o teste em consulta." Não há cadastro reservado, e esta sessão não grava.
- **Passo 4 — conferido.** O módulo `Cockpit` abre com título "KPIs operacionais, SLA, MRR e margem — visão consolidada para gestores." e o aviso explícito **`EM CONSTRUÇÃO`**, sem indicador algum. Registro, como o caderno pede, que **isso não é entrega de indicadores gerenciais**.

**Fabrício Medeiros não aparece** entre os 5 técnicos de `Ferramentas por Técnico` (`[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo`, `Davi Guedes`, `Gabriel Aureliano`, `Gildeon Santos`, `Weslei Costa`), coerente com o estado inativo já registrado — embora ele apareça como `RESPONSÁVEL TÉCNICO` do contrato PMOC e em OS históricas.

### DEF-51 — Unidades de ferramenta já removida continuam oferecidas como disponíveis para atribuição

**Data:** 26/11/2026. **Caso:** CT-55. **Reprodução:** PCM > Gestão > Ferramentas por Técnico > `Ver técnico` em qualquer técnico. No painel `Disponíveis`, abaixo das 12 unidades válidas (`FER-0010` a `FER-0021`), aparecem mais três linhas rotuladas apenas **`Ferramenta removida`** seguidas de um código interno: `TESTE-E2E-1786589061756`, `TESTE-E2E-1786589121062` e `TESTE-E2E-1791311284086`. As três têm caixa de seleção **habilitada** (`input type=checkbox`, `disabled=false`, verificado no DOM), ao lado do botão `Atribuir`.

**Esperado:** unidade de ferramenta removida não deve figurar como disponível para atribuição; se precisar aparecer por causa de histórico, deve estar desabilitada e identificada pelo nome original, não por um código interno. **Impacto:** é possível atribuir a um técnico uma unidade de ferramenta que não existe mais, e o rótulo não diz qual ferramenta era. **Não cliquei em nenhuma caixa nem em `Atribuir`**, portanto não sei o que o servidor faz com o envio; o defeito afirmado é o que a tela oferece. As três unidades vêm de massa `TESTE-E2E` preexistente, não criada por esta validação. Evidência: `DEF-51-ferramenta-removida-disponivel-2026-11-26.jpg`.

## CT-64 — Teclado, tabelas e tamanho de tela: **REPROVADO no passo 2 (DEF-19); passos 1, 3 e 4 conferidos**

Tudo medido, sem gravação. Teclas enviadas de verdade pelo teclado, não por script.

- **Passo 1 — conferido.** Instrumentei um ouvinte de `focusin` e pressionei `Tab` vinte vezes a partir do topo em PCM > Chamados > Kanban. Catorze controles receberam foco, na ordem: os quatro seletores de filtro (situação, técnico, cliente, categoria), `Data inicial`, `Data final`, `Limpar filtros`, `Mover coluna Solicitação para a direita`, `Ocultar coluna Solicitação`, `Selecionar CH-3311`, o cartão `CH-3311` e `Mover CH-3311 para outra fase`. **Todos têm nome acessível** e **todos têm indicação visual de foco**: botões e cartões recebem `outline` de 2 px; campos e seletores recebem anel por `box-shadow`. Zero controles sem indicação.
  **Correção de um falso achado meu, registrada de propósito:** numa primeira medição eu só olhei `outline` e concluí que seis controles ficavam sem indicação de foco. Estava errado por dois motivos — eles usam anel de sombra em vez de contorno, e foco aplicado por script não aciona os mesmos estilos que o foco por teclado. Refazendo com `Tab` real e medindo contorno **e** sombra, nenhum controle ficou sem indicação. Não há defeito aqui.
  A ação essencial de mover a OS de fase **não depende do mouse**: existe um `select` focalizável cujo nome acessível é `Mover CH-3311 para outra fase`.
- **Passo 2 — REPROVADO, e é o DEF-19 reproduzido em outra tela.** Coloquei o foco no botão `Ver técnico` (PCM > Gestão > Ferramentas por Técnico), pressionei `Enter`: abriu um diálogo correto do ponto de vista estrutural — `role="dialog"`, `aria-modal="true"`, rotulado com o nome do técnico, e o foco entrou nele, no botão de fechar, que tem `aria-label="Fechar"`. Pressionei `Escape`: o diálogo fechou e **o foco foi para o `BODY`**, não para o botão `Ver técnico` que o abriu. Quem navega por teclado perde o lugar e precisa tabular desde o começo da página.
  Isso confirma o DEF-19, que a sessão anterior registrou no diálogo `Novo Cliente` e em `Ver Grupo`, agora com um terceiro diálogo e com a medição do elemento focado. Não abro número novo.
- **Passo 3 — conferido, e é exatamente o que o caderno pede.** A tabela do Monitor Auvo tem **legenda acessível visualmente oculta**: `<caption class="sr-only">Exceções do Auvo em T−24 do Cliente selecionado</caption>`. Os oito cabeçalhos são `<th scope="col">` com texto compreensível: `Exceção`, `Cliente`, `OS`, `Visita`, `Tarefa Auvo`, `Tentativas`, `Último erro`, `Quando`.
- **Passo 4 — conferido, e resolve o ponto que a sessão anterior não conseguiu verificar.** Reduzi a janela; o menor viewport que o Chrome permitiu nesta máquina foi **500 px** (pedi 420 e o sistema impôs o mínimo). Nessa largura: a barra lateral recolhe para botão de menu; a página **não** tem rolagem horizontal (`documentElement.scrollWidth === clientWidth === 500`); a tabela do Monitor cabe inteira, com os oito cabeçalhos visíveis, dentro de um contêiner `overflow-x: auto`; em Chamados, dos **68** controles do conteúdo principal, **nenhum** fica fora da área visível; e o quadro Kanban, que é o conteúdo largo de verdade, tem `overflow-x: auto` com `scrollWidth` de **2388 px** contra `clientWidth` de 442 px, ou seja, **a rolagem horizontal existe e alcança todas as colunas**. A sessão anterior havia registrado, a 400 px, que "a tabela exibiu só as colunas iniciais" e que a rolagem não pôde ser verificada por erro da ferramenta; na medição de agora, a 500 px, o conteúdo está alcançável.
  **Ressalva:** não consegui descer abaixo de 500 px de viewport nesta máquina, então larguras de telefone menores que isso continuam sem teste.

**Veredito: reprovado**, pelo passo 2. Os passos 1, 3 e 4 ficam registrados como conferidos para quando o DEF-19 for corrigido.

## CT-50 — Configuração, conhecimento e automações: **passos 1, 2 e 4 conferidos; BLOQUEADO para conclusão pelo passo 3**

Atendimento > Config, Superadmin, consulta pura. Nenhuma configuração alterada, nenhum fluxo ativado, nenhum botão `Adicionar`, `Nova entrada`, `Novo template`, `Nova regra`, `Novo cluster` acionado.

- **Passos 1 e 2 — conferidos nas dezoito abas.** Percorri todas e cada uma trouxe conteúdo próprio ou estado vazio explícito e legível:

| Aba | Estado observado |
| --- | --- |
| IA | `Identidade e modelo — Modelo LLM e janela de atendimento por persona`, com conteúdo |
| Resposta automática | `Resposta automática do Zé — Regra global, igual para todos os clientes` |
| Operação | `Agente Comercial — WhatsApp` e `Zé — Chamados (PCM)` |
| Conhecimento | `0 entrada(s) ativa(s) de 0 total.` |
| Meta WA | `0 conexão(ões) de Meta WA.` |
| Templates | `Nenhum template cadastrado ainda.` |
| Instagram | `0 conexão(ões) de Instagram.` |
| Messenger | `0 conexão(ões) de Messenger.` |
| Coment. IG | `Nenhuma automação de comentário cadastrada ainda.` |
| Opt-outs | `Contatos que pediram para não receber mensagens.` — vazio |
| Scoring | `Lead scoring por comportamento — Regras globais de pontuação de lead`, com conteúdo |
| Clusters | `Nenhum cluster cadastrado ainda.` |
| Evolution | `API Evolution` com conteúdo de configuração |
| Canal | `Config do Zé por condomínio`, com a lista de clientes |
| Tags | `Tags de conversa — Catálogo usado para classificar conversas no Inbox` — vazio |
| Personas | `Personas de IA — Prompt de sistema e base de conhecimento por agente` |
| Agentes | `Instâncias de agente` |
| Fluxos | `Fluxos de qualificação — Roteiro de perguntas por persona` — vazio |

  Cada área mostra o seu próprio conteúdo, e ausência de conexão aparece com mensagem legível, que é o que o passo 2 pede. **Não li nem registro valor nenhum de chave, URL de API ou credencial** da aba Evolution.
- **Passo 3 — bloqueado.** Exige uma conta com perfil somente de leitura para provar que a gravação fica impedida. Não tenho sessão de perfil nesta rodada. Sessão Superadmin não prova negativa.
- **Passo 4 — coberto pela sessão anterior**, que abriu `Nova entrada` em Conhecimento, preencheu o título, cancelou e conferiu que a aba continuou vazia. Nesta sessão não repito, porque preencher formulário está parado por decisão do SuperTcL.

**Veredito: bloqueado para conclusão**, apenas pelo passo 3 e pela falta de perfil.

### OBS — o Inbox do Atendimento tem conversas reais; não abri nenhuma

Ao entrar no módulo Atendimento, a tela inicial é a `Caixa de entrada do Atendimento` com conversas de WhatsApp **reais e em produção**, a maioria marcada `Sem cliente vinculado`, uma delas com `Zé ativo`. Várias trazem conteúdo pessoal e de saúde de terceiros. **Não abri nenhuma conversa, não alterei nada e não transcrevo aqui nenhum trecho, nome ou dado dessas mensagens**, conforme a regra do dono. Registro apenas o fato, porque é relevante para o CT-47 e para qualquer decisão sobre testar Atendimento neste ambiente: o roteiro pede "conversa de teste controlada", e o que existe ali é tráfego real.

## CT-51 — Alma do cliente e memória das conversas: **APROVADO nos cinco passos**

Visão 360 do Sinérgica - Escritório > Comunicação. Gravação autorizada pelo dono para este cliente; **estado original restaurado ao fim**.

**Conteúdo original anotado antes de qualquer edição, como o caderno manda:** a Alma do Escritório estava vazia — `Nenhuma alma cadastrada ainda.`

- **Passo 1 — conferido.** As duas informações aparecem separadas e com descrição que as distingue. `Alma do cliente` — "Particularidades de comunicação que o Zé usa como contexto" — tem botão `Editar`. `Memória das conversas antigas` — "Resumo automático do que saiu do último mês de conversa — o Zé recebe isto junto com a alma. Atualizado uma vez por dia; **somente leitura**." Não há como confundir edição manual com resumo.
- **Passo 2 — conferido.** Abri `Editar`, digitei um rascunho identificado (`[TESTE CADERNO] CT-51 rascunho para cancelar 26-11-2026`) e cliquei `Cancelar`. O conteúdo salvo não mudou: continuou `Nenhuma alma cadastrada ainda.` e o rascunho não ficou em lugar nenhum da tela.
- **Passo 3 — conferido, com gravação e restauração.** Salvei `[TESTE CADERNO] CT-51 anotacao neutra 26-11-2026. Texto ficticio de validacao, sem instrucao para automacao.` — texto neutro, sem instrução para automação e sem informação sensível, como o caderno exige. A gravação persistiu: ao reabrir o editor, o textarea voltou com exatamente esse conteúdo. Em seguida limpei o campo e salvei, e a Alma voltou ao original `Nenhuma alma cadastrada ainda.` **A restauração devolveu o conteúdo original.** A metade "o perfil de leitura não pode gravar" não foi testada, por falta de sessão de perfil.
- **Passo 4 — conferido.** A memória antiga é declarada somente leitura e não tem controle de edição. Está vazia, com o critério explicado na própria tela: "Ele é gerado quando existe conversa com mais de 30 dias — até lá o Zé lê o histórico recente direto." O caderno aceita vazio quando não há histórico elegível, e diz que mensagens recentes não precisam aparecer.
- **Passo 5 — conferido, e refeito para valer.** Na primeira tentativa eu já tinha restaurado a Alma do Escritório, então os dois clientes estavam vazios e a comparação não provava nada. **Refiz:** salvei `[TESTE CADERNO] CT-51 passo 5 isolamento 26-11-2026` no Escritório, troquei para `H2 Poker Club - Climatização` e sua Comunicação mostrou `Nenhuma alma cadastrada ainda.`, sem nenhum traço do texto do Escritório; voltei ao Escritório e o texto estava lá, íntegro. O conteúdo acompanha o cliente e não é reaproveitado. **Em H2 Poker Club só houve leitura**, nenhuma gravação, conforme o limite do SuperTcL.
- **Restauração final:** limpei de novo a Alma do Escritório e ela voltou a `Nenhuma alma cadastrada ainda.`, o estado em que a encontrei.

**Massa deixada no ambiente por este caso: nenhuma.** Os dois textos gravados foram removidos e o estado original foi restaurado; ficam registrados aqui pelo identificador caso tenham deixado rastro em histórico ou auditoria que a interface não mostra.

## CT-13 — Recusar salto direto para Finalizado no quadro: **REPROVADO** (atualiza o registro anterior)

Executado com a escrita liberada pelo dono no cliente Sinérgica - Escritório, sobre a OS de teste `CH-3303` (`[TESTE CADERNO] Segunda pendência fictícia para composição de backlog.`). **Estado restaurado ao fim.**

- **Passo 1 — conferido.** `CH-3303` em `Planejamento`; cabeçalho com `PLANEJAMENTO 4`, `FINALIZADAS 9`, `ABERTAS 46`; coluna `Finalizado` do Escritório com 0 cartões sob o filtro `Ativos`.
- **Passo 2 — REPROVADO.** Usei o seletor de fase do próprio cartão — o controle cujo nome acessível é `Mover CH-3303 para outra fase` — e escolhi `Finalizado`. **O quadro aceitou o salto direto, sem recusa e sem mensagem alguma.** O cartão saiu de Planejamento na hora e os contadores mudaram: `PLANEJAMENTO` 4 → 3, `FINALIZADAS` 9 → 10, `ABERTAS` 46 → 45.
- **Passo 3 — a OS foi mesmo finalizada.** Cliquei `Atualizar` e o estado persistiu: Planejamento com 3, FINALIZADAS 10, e `CH-3303` ausente das colunas ativas. Trocando o filtro de situação para `Todos os status`, `CH-3303` apareceu na coluna `Finalizado`, com o seletor marcando `Finalizado`. Ou seja, ao contrário do que o passo 3 espera, **a OS foi finalizada pela tentativa**, porque a tentativa não foi recusada.
- **Passo 4 — REPROVADO.** Com a OS finalizada de teste agora existindo, usei o mesmo seletor para levá-la de `Finalizado` de volta a `Planejamento`. **A reabertura por movimentação simples também foi aceita**, sem recusa. Em vez de barrar, o sistema abriu a prévia `Abrir OS no Auvo? — Confira dados. Nada foi enviado durante esta prévia.`, com os campos de envio, a conferência PCM e um campo `Motivo da abertura manual (contingência auditada)`, oferecendo `Confirmar abertura` e `Agora não`. **Cliquei `Agora não`. Nada foi enviado ao Auvo.** O cartão voltou a Planejamento e os contadores voltaram a `PLANEJAMENTO 4` e `FINALIZADAS 9` — o estado em que encontrei.

**Massa: restaurada.** `CH-3303` está de volta em Planejamento, como estava no início da sessão. Fica registrado que ela passou por Finalizado durante o teste e que isso pode ter deixado eventos em histórico ou auditoria que a interface não mostra.

### DEF-52 — Salto direto para Finalizado e reabertura são aceitos pelo seletor de fase do cartão, sem validação do PCM

**Data:** 26/11/2026. **Caso:** CT-13. **Gravidade: alta** — é a regra de negócio central do caderno nesta jornada.

**Reprodução:** PCM > Chamados > Kanban, cliente `Sinérgica - Escritório`. Num cartão em `Planejamento` (usei `CH-3303`, massa de teste), abrir o seletor de fase do próprio cartão — rotulado para leitor de tela como `Mover <número> para outra fase` — e escolher `Finalizado`. A OS vai direto para Finalizado, **sem nenhuma mensagem**, e a mudança persiste após `Atualizar`. Em seguida, no mesmo seletor, escolher `Planejamento`: a reabertura também é aceita, e o sistema responde abrindo a prévia de abertura no Auvo em vez de recusar.

**Esperado pelo caderno:** "O quadro recusa o salto e informa a necessidade de validação do PCM" (passo 2) e "O quadro recusa reabertura por movimentação simples; reabertura é fluxo próprio" (passo 4).

**O ponto que torna isso um defeito e não uma divergência de leitura:** a sessão anterior, arrastando `PRE-A6C3B6A4` de Planejamento até Finalizado, **viu a recusa**, com a mensagem de que a validação PCM é necessária. Portanto a regra existe e é aplicada no caminho do arraste, **mas não no caminho do seletor** — que é o controle que a própria aplicação oferece ao lado do cartão e, pela medição do CT-64, é também o único caminho acessível por teclado para mover a OS. A restrição é contornável pelo controle mais acessível da tela.

**O que não foi provado:** não consegui reproduzir o arraste nesta sessão para comparar os dois caminhos lado a lado — o controle de mouse da automação não gera eventos de arraste nativos no Chrome, e o despacho de eventos de arraste por script foi barrado pela camada de permissão do meu ambiente. Logo, a recusa no arraste é evidência da sessão anterior, não desta. Também não inspecionei o servidor: não sei se ele recusaria um pedido equivalente feito fora da interface. O que está provado é o que a interface fez e gravou.

**Impacto:** uma OS pode ser finalizada sem passar pela Validação PCM, e uma OS finalizada pode ser reaberta sem o fluxo próprio, pelo caminho mais óbvio da tela. No caso da reabertura, o passo seguinte oferecido é abrir tarefa no Auvo.

Evidência: `DEF-52-ch3303-finalizado-sem-validacao-2026-11-26.jpg` (CH-3303 na coluna Finalizado, com o seletor em `Finalizado`, contador `FINALIZADO 10`).

## CT-32 — Funil e motivo de perda: **passo 1 conferido; BLOQUEADO nos passos 2, 3 e 4**

Comercial > Funil, cliente Sinérgica - Escritório. Nenhuma gravação.

- **Passo 1 — conferido.** O cartão `[TESTE CADERNO] Codex 26-11-2026 Oportunidade fictícia`, do `Sinérgica - Escritório`, R$ 1.000,00, está na etapa `Lead`. A identificação é suficiente para distingui-lo: o prefixo `[TESTE CADERNO]`, a data e o cliente. As demais etapas — `Qualificado`, `Proposta enviada`, `Negociação`, `Ganho`, `Perdido` — estão todas em `0 · R$ 0,00` com `Vazio` explícito.
- **Passos 2, 3 e 4 — bloqueados, e o motivo é a própria interface.** A única forma de mudar a etapa é arrastar. A tela declara isso: *"Arraste o card para mudar a etapa."* Medi o quadro inteiro: são 6 cartões `div[draggable="true"]`, **nenhum** com `tabindex`, `role` ou `aria-label`, e **zero elementos `<select>` na página**. O único elemento focalizável dentro de um cartão é um botão que **navega para o Cliente 360**, não abre a oportunidade. Conferi também a aba `Comercial` do Cliente 360: ela lista a oportunidade com a etapa `Lead` e o valor, mas os únicos botões ali são `Nova oportunidade`, `Propostas` e `Novo levantamento` — **nenhum controle de mudar etapa ou registrar perda**.
  Como o registro de perda do passo 3 e do passo 4 acontece ao soltar o cartão na etapa `Perdido`, os três passos dependem do arraste. **Não consigo produzir um arraste real:** o controle de mouse da automação não gera os eventos nativos de arraste no Chrome, e o despacho dos eventos por script foi barrado pela camada de permissão do meu ambiente. **Isto é limite da minha ferramenta, não defeito da aplicação**, e não registro nenhum achado sobre o comportamento do funil a partir disso.

**Próxima etapa concreta:** um humano arrasta o cartão de teste de `Lead` para `Qualificado`, recarrega e confere que a etapa persistiu e que o cartão aparece uma única vez; depois arrasta para `Perdido`, tenta concluir sem motivo e depois com um motivo de teste. É trabalho de poucos minutos para quem tem mouse na tela.

### DEF-53 — Mudar a etapa de uma oportunidade só é possível com o mouse

**Data:** 26/11/2026. **Caso:** CT-32, com impacto em CT-64 passo 1. **Reprodução:** Comercial > Funil. A instrução da tela é "Arraste o card para mudar a etapa." Medição do DOM: os 6 cartões são `div[draggable="true"]` **sem `tabindex`, sem `role` e sem `aria-label`**; a página não tem nenhum `<select>`; o único foco possível dentro do cartão é um botão que leva ao Cliente 360. Em Cliente 360 > Comercial, a oportunidade aparece como texto, sem controle de etapa ou de perda.

**Esperado:** toda ação essencial deve ter caminho que não dependa do mouse — é o que o próprio caderno exige no CT-64 passo 1, e é o que o Kanban de Chamados faz, oferecendo um seletor de fase ao lado de cada cartão. **Impacto:** quem opera por teclado, ou com tecnologia assistiva, não consegue mover uma oportunidade de etapa nem registrar perda em lugar nenhum da aplicação.

**Contraste que vale registrar junto do DEF-52:** no Kanban de Chamados existe o seletor como alternativa ao arraste, e é por ele que a validação do PCM deixa de ser aplicada. No Funil não existe alternativa alguma. Os dois quadros resolvem o mesmo problema de formas opostas, e cada forma tem o seu próprio defeito.

## CT-47, CT-48 e CT-49 — **BLOQUEADOS por falta de massa controlada**

Determinação do SuperTcL nesta data, que eu registro como limite permanente desta validação: **não abrir, ler, capturar ou transcrever nenhuma conversa real do Atendimento.** A caixa de entrada contém conversas de WhatsApp reais, de terceiros, com conteúdo pessoal e de saúde. A autorização do dono é para testar no cliente Sinérgica - Escritório e **não alcança ler conversa de terceiro**, que não consentiu com isso.

Portanto os três casos ficam bloqueados **por falta de conversa e contato de teste controlados**, não por falta de acesso. O que já estava observado continua valendo: o dashboard e a lista do Inbox carregam (CT-47), e Instagram, Messenger e Meta WA mostram zero conexões com vazio explícito (CT-49). Nenhuma mensagem foi enviada e nenhuma conversa foi aberta em nenhuma sessão desta validação.

## CT-55 — **APROVADO** (fechado com a confirmação do dono)

O ponto que segurava o caso em triagem era não saber se as 6 equipes estavam vazias também no Auvo. **O dono confirmou: "vazias no Auvo".** Logo o vazio é fiel à origem e o carregamento do passo 1 está correto. Registro a palavra do dono como a evidência do lado externo, já que não tenho acesso ao Auvo.

Veredito final: passos 1, 2 e 4 conferidos; passo 3 não aplicável pela própria redação do caderno, por não haver cadastro reservado. **Aprovado.** O DEF-51, achado durante este caso, continua aberto e independente do veredito.

## CT-30 — Consultar orçamento operacional da OS: **REPROVADO**

PCM > Materiais e Aquisições, cliente Sinérgica - Escritório, lista da `Sinérgica` da OS `CH-3302`, botão `Consultar orçamentos da OS`. Nenhuma gravação: não criei rascunho nem registrei dispensa. Evidência: `DEF-12-e-DEF-09-central-materiais-2026-11-26.jpg`.

- **Passo 1 — REPROVADO.** O painel abre no contexto certo, mas a consulta falha. Duas mensagens de erro, agora com o texto exato que a sessão anterior tinha perdido:
  - `Não foi possível consultar oportunidades ou listas autorizadas.`
  - `Não foi possível consultar orçamentos.` com botão `Tentar novamente`.
  Clicando `Tentar novamente`, a falha se repete.
- **Passo 2 — impedido pela mesma falha.** Sem a consulta, não há orçamento nenhum listado, e não há como rastrear qual material sustenta qual orçamento. O formulário de criação **vincula corretamente** lista e revisão (`[TESTE CADERNO] Codex 26-11-2026: 1 disjuntor fictício… · revisão 5 · 57b7edb2-aba5-4955-bf7e-b38ec789b1ee`) e exibe o texto original da revisão selecionada, mas isso é a criação, não a consulta que o passo pede.
- **Passo 3 — conferido.** A tela diz, por escrito e em três lugares, exatamente o que o caderno espera: "O orçamento é da OS; confira a lista de materiais e sua revisão na criação. **Não gera despesa de Visita ou cobrança automaticamente.**"; "O rascunho **não envia proposta nem gera cobrança**."; "Dispensa **somente o documento**; não define valor zero nem elimina eventual faturamento." Consultar ou criar orçamento não é apresentado como pagamento, cobrança ou despesa.

### DEF-12 — caracterizado: as consultas de orçamento falham com HTTP 403, e a tela oferece "Tentar novamente" que nunca vai funcionar

**Atualização de 26/11/2026, com a evidência que faltava.** Capturando o tráfego de rede durante a abertura do painel e durante o clique em `Tentar novamente`, na sessão **Superadmin**:

| Chamada | Método | Status |
| --- | --- | --- |
| `rpc/sso_listar_oportunidades_orcamento` | POST | **403** |
| `rpc/sso_listar_edicao_orcamentos_os` | POST | **403** (repetido em todas as tentativas, inclusive após `Tentar novamente`) |
| `rpc/sso_listar_listas_materiais_mediada` | POST | 200 |

**403 é negação de autorização no servidor**, não falha de rede nem indisponibilidade momentânea — e acontece com a conta de maior capacidade do sistema. A chamada que lista as listas de materiais, ao lado, responde 200, o que mostra que a sessão e a conexão estão boas; o que é negado são especificamente as duas RPC de orçamento.

**Esperado:** se a conta não tem a concessão necessária, a tela deve dizer isso — nomeando a capacidade que falta — em vez de apresentar um erro genérico de consulta com um botão de repetir que repetirá o mesmo 403 indefinidamente. **Impacto:** o usuário é levado a insistir numa ação que nunca pode dar certo, e um problema de concessão fica disfarçado de instabilidade. **Não investiguei qual concessão falta** nem o que a RPC exige; o que está provado é o código de status e a repetição.

### DEF-09 — recapturado: a Central de materiais aparece sem estilo, como texto corrido

A mesma captura acima serve ao DEF-09, cuja evidência tinha sido perdida. A página `Materiais e Aquisições` renderiza **sem hierarquia visual**: rótulos, filtros, botões e mensagens aparecem como linhas de texto corrido, sem cartões, sem separação entre seções e sem distinção entre rótulo e ação — `Filtrar esta OSAbrir contexto da OS` e `Abrir materiais da OSFechar orçamentos da OS` aparecem inclusive **colados**, sem espaço entre dois botões distintos. Reproduzido hoje na sessão Superadmin.

**Detalhe adicional, do mesmo tipo do DEF-27:** as listas de materiais são identificadas na tela pelo **UUID da OS** — `OS a6c3b6a4-0452-4909-95a0-8f51aeba27ba · Cliente · Concluída · revisão 3` — e não pelo número `CH-3302`, que a própria tela exibe logo acima no seletor de OS. O seletor de `Dispensa de orçamento` também lista as opções por UUID: `426ca300-94fc-4399-b2f2-d9f94b947447 · revisão 3 · cliente`. Identificador interno no lugar do nome, para o usuário final.

## CT-29 — Registrar uma lista e conferir revisão e histórico: **passos 1, 2 e 3 conferidos; BLOQUEADO no passo 4**

PCM > Materiais e Aquisições, cliente Sinérgica - Escritório, OS `CH-3302`. Gravação autorizada pelo dono neste cliente.

- **Passo 1 — conferido, com uma ressalva registrada como DEF-54.** Criei a lista com responsável `Cliente` e texto original `[TESTE CADERNO] CT-29 26-11-2026: 2 parafusos ficticios e 1 arruela ficticia.` Ela nasceu vinculada à OS, como `Levantada · revisão 1`. **A OS não foi alterada:** `CH-3302` continua na coluna `Planejamento` do Kanban, conferido depois da gravação. **Nenhuma tarefa foi enviada ao Auvo:** em todo o tráfego capturado nesta tela, as chamadas são RPC do Supabase; nenhum endpoint do Auvo apareceu. A própria tela declara a regra: "Criar lista não altera a OS nem envia tarefa ao Auvo."
- **Passo 2 — conferido.** Reabri a lista por `Organizar linhas` e registrei a atualização permitida `Disponibilidade / Disponível`, marcando a confirmação "Conferi a lista, revisão e informação que será registrada." A lista passou a `Disponibilidade informada · revisão 2` e **o texto original permaneceu idêntico**, palavra por palavra. O histórico ganhou o evento da revisão 2 sem perder nada.
- **Passo 3 — conferido quanto ao que o caderno exige, com defeito de apresentação à parte.** O histórico mostra `Revisão 2 · disponibilidade · responsável <uuid> · 2026-11-26T19:33:24.746648+00:00` e a frase `Informada disponível — informação não comprova conferência física.` O evento é claramente apresentado como **registro histórico** e **não afirma que a exceção continua aberta**, que é exatamente o que o passo pede. O problema de como esses dados são exibidos está no DEF-55 abaixo.
- **Passo 4 — bloqueado.** Exige duas sessões de usuários autorizados editando a mesma revisão. Não tenho segunda sessão: autenticar outra conta exigiria digitar senha neste host, que é produção, e isso continua fora.

**Massa criada, para a lista de limpeza:** lista de materiais `[TESTE CADERNO] CT-29 26-11-2026: 2 parafusos ficticios e 1 arruela ficticia.`, vinculada à OS `CH-3302` do Sinérgica - Escritório, responsável `Cliente`, hoje em `Disponibilidade informada · revisão 2`, com um evento de disponibilidade no histórico. Não foi excluída.

### DEF-54 — Botão "Tentar salvar novamente" aparece depois de um salvamento bem-sucedido, sem mensagem alguma

**Data:** 26/11/2026. **Caso:** CT-29. **Reprodução:** em Materiais e Aquisições > `Abrir materiais da OS` de `CH-3302`, preencher `Texto original` e clicar `Registrar lista`. A lista **é criada com sucesso** — aparece imediatamente como `Levantada · revisão 1` tanto no resumo superior quanto na lista detalhada — e, ao mesmo tempo, surge logo abaixo do cabeçalho o botão **`Tentar salvar novamente`**, habilitado e **sem nenhum texto de erro, aviso ou explicação ao lado**.

**Esperado:** ou o salvamento falhou, e então deve haver mensagem dizendo o que falhou, ou ele funcionou, e então não deve haver convite para repetir. **Impacto:** o usuário não sabe se gravou, e repetir pode criar uma segunda lista sem necessidade. **Não cliquei no botão**, portanto não sei o que uma repetição faria. É o mesmo padrão de sinalização contraditória do DEF-48, em outra tela e sem nem a mensagem que o DEF-48 tinha. Evidência: `DEF-54-tentar-salvar-novamente-sem-mensagem-2026-11-26.jpg`.

### DEF-11 — caracterizado: "Organizar linhas" falha com HTTP 403, igual ao DEF-12

**Atualização de 26/11/2026.** Clicando `Organizar linhas` na lista de teste, a tela mostra `Consultando linhas…` e termina em **`Não foi possível consultar as linhas. Tentar novamente`**. O tráfego de rede mostra a causa: `POST rpc/sso_obter_linhas_materiais_vigentes` → **403**, repetido a cada tentativa, na sessão **Superadmin**.

É o mesmo mecanismo do DEF-12: uma RPC mediada nega autorização mesmo para a conta de maior capacidade, e a interface traduz o 403 num erro genérico de consulta com um botão de repetir que repetirá o mesmo 403. **Os dois defeitos provavelmente têm a mesma raiz de concessão**; registro a coincidência como observação, não como conclusão — não investiguei o que as RPC exigem.

### DEF-55 — A tela de materiais exibe códigos internos, UUID e data crua no lugar de rótulos

**Data:** 26/11/2026. **Caso:** CT-29. Três ocorrências, na mesma tela, do mesmo problema:

1. **Estado interno.** No resumo superior a lista aparece como `Disponibilidade informada`; no bloco detalhado logo abaixo, a **mesma lista** aparece como `Estado: informada_disponivel` — o código interno, em minúsculas e sem acento. O mesmo vale para `concluida` e `dispensada`, que no resumo são `Concluída` e `Dispensada`.
2. **Responsável por UUID.** O evento de histórico identifica quem registrou como `responsável d3a30ba8-b1e1-41d6-80e4-69bb0daaf64c`, em vez do nome da pessoa.
3. **Data crua.** O mesmo evento mostra `2026-11-26T19:33:24.746648+00:00`, carimbo ISO com microssegundos e fuso UTC, em vez de data e hora locais formatadas.

Soma-se ao que já estava registrado na mesma tela: as listas são identificadas pelo **UUID da OS** (`OS a6c3b6a4-…`) em vez de `CH-3302`, e o seletor de dispensa lista opções por UUID.

**Esperado:** o usuário final vê rótulo, nome e data formatada; identificador interno fica para log e suporte. **Impacto:** o histórico de materiais é ilegível para auditoria — não dá para saber quem registrou nem quando, em horário local, sem consultar o banco. É a mesma família do DEF-27, agora em Materiais.
