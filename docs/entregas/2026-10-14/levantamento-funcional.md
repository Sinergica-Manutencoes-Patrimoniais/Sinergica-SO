---
name: "docs-entregas-2026-10-14-levantamento-funcional-md"
description: "Documento Sinérgica SO: Sinérgica SO — funcionalidades entregues e guia de validação"
alwaysApply: false
---

# Sinérgica SO — funcionalidades entregues e guia de validação

Versão de referência: main, commit `22aca3918224bc45175e80c6ec88b957fdb604aa`, de 14/10/2026. Público: Fabrício, Aline e equipe. Levantamento: 14/10/2026, horário de Brasília.

## 1. Como interpretar este levantamento

Este documento organiza as funcionalidades presentes na versão de referência, explica a operação cotidiana e propõe o que validar. A versão HTML acompanha o mesmo conteúdo, com capturas da interface.

**Entregue não significa homologado pelo negócio.** Uma função pode estar implementada e ainda depender de configuração, integração externa, dados completos ou aceite da equipe. As capturas foram feitas no app local com o código da main e consultas ao ambiente configurado; não são prova de publicação no site de produção nem de execução completa das integrações.

| Situação | Significado prático |
| --- | --- |
| Implementado | Tela e fluxo existem na main; estão disponíveis para validação conforme o acesso do usuário. |
| Condicionado | Implementado, mas o resultado depende de configuração, dados, serviço externo ou confirmação humana. |
| Com pendência observada | A consulta apresentou erro neste levantamento; não tratar como pronto para homologação funcional completa. |
| Planejado | Não é uma funcionalidade operacional entregue, mesmo que apareça no menu ou em material descritivo. |

Não foram criadas OS, enviados WhatsApps, ativados contratos, baixados pagamentos ou alterados cadastros para produzir este levantamento. Os testes de escrita descritos abaixo são **roteiros para homologação**, não ações executadas nesta sessão. O merge de referência passou pela CI, incluindo testes de banco; isso não substitui o aceite de cada processo por Fabrício/Aline.

### Resumo do escopo disponível

| Frente | O que já pode ser explorado | Atenção |
| --- | --- | --- |
| PCM e Cliente 360 | Clientes, Chamados, OS, backlog, ativos, preventivas, inspeções, ferramentas, agenda e relatórios | Despacho Auvo e execução de campo devem ser conferidos separadamente. |
| Atendimento e Zé | Inbox, vínculo de cliente, atendimento humano, agentes, conhecimento, canais e automações | Mensageria/IA dependem dos provedores; Dashboard apresentou indisponibilidade. |
| Comercial | Contas, funil, precificação, propostas, levantamento e contratos | Proposta é montada pelo usuário; não há assinatura eletrônica do contrato. |
| Financeiro | Caixa, lançamentos, OFX, recebíveis, pagamentos, cobrança, impostos, fechamento e gestão | Rentabilidade apresentou erro; PIX/boleto e envios dependem de configuração. |
| Área do Cliente | Portal implementado e central interna de orientação | A interface do síndico exige conta própria, vinculada a um condomínio. |
| Configurações e manual | Usuários, grupos, integrações, IA, prioridade, localização e ajuda | Algumas configurações são exclusivas de superadmin. |
| Marketing, Growth e Cockpit geral | Contexto e intenção de produto | Ainda não constituem operação entregue. Cockpit financeiro é outra função e já existe. |

## 2. Conceitos e regras que valem para todo o sistema

### 2.1 Cadastro único e responsabilidades

- **Conta/Cliente**: o cadastro compartilhado do relacionamento. Uma negociação comercial não exige criar outro cliente quando fecha contrato.
- **Estrutura**: onde algo está. Exemplo: Condomínio → Torre A → 1º andar → Casa de bombas.
- **Componente**: ativo do cliente que recebe manutenção, como bomba, extintor ou quadro. No Auvo o nome da entidade é Equipamento/Equipment.
- **Sistema**: conjunto funcional de Componentes, como bombeamento ou combate a incêndio. Não substitui o endereço físico.
- **Ferramenta**: recurso da Sinérgica usado para trabalhar; não é um ativo do condomínio.
- **Chamado**: solicitação recebida, ainda sujeita a triagem e decisão.
- **OS**: organização do trabalho que será executado para atender uma demanda.
- **Backlog**: fila de pendências que aguardam priorização/planejamento. Não é um segundo cadastro do mesmo problema.
- **PRE**: pré-triagem que ainda precisa ser confirmada como Chamado. Confirmar o registro existente evita duplicação.
- **Plano preventivo**: regra recorrente; **ocorrência**: um ciclo dessa regra; **OS/tarefa Auvo**: o trabalho de campo associado à ocorrência.
- **Proposta comercial**: pré-venda, composição e negociação que pode originar contrato. **Orçamento de serviço**: serviço extra para cliente existente; não confundir os fluxos nem o orçamento anual do Financeiro.

### 2.2 PCM e Auvo não fazem a mesma coisa

O PCM concentra decisão, prioridade, planejamento e histórico interno. O Auvo continua sendo o aplicativo de execução em campo: check-in/out, evidências e questionários conforme a tarefa.

**Salvar no PCM ≠ confirmar abertura no Auvo ≠ técnico receber a tarefa ≠ serviço executado.** A abertura usa uma confirmação e tem prévia. Após enviar, verificar número Auvo, responsável, data e conteúdo no destino. No contrato atual da abertura de OS, exibir técnico/data/local para conferência no PCM não garante que todos esses campos foram enviados ao Auvo. Esse limite precisa ser considerado no despacho diário.

Não repetir cadastros ou envios às cegas após falha de conexão. Primeiro localizar o registro e conferir o vínculo existente. A composição Sistema–Componente é gerenciada no SO; não pressupor que o Auvo reproduza essa hierarquia.

### 2.3 Acesso e exposição de informação

- Superadmin tem administração ampla; supervisor atua na gestão operacional e nas áreas administrativas permitidas.
- Colaborador recebe leitura/escrita por módulo, conforme grupo e permissões. Algumas ações exigem papel específico além do módulo.
- Cliente-síndico usa o portal e só o condomínio vinculado. A conta interna não é uma simulação da identidade do cliente.
- Custos internos, margem e dados de outros clientes não devem aparecer no portal.
- A ausência de uma ação pode ser permissão, não falha. Lista vazia, carregamento e erro também são situações diferentes.

## 3. Fluxo de trabalho recomendado para o Fabrício

### 3.1 Início do expediente

1. Entrar no PCM e revisar o Dashboard: abertas, atrasos, execução e saúde da integração.
2. Abrir Chamados/Operação para comparar toda a carteira. Revisar demandas novas, sem técnico, backlog e erro de sincronização.
3. Consultar a Agenda do Técnico e as Preventivas próximas/atrasadas.
4. Abrir o Cliente 360 dos condomínios que exigem decisão. Conferir identidade, demandas abertas, histórico e ativos antes de criar algo.
5. Revisar o Inbox para exceções humanas e solicitações que ainda precisam de vínculo/contexto.

### 3.2 Quando chegar uma solicitação

1. Identificar o cliente e pesquisar se a mesma demanda já existe, inclusive se veio de WhatsApp, portal ou inspeção.
2. Registrar Novo Chamado quando ainda houver triagem. Informar título específico, descrição, local e solicitante.
3. Decidir entre gerar OS ou enviar ao backlog; completar prioridade e contexto. Se o serviço já está inteiramente definido, pode ser cadastrado diretamente como Nova OS.
4. Planejar tipo de tarefa, técnico, data, alvo e instrução. Resolver acesso/material antes do deslocamento.
5. Conferir e confirmar a abertura Auvo; verificar o resultado no destino.
6. Acompanhar execução e evidência; não marcar finalizado apenas para limpar a fila.

### 3.3 Encerramento do dia e acompanhamento semanal

1. Revisar trabalhos concluídos, pendentes e replanejamentos; tratar divergências entre planejamento e execução.
2. Consultar Relatório do Dia e Apontamento de Horas. Início/Fim visita são marcações de jornada, não serviços de manutenção.
3. Registrar devoluções e movimentações de ferramentas no vínculo correto.
4. Semanalmente, revisar backlog por criticidade, próximas preventivas, não conformidades e cadastros incompletos.
5. Gerar o Relatório do Cliente por período e, após conferir o conteúdo, publicar o que for adequado ao portal.

## 4. PCM — clientes e espaço de trabalho 360

### PCM-01 — Carteira e cadastro de clientes

**Acesso:** PCM → Clientes. **Situação:** implementado.

Lista com busca por cliente, cidade, contato, CNPJ ou ID Auvo; abertura do cadastro/360 e ações de cadastro conforme permissão. No dia a dia, usar a busca antes de incluir um novo condomínio e revisar contato, endereço, situação e vínculo Auvo.

**Regra:** o cadastro é compartilhado com outros contextos; não duplicar Conta porque passou de negociação para operação. A carteira operacional e o funil comercial têm finalidades distintas.

**Validar:** encontrar um cliente por dois critérios diferentes; abrir o cliente correto; em homologação, cadastrar um cliente de teste, salvar, reabrir e conferir os campos e o vínculo.

### PCM-02 — Cabeçalho e ações rápidas do Cliente 360

**Acesso:** PCM → Clientes → selecionar cliente. **Situação:** implementado.

Cabeçalho compacto com identidade e informações do cliente, indicadores e atalhos contextuais: Novo chamado, Nova OS, Nova preventiva e Novo componente conforme acesso. A navegação organiza Operação, Ativos e Gestão/relacionamento; telas menores oferecem opções no menu Mais.

**Regra:** o cliente do contexto deve permanecer o mesmo ao consultar e iniciar uma ação. Trocar de cliente não pode reaproveitar uma seleção de detalhe do anterior.

**Validar:** alternar entre dois clientes; abrir um formulário pelo atalho e conferir o cliente sem salvar; verificar se leitura não oferece ações de escrita.

### PCM-03 — Resumo, Timeline e detalhes sem sair do cliente

**Situação:** implementado.

Resumo reúne o recorte operacional do condomínio. Timeline permite reconstruir acontecimentos. OS reúne abertas e histórico. Selecionar um item abre o painel lateral com detalhes e vínculo do Chamado quando existente; fechar retorna ao mesmo contexto.

**Regra:** Início visita e Fim visita são excluídos dos recortes de manutenção do 360; o dado de jornada continua disponível nos controles de horas/agenda. Indicadores devem refletir o recorte e os filtros, não toda a empresa.

**Validar:** abrir uma OS pelo Resumo/Timeline/OS, conferir número e cliente, fechar por X/Escape e continuar na aba. Conferir ausência das marcações de jornada nas listas de manutenção.

### PCM-04 — Filtros de ativos e estrutura

**Situação:** implementado.

Componentes: busca por nome/Identificador, categoria, Área/Local, Sistema, Sem sistema, situação e sincronização. Sistemas: busca por nome/código, categoria, Área/Local, composição, situação e sincronização. Estrutura: busca por nome/caminho, tipo, Área e presença de ativos. Ferramentas: busca, categoria, situação da alocação e período, conforme os controles da aba.

**Regra:** critérios diferentes se acumulam; opções dentro de um mesmo critério são alternativas. A árvore mantém ancestrais para contextualizar resultados. Não encontrar após filtrar não significa exclusão.

**Validar:** combinar categoria + posição, buscar Identificador sem depender de acento, usar Sem sistema, conferir contagem e Limpar. Na estrutura, localizar um sublocal sem perder seu caminho.

### PCM-05 — Comunicação, Assessment e recortes de gestão no 360

**Situação:** implementado, com acesso e dados condicionantes.

Comunicação traz contato, observações e contexto de mensagens vinculadas. Inspeções/Assessment permitem consultar diagnósticos e vínculos; o tratamento completo ainda utiliza as telas globais correspondentes. Comercial concentra dados comerciais da Conta quando permitido.

**Limite importante:** o painel Financeiro do 360 é um recorte operacional de situação e volume de OS, não extrato, saldo, faturamento ou rentabilidade completa. Para dinheiro, usar o módulo Financeiro. O 360 é o centro do trabalho por cliente, mas não substitui todas as telas globais.

**Validar:** conferir data do diagnóstico, origem dos vínculos e diferença entre total operacional e valores financeiros.

## 5. PCM — Chamados, OS, prioridade e integração

### PCM-06 — Board unificado de operação

**Acesso:** PCM → Chamados. **Situação:** implementado.

O menu abre Operação, que reúne o ciclo da solicitação ao trabalho. Lista, Kanban, Timeline, Calendário e Backlog oferecem leituras distintas da mesma fila. Busca e filtros de situação, técnico, cliente, categoria e período ajudam na triagem. Há indicadores de fases, sem técnico e problemas de sincronização.

**Uso diário:** Lista para localizar; Kanban para fases; Calendário/Timeline para distribuição temporal; Backlog para decisão. Seleção abre detalhe e ações disponíveis. O Kanban possui configuração de colunas; mover o card é uma alteração de fase e não comprovação de envio/execução.

**Validar:** localizar o mesmo registro em duas visões; mudar filtros e limpar; conferir se o detalhe corresponde ao item escolhido. Testar movimentações somente com registro de teste.

### PCM-07 — Abertura e tratamento de Chamado

**Situação:** implementado.

1. Usar Novo Chamado no board ou no cliente.
2. Conferir Cliente e preencher Título; complementar descrição, solicitante e local.
3. Criar e conferir número CH e histórico.
4. Abrir detalhe para Gerar OS ou Enviar ao backlog; acrescentar anotações e contexto no registro existente.

**Regras:** Cliente/Título obrigatórios. Só Chamado aberto pode gerar OS/ir ao backlog; não converter de novo uma solicitação já tratada. Cancelamento exige justificativa. Se já virou OS, cancelar pelo fluxo da OS, não pelo Chamado. Anotação interna não deve ser presumida como instrução entregue ao técnico.

**Validar:** criação → consulta → anotação → conversão, conferindo vínculo e ausência de duplicação. Em caso separado, cancelar com justificativa.

### PCM-08 — Cadastro direto e planejamento de OS

**Situação:** implementado; despacho externo condicionado.

Nova OS permite descrever o trabalho, classificar categoria, escolher tipo de tarefa, local/Componente quando disponível, prioridade, responsável e data. Se já existe Chamado da demanda, preferir Gerar OS nele para preservar a origem.

**Regras:** tipo de tarefa é obrigatório quando há técnico ou data; um registro sem confirmação pode nascer como PRE. Cadastrar no PCM não confirma tarefa no Auvo. Título sugerido por IA é apoio opcional; título manual continua possível. Antes do despacho, a orientação deve dizer o que fazer, onde e qual evidência se espera.

**Validar:** criar OS de teste, reabrir e conferir campos; depois verificar separadamente confirmação Auvo, responsável e agenda no destino.

### PCM-09 — Backlog e confirmação da pré-triagem

**Situação:** implementado.

Backlog concentra trabalho aberto ainda sem agendamento, técnico e vínculo Auvo. PRE representa triagem ainda não confirmada; usar Confirmar chamado para obter o vínculo CH e seguir no mesmo registro. Planejamento tira o trabalho da condição de backlog conforme seus dados/fase.

**Uso diário:** revisar criticidade e contexto antes de planejar; não dar a mesma prioridade alta para tudo. Atribuir próximo passo mesmo quando a execução aguarda material, acesso ou aprovação.

**Validar:** PRE → Confirmar chamado → planejamento; conferir a mudança de identificação e preservação de histórico. Verificar que um trabalho já agendado não continua sendo interpretado como backlog puro.

### PCM-10 — Matriz GUTD configurável

**Situação:** implementado.

Gravidade, Urgência, Tendência e Dor do cliente usam notas de 1 a 5. A ordenação atual considera média ponderada GUTD, com pesos configuráveis que precisam somar 100%; não confundir com o produto G×U×T legado mostrado em alguns contextos.

**Regras:** score GUTD na escala de 1–5; crítica ≥4,5, alta ≥3,5, média ≥2,5 e baixa abaixo disso. Sem Dor preenchida, o peso é redistribuído proporcionalmente entre G/U/T; não tratar ausência como nota zero. Pesos iguais de 25% são fallback, não uma decisão definitiva da operação.

**Validar:** com pesos iguais, comparar notas 5/5/5/5 e 1/1/1/1; remover Dor e conferir o cálculo; testar a recusa de pesos cuja soma não é 100. Fabrício deve validar os pesos e critérios da equipe.

### PCM-11 — Tipos de OS e prazos do Hub

**Situação:** implementado no domínio de priorização do Hub.

Emergencial (C1), Corretiva programada (C2), Preventiva PMOC (P1), Preventiva predial (P2) e Inspeção/follow-up (IN) organizam o atendimento. O tipo é inferido inicialmente pela categoria e pode ser tratado depois; prioridade do Hub é recalculada.

**Regra implementada:** C1: prazo 2h; C2: 72h; P1: janela ±3 dias da agenda; P2: ±7 dias; IN: prazo acordado quando agendado. P1 atrasada sobe de prioridade. Esses cálculos não devem ser transformados em promessa comercial nova: C1 é o compromisso emergencial explicitamente destacado no projeto; os demais critérios precisam ser confrontados com o contrato real.

**Validar:** conferir tipo, data-base e indicador de atraso em exemplos conhecidos, sem confundir SLA calculado com confirmação de presença técnica.

### PCM-12 — Abertura Auvo com prévia e confirmação

**Situação:** condicionado à integração e à conferência no destino.

No detalhe global da OS, Abrir OS Auvo apresenta campos enviados, dados de conferência e pendências. Confirmar abertura inicia o envio; Agora não/fechar não despacha. Mudança para Planejamento pode oferecer a janela, mas não substitui a confirmação.

**Regra:** localizar o vínculo/número Auvo após confirmar e conferir atribuição, data e orientação no Auvo. A prévia distingue o que é efetivamente enviado do que só está visível para conferência PCM. Falha de integração não autoriza recadastrar o serviço.

**Validar:** tarefa de teste autorizada, uma confirmação, um vínculo; abrir o destino, conferir campos e retorno. Não fazer este teste num atendimento real de cliente sem coordenação.

### PCM-13 — Saúde de sincronização e retorno do campo

**Situação:** condicionado aos serviços externos.

Dashboard e registros mostram pendências, vínculo e erros de sincronização. O retorno do Auvo permite acompanhar execução e os dados disponíveis no registro. O vínculo é a referência para investigar divergência; a integração pode não ser imediata.

**Uso diário:** corrigir a causa indicada e tentar novamente quando a ação existir; reunir cliente, CH/OS/Identificador, horário, mensagem e Auvo # para suporte. Nunca enviar senha para diagnosticar.

**Validar:** comparar uma tarefa conhecida no Auvo e no PCM, inclusive status e horários; diferenciar dado ainda não retornado de serviço não executado.

## 6. PCM — estrutura e cadastro de ativos

### PCM-14 — Estrutura física e siglas

**Acesso:** Cliente 360 → Ativos → Estrutura. **Situação:** implementado.

Cadastro de Áreas e Locais com sublocais, tipo e sigla; exemplo Torre A → 1º andar → Escadaria. Primeiro conferir a árvore existente, depois incluir o nível necessário. Não é obrigatório cadastrar todo o prédio para começar.

**Regras:** hierarquia deve pertencer ao mesmo cliente e não pode formar ciclos. Área/Local são posição física, Sistema é função. A sigla de três caracteres participa da identificação de novos ativos; renomear local não deve regenerar automaticamente códigos existentes.

**Validar:** criar estrutura curta em cliente de teste; localizar sublocal; tentar vínculo inválido; conferir caminho e sigla depois de salvar.

### PCM-15 — Componentes em Cliente, Área ou Local

**Acesso:** cadastro global Componentes ou aba/atalho do 360. **Situação:** implementado.

Nome e Categoria classificam o ativo; Cliente é obrigatório, enquanto Área/Local são opcionais. Pode-se começar diretamente no Cliente ou na Área e detalhar depois. Quando há Local, a Área efetiva é derivada dele. Categoria usa catálogo compartilhado com o Auvo, com criação inline conforme acesso.

**Regras:** evitar duplicatas; posição tem de ser do mesmo cliente. Componente pode pertencer a no máximo um Sistema. Desativação considera pendências e pode ser bloqueada por manutenção aberta.

**Validar:** incluir Componente apenas no Cliente; depois mover para Área/Local; reabrir e conferir categoria, posição, Identificador e histórico. Não duplicar um Componente para contornar bloqueio.

### PCM-16 — Identificador e recomendações de etiqueta

**Situação:** implementado, incluindo correção integrada na PR #70.

O cadastro sugere siglas; o usuário pode corrigir as recomendações e usar Aplicar recomendações para preencher a prévia do Identificador. Editar identificador permite usar outro código. A prévia precisa estar no campo, não apenas no bloco de sugestões.

**Regras:** Identificador existente é preservado ao mover/renomear. A alteração explícita exige atenção ao aviso de etiqueta/QR Code. Código final depende da validação de unicidade e sequência no salvamento. Exemplo ilustrativo: `GUA-TOR-A01-E01-PCI-EXT-01`; não copiar o exemplo como se fosse o código reservado do ativo.

**Validar prioritariamente:** abrir cadastro sem código → revisar siglas → aplicar → conferir campo preenchido → salvar → reabrir. Em outro caso, trocar manualmente o código e conferir persistência. Só usar na etiqueta o valor final salvo; este fluxo não representa, por si só, uma impressão automática de QR Code.

### PCM-17 — Sistemas e composição

**Acesso:** Sistemas global ou 360 → Ativos → Sistemas. **Situação:** implementado.

Cadastrar Nome, Cliente, Categoria, posição e Identificador; depois selecionar os Componentes da composição. Sistema pode estar no Cliente/Área/Local e reunir ativos distribuídos em posições diferentes do mesmo cliente.

**Regra:** um Componente não pode participar simultaneamente de dois Sistemas. O seletor indica o vínculo existente; ajustar a composição de origem antes de transferir. A composição é interna ao SO, não uma hierarquia prometida no Auvo.

**Validar:** Sistema com dois Componentes do mesmo cliente; tentativa de reutilizar um deles em outro Sistema; consulta de composição, posição e histórico.

### PCM-18 — Árvore, Board e histórico de ativos

**Situação:** implementado.

Árvore mostra organização hierárquica; Board oferece leitura por posição e movimentação conforme permissão. Detalhes dos ativos ajudam a consultar posição, composição e histórico disponível de manutenção. Usar essas visões para localizar o equipamento antes de criar uma OS.

**Regra:** mover um ativo altera posição, não transforma o ativo em outro nem deveria trocar seu Identificador. Localização e participação em Sistema continuam conceitos diferentes.

**Validar:** localizar o mesmo Componente na lista e árvore; em fixture, mover pelo Board e conferir posição na reabertura, mantendo código e vínculos.

### PCM-19 — Exportação e importação Excel de estrutura

**Acesso:** ações de Excel na Estrutura do cliente. **Situação:** implementado; aplicação em lote exige revisão.

Exportar gera planilha com dados/referências. Importar apresenta simulação de criar, editar, excluir, sem mudança, erros e avisos. Conferir diferenças e dependências antes de Executar; acompanhar progresso e relatório do processamento.

**Regras:** não editar IDs de registros existentes; respeitar nomes de abas/cabeçalhos e o modelo. A aplicação usa uma sequência de operações; não assumir uma transação única com rollback integral de todo o arquivo. Uma falha parcial exige conferir o relatório antes de repetir.

**Validar:** exportar e reimportar sem alterações deve resultar em zero mudanças; depois simular um caso pequeno. Conferir referências inválidas e conflito de Identificador. Exclusão em lote deve usar apenas dados de teste autorizados.

## 7. PCM — preventivas, inspeções e qualidade

### PCM-20 — Plano preventivo recorrente

**Acesso:** Preventivas global ou Cliente 360 → Preventivas. **Situação:** implementado; envio de campo condicionado.

Novo plano define nome, cliente, alvo Componente/Sistema, questionário e tipo de tarefa Auvo, primeiro vencimento, quantidade e unidade de recorrência (semanas/meses). O plano é a regra; cada vencimento gera uma ocorrência. Na 360 o cliente permanece fixo, enquanto a tela global permite comparar clientes.

**Regras:** intervalo inteiro positivo; datas calculadas a partir da âncora original. Em meses curtos o dia é limitado ao último dia do mês, sem perder a âncora dos ciclos seguintes. Periodicidade técnica deve ser definida pelo responsável, não inferida só pela interface.

**Validar:** plano mensal e semanal em fixture; conferir vencimentos, cliente e alvo. Salvar plano não comprova visita nem abertura no Auvo.

### PCM-21 — Lista, Timeline, Calendário e detalhe da preventiva

**Situação:** implementado.

Três visões do mesmo planejamento, com preferência lembrada neste navegador. Ocorrência clicável mostra plano, alvo, vencimento, visita, técnico, situação, resultado e vínculos; Ver plano reúne recorrência e histórico. Há consulta de resultados/período e OS associada quando existente.

**Regras:** prevista/atrasada referem-se ao vencimento; agendada, disponível no Auvo e concluída são condições diferentes. Ausência de OS/vínculo não significa execução. A consulta no cliente não deve misturar dados de outro condomínio.

**Validar:** alternar as três visões; abrir a mesma ocorrência; comparar cliente, vencimento e estado. Abrir vínculo da OS sem perder a rastreabilidade.

### PCM-22 — Revisão de plano, pausa e achado corretivo

**Situação:** implementado; despacho condicionado ao gate Auvo.

Antes da primeira ocorrência materializada, Editar plano permite revisar sua estrutura. Após materialização, alvo/recorrência ficam protegidos; Pausar e criar novo plano inicia uma versão operacional nova preservando o histórico. Resultado Não OK pode originar achado no backlog pela ação disponível.

**Regras:** pausar não é apagar execução nem cancelar automaticamente tarefa já enviada. Confirmação de visita/envio depende do estado de validação do contrato Auvo, de alvo vinculado, técnico, data, questionário e tipo. A ação administrativa Validar contrato Auvo é um gate, não uma formalidade; a sessão não abriu tarefa real para revalidá-lo.

**Validar:** editar plano sem materialização; comparar a proteção após materialização; pausar/copiar sem perder histórico; avaliar um resultado Não OK e seu vínculo corretivo em fixture.

### PCM-23 — Inspeções e itens de diagnóstico

**Acesso:** PCM → Inspeções. **Situação:** implementado.

Cadastro/edição de inspeção, cliente, data e responsáveis; itens por sistema/resultado/severidade, observações e dados de apoio. Há tratamento de itens, importação de PDF/planilha, apoio de IA e revisão em lote quando aplicável. Achados podem seguir para Chamado/backlog com prioridade revisada, sem redigitação desnecessária.

**Regras:** cabeçalho e itens precisam de descrição e datas válidas. Classificação/sugestão de IA deve ser revisada antes de gerar pendências. Um arquivo importado não equivale a uma vistoria aprovada pelo responsável técnico.

**Validar:** criar inspeção de teste → inserir/importar itens → corrigir classificação → derivar achado → conferir origem e vínculo. Conferir tratamento de arquivo inválido sem gerar demanda acidental.

### PCM-24 — Tipos de inspeção e templates

**Acesso:** PCM → Configurações → Tipos de Inspeção. **Situação:** implementado.

Catálogo de tipos e modelos de checklist para padronizar a vistoria. Preparar roteiro antes da visita reduz diferenças entre técnicos. O template precisa de nome, tipo e pelo menos um item.

**Validar:** configurar um tipo/modelo de teste e conferir os itens utilizados no fluxo de inspeção. Revisar tecnicamente o checklist; a existência de template não certifica conformidade normativa.

### PCM-25 — Assessment e destinação dos achados

**Acesso:** PCM → Assessment; consulta no 360. **Situação:** implementado.

Documento do estado do cliente em início de contrato, alteração de contrato ou revisão anual. Pode importar questionário de tarefa Auvo; cada achado recebe destino Chamado, backlog, OS ou descarte, com responsável Sinérgica, terceiro ou cliente conforme o fluxo disponível.

**Regra:** cliente, motivo e data contextualizam o diagnóstico. Item já derivado não deve gerar outra demanda pelo mesmo fluxo; preservar a ligação entre achado e destino. A consulta no 360 mostra o documento e derivação, mas o tratamento completo fica no Assessment global.

**Validar:** importar um questionário autorizado, revisar um achado, escolher destino/responsável e conferir que o vínculo impede derivação duplicada.

### PCM-26 — PMOC e climatização

**Acesso:** PCM → PMOC. **Situação:** implementado; uso técnico e campo condicionados.

Gestão de contratos PMOC, imóvel, equipamentos, agenda, checklist, registros de análise microbiológica e não conformidades. Painel de atenção destaca contratos/visitas/alertas; visita pode originar OS pelo fluxo disponível.

**Uso diário:** revisar visitas próximas/atrasadas e não conformidades, atualizar registros e relacionar a execução. O cadastro PMOC não é o mesmo que o plano genérico de Preventivas, embora ambos possam gerar trabalho de campo.

**Regras/limites:** validação técnica dos parâmetros e conclusões é responsabilidade do profissional habilitado. Controle gerencial não substitui laudo, ART ou comprovação legal. Não assumir geração completa de documento técnico apenas porque contrato/equipamento foi cadastrado.

**Validar:** contrato/equipamento de teste, visita, NC e evolução de estado; conferir OS associada e rastreabilidade, com revisão do responsável técnico.

### PCM-27 — Laudo SPDA e pontos de medição

**Acesso:** PCM → Relatórios → Laudo SPDA. **Situação:** implementado como registro técnico assistido.

Cadastro do laudo e pontos com localização, resistência, conformidade, observações e referência de foto; exibição de conclusão sugerida com base nos pontos. Consultas aparecem no histórico do cliente quando disponíveis.

**Limite:** classificação/conclusão sugerida pelo sistema não substitui avaliação de engenharia nem assinatura/ART. Este levantamento não certifica que um limite automático de medição seja suficiente para atendimento a norma; a validação legal/técnica não foi executada.

**Validar:** laudo de teste, pontos com informação completa e pendente, coerência da conclusão sugerida e necessidade de revisão técnica antes de publicar qualquer documento.

## 8. PCM — recursos, agenda, pessoas e relatórios

### PCM-28 — Ferramentas, unidades e patrimônio

**Acesso:** PCM → Ferramentas. **Situação:** implementado.

Cadastro de ferramenta/categoria e unidades com código/patrimônio, disponibilidade, histórico e baixa de unidade. O catálogo representa o tipo; a unidade representa o item físico. Novo item exige código/patrimônio no fluxo de criação.

**Regras:** unidade baixada não é estoque disponível. Histórico deve registrar quem esteve com o item e suas movimentações. Não cadastrar uma ferramenta da Sinérgica como Componente do cliente.

**Validar:** tipo com duas unidades distintas; consultar histórico por unidade; testar baixa/indisponibilidade em item de teste sem apagar a história.

### PCM-29 — Alocação por técnico, kits e devolução

**Acesso:** Ferramentas por Técnico e gestão de kits no cadastro de Ferramentas. **Situação:** implementado.

Consulta de responsabilidade por técnico e movimentação de entrega/devolução. Kits agrupam recursos para facilitar preparação do trabalho. A movimentação deve corresponder ao item físico e ao responsável real.

**Validar:** entregar unidade/kit de teste, conferir posse, registrar devolução e recuperar histórico. Não considerar uma conversa no WhatsApp como devolução registrada.

### PCM-30 — Reservas de ferramentas

**Situação:** implementado.

Reserva por ferramenta/unidade, técnico e intervalo; agenda de reservas, efetivação e cancelamento. Reserva genérica verifica capacidade; específica evita sobreposição do mesmo item.

**Regras:** fim não pode anteceder início; só pendente pode ser efetivada/cancelada. Efetivar exige unidade disponível; reservar não é o mesmo que entregar. Intervalos sobrepostos podem bloquear a solicitação.

**Validar:** reserva simples, conflito sobreposto, efetivação e devolução em unidade de teste. Conferir que reserva e posse física não são tratadas como a mesma etapa.

### PCM-31 — Alocação de ferramentas no cliente

**Acesso:** 360 → Ativos → Ferramentas. **Situação:** implementado.

Alocar ferramenta ao condomínio, consultar ativas/devolvidas e filtrar período/categoria. Devolver encerra o vínculo original e mantém histórico. Cadastro geral e responsabilidade por técnico continuam nas telas globais.

**Validar:** alocar → localizar no 360 correto → devolver → recuperar pelo filtro de histórico, sem criar vínculo em outro cliente.

### PCM-32 — Agenda do Técnico

**Acesso:** PCM → Agenda do Técnico. **Situação:** implementado.

Agenda semanal com navegação por período e organização dos atendimentos/visitas, filtros e ações de planejamento conforme acesso. Usar para revisar onde a equipe deveria estar e confrontar a agenda com as OS.

**Regra:** visita planejada não comprova check-in nem serviço finalizado. Agendar no SO não deve ser interpretado como confirmação de todos os campos no Auvo.

**Validar:** semana/técnico/cliente de referência, abertura de item, coerência com a OS e distinção entre horário previsto e realizado.

### PCM-33 — Apontamento de Horas e jornada

**Acesso:** PCM → Relatórios → Apontamento de Horas. **Situação:** implementado; dados dependem de apontamentos/cadastros.

Consulta de horas por período, técnico e cliente; agregações diárias/semanais, jornada, horas extras/incompletas, inconsistências/anomalias e exportação CSV. Há atalhos para o cliente/OS do recorte consultado.

**Regras:** Início visita/Fim visita são usados como marcação de jornada, não uma manutenção. Sem jornada/custo cadastrado, alguns indicadores ficam sem base ou parciais. Conferir intervalos incompletos antes de usar para custo ou produtividade; o módulo não deve ser tratado automaticamente como folha de pagamento homologada.

**Validar:** um dia conhecido, início/fim, intervalos ausentes, totais por técnico/cliente e CSV. Confrontar com a referência operacional antes de pagar horas extras.

### PCM-34 — Equipes, funcionários e cadastros auxiliares

**Situação:** implementado.

Equipes e Funcionários organizam responsáveis e dados usados na operação. Tipos de Tarefa classificam trabalho. Grupos de Clientes, Marcações, Categorias de Componentes, Segmentos e Palavras-chave padronizam cadastro/segmentação. Grupos de Usuário é atalho para a administração global, não outro cadastro de permissões.

**Regra:** os catálogos alimentam os seletores dos fluxos; corrigir o cadastro-base antes de contornar com texto livre/duplicado. Categorias de OS, categorias de Componentes e tipos de tarefa têm sentidos diferentes.

**Validar:** incluir/editar um registro de teste em cada catálogo necessário; conferir seu uso no formulário consumidor e efeito da desativação, preservando registros antigos.

### PCM-35 — Dashboard operacional

**Situação:** implementado.

Resumo de fila, criticidade, andamento e saúde Auvo com atalhos para investigação. Serve à triagem diária, não substitui detalhe de cada serviço nem o futuro Cockpit geral.

**Validar:** confrontar um indicador com a lista usando os mesmos filtros/período e verificar comportamento sem dados. Total agregado não deve ser considerado prova de qualidade de execução.

### PCM-36 — Relatório de planejamento

**Acesso:** PCM → Relatório. **Situação:** implementado.

Data, técnico e cliente delimitam o recorte; oferece modos Planejamento/Execução, texto copiável e PDF. Ajuda a preparar o dia e comunicar a agenda com referências de OS quando disponíveis.

**Limite:** os modos usam o conjunto consultado de agenda/OS planejadas; o modo Execução não deve ser presumido como auditoria completa de toda a execução do período. Para fechamento diário, confrontar com Relatório do Dia e evidências Auvo.

**Validar:** filtrar um dia conhecido, comparar o texto/PDF com agenda e OS; conferir técnico e cliente corretos antes de compartilhar.

### PCM-37 — Relatório do Dia

**Acesso:** PCM → Relatórios → Relatório do Dia. **Situação:** implementado.

Consolida atividade da data, técnicos e blocos de atenção; exporta PDF. Usar ao fim do expediente para revisar execução e pendências, e não apenas contar aberturas.

**Validar:** selecionar data com tarefas conhecidas, conferir status/horas e alertas contra o detalhe dos registros; abrir PDF e revisar dados antes de circulação.

### PCM-38 — Relatório do Cliente e publicação no portal

**Situação:** implementado; publicar é uma ação explícita.

Selecionar cliente e período, Gerar relatório, revisar atividades e exportar PDF. Publicar no Portal disponibiliza o relatório ao cliente pelo canal próprio; gerar/baixar não equivale a publicar.

**Regras:** publicar somente conteúdo revisado e apropriado ao destinatário. Cliente e período são parte do escopo; documento publicado não autoriza acesso ao histórico interno inteiro.

**Validar:** relatório de fixture → revisão → PDF → publicação autorizada → consulta com a conta cliente-síndico vinculada. Confirmar que outro condomínio não o recebe.

### PCM-39 — Responsáveis e preferências de contato

**Acesso:** Resumo do 360 → Responsáveis. **Situação:** implementado.

Cadastro local dos representantes do condomínio: nome, papel (síndico, gerente predial etc.), e-mail, telefone e preferência WhatsApp/ligação/e-mail/outro. É distinto do contato sincronizado do Auvo; cadastrar um responsável não deve ser presumido como alteração de todos os contatos externos.

**Regra:** nome e vínculo ao cliente são necessários; os demais dados qualificam o relacionamento. Atualizar o representante quando mudar a gestão evita direcionar informações à pessoa errada.

**Validar:** incluir/editar/remover responsável de teste no condomínio correto; conferir preferência e distinção do contato Auvo. A preferência cadastrada não garante envio automático por aquele canal.

### PCM-40 — Alma do cliente e contexto de comunicação

**Acesso:** 360 → Comunicação. **Situação:** implementado.

Texto editável de particularidades úteis ao atendimento, como preferência por mensagens objetivas ou por áudio; pode compor o contexto consumido pelo Zé. Limite de 4.000 caracteres. Não é campo para credenciais ou informações pessoais desnecessárias.

**Validar:** salvar observação neutra em fixture, reabrir e conferir; testar a adequação da resposta do agente no canal de teste. Registrar uma preferência não comprova que todo agente/canal já a respeita.

## 9. Atendimento — Inbox, Zé e automações

### ATD-01 — Inbox e contexto do cliente

**Acesso:** Atendimento · Zé → Inbox. **Situação:** implementado; recepção/envio dependem do canal.

Central de conversas, mensagens, filtros, tags e contexto de contato/cliente. Permite acompanhar o agente e intervenção humana; vínculo do cliente dá contexto sem precisar copiar a conversa para outra planilha. O histórico relacionado pode apoiar o Chamado.

**Regras:** vínculo precisa apontar para o cliente correto. Uma conversa comercial pode virar oportunidade; uma solicitação de manutenção deve seguir o fluxo PCM. Consultar a conversa não é prova de que um Chamado foi gerado.

**Validar:** conversa de teste recebida no canal autorizado, vínculo, histórico e rastreabilidade até o Chamado/oportunidade; não enviar mensagens de teste a cliente real.

### ATD-02 — Handoff para humano e devolução ao Zé

**Situação:** implementado; operação do canal condicionada.

Atendente assume exceção sensível, responde com contexto e devolve ao agente quando resolvida. Evita que humano e automação respondam sem coordenação.

**Validar:** assumir conversa de teste, conferir estado/autor, responder no canal de teste e devolver. Verificar comportamento do Zé durante a intervenção, não apenas a aparência do botão.

### ATD-03 — Modos do canal e acionamento do agente

**Acesso:** Config → Canal. **Situação:** implementado; depende de conexão/configuração.

Configuração do canal/cliente e modo Desligado, Monitorar ou Ativo. Monitorar coleta/observa sem responder; Ativo permite respostas conforme as regras. Não interpretar o texto promocional “24/7” como disponibilidade externa comprovada: horário configurado, provedor e integração interferem.

**Validar:** os três modos em canal dedicado; comprovar ausência de resposta em Monitorar/Desligado e resposta coerente em Ativo. Só habilitar produção após aprovar esse comportamento.

### ATD-04 — IA, personas e instâncias de agentes

**Acesso:** Config → IA / Personas / Agentes / Operação. **Situação:** implementado; execução condicionada.

Definição de identidade, instruções, modelo e janela de atendimento; personas e instâncias permitem separar comportamento. Operação reúne configuração, lições e especialistas associados ao agente conforme o fluxo existente.

**Regras:** a IA apoia o atendimento, mas não substitui a decisão técnica do gestor nem pode ser presumida como autorizada a qualquer ação. Alteração de instrução precisa de teste em exemplos reais anonimizados antes de ativar no canal produtivo.

**Validar:** pergunta comum, pedido de manutenção, mensagem ambígua e exceção; conferir resposta, encaminhamento e limite de atuação, com revisão humana.

### ATD-05 — Conhecimento, tags e fluxos

**Situação:** implementado; automações exigem teste de canal.

Conhecimento permite cadastrar/editar/desativar orientações usadas no atendimento. Tags organizam conversas. Fluxos permitem cadastro, passos, receitas disponíveis e consulta de logs, para padronizar ações e observar a execução.

**Uso diário:** manter respostas corretas e consultar logs quando a automação não segue o esperado. Um fluxo cadastrado não comprova que seu gatilho/canal está ativo.

**Validar:** informação de teste na base, resposta coerente, tag e execução de um fluxo simples com log; revisar o efeito antes de ampliar para automações complexas.

### ATD-06 — WhatsApp Evolution e canais Meta

**Acesso:** Config → Evolution / Meta WA / Instagram / Messenger. **Situação:** condicionado.

Há interfaces para conexão/administração Evolution e cadastro de canais externos. Credenciais e webhooks são requisitos externos. QR/conectar/desconectar alteram a operação do canal e não devem ser usados numa apresentação sem coordenação.

**Limite:** a existência das abas não comprova que cada conta Meta foi aprovada, conectada ou testada ponta a ponta. Validar canal por canal, sem prometer omnichannel já ativo.

**Validar:** estado da integração, recebimento e resposta em conta de teste, vínculo e histórico. Nunca compartilhar chaves no manual ou em prints.

### ATD-07 — Templates, comentários Instagram e opt-out

**Acesso:** Config → Templates / Coment. IG / Opt-outs. **Situação:** implementado, condicionado ao provedor.

Templates WhatsApp, regras de automação para comentários e controle de não recebimento estão disponíveis como capacidades de configuração. Aprovação do template/janela de envio depende do canal; uma regra cadastrada não é garantia de publicação/envio.

**Validar:** template e comentário em ambiente autorizado, conferir log/resultado e comprovar respeito ao opt-out. Não acionar campanhas ou mensagens em massa na homologação.

### ATD-08 — Scoring, clusters e entrada no Comercial

**Situação:** implementado; resultado depende de dados e configuração.

Configuração de scoring e regras de clusters apoia classificação. O agente pode registrar oportunidade comercial na etapa configurada como entrada do agente, vinculando Conta e contexto da conversa, sem duplicar cadastro.

**Validar:** lead de teste → classificação → oportunidade no Funil correto → retorno ao contexto da conversa. Não confundir pontuação com aprovação automática de uma venda.

### ATD-09 — Dashboard de atendimento

**Situação:** com pendência observada.

O painel foi implementado para volume, pendências e tempos de atendimento. Na consulta desta versão retornou “Dashboard indisponível” e falha de conexão ao serviço de métricas. A captura documenta o erro, não um painel homologado.

**Validar depois da correção/configuração:** carregar o painel, confrontar contagens com o Inbox e confirmar o período. Até lá, não usar a ausência de indicadores como zero atendimentos.

## 10. Comercial — da oportunidade ao contrato

### COM-01 — Contas e contexto comercial no 360

**Situação:** implementado.

Contas organiza a carteira comercial e conduz ao mesmo cadastro do cliente/Conta. A aba Comercial da 360 concentra oportunidades, propostas, levantamentos e contratos relacionados conforme o acesso.

**Regra:** lead/prospecto/cliente não precisam ser registros duplicados. Um cliente pode ter nova oportunidade sem perder o histórico operacional.

**Validar:** localizar Conta, abrir 360, consultar oportunidade e retornar ao contexto original, preservando identidade e histórico.

### COM-02 — Funil Kanban, etapas e perdas

**Situação:** implementado.

Criar oportunidade, acompanhar etapa e mover o card conforme a negociação. Configuração do funil define nomes, ordem, cor e motivos de perda; uma etapa recebe a entrada do agente.

**Regras:** perder oportunidade exige motivo; apenas uma etapa é a entrada do agente. Mover para ganho não deve ser confundido com assinatura ou recebimento financeiro.

**Validar:** oportunidade de teste → evolução → perda com motivo; num caso separado, avançar o processo vencedor e conferir histórico/etapa. Tentar perda sem motivo deve ser recusado.

### COM-03 — Precificação e proteção de piso

**Situação:** implementado.

Parâmetros de mão de obra por nível, veículo, materiais, margem e imposto alimentam composição. Custo de pessoal real do Financeiro é usado quando disponível, com referência estimada como fallback indicado.

**Regras:** preço = custo × (1 + margem) ÷ (1 − alíquota); piso = custo ÷ (1 − alíquota). O desconto não pode ultrapassar o limite que colocaria o preço abaixo do piso. Nesse cálculo, margem é acréscimo sobre custo, não percentual de lucro sobre a venda.

**Validar:** composição pequena calculada à mão, origem do custo, arredondamento e recusa de preço abaixo do piso. Revisar parâmetros antes de enviar propostas reais.

### COM-04 — Levantamento de pré-venda

**Situação:** implementado; dados de campo condicionados.

Reaproveita inspeção/assessment para apoiar composição de proposta, evitando digitar novamente o diagnóstico. O usuário confere itens e decide o que entra no escopo.

**Regra:** importar um levantamento não aprova automaticamente a proposta nem garante que todos os achados pertencem ao escopo contratado. Proposta comercial e corretiva operacional têm destinos diferentes.

**Validar:** selecionar levantamento autorizado, importar/revisar itens e conferir referências ao diagnóstico original, quantidades e preços.

### COM-05 — Editor de proposta, revisão e versões

**Situação:** implementado.

Na oportunidade/aba Comercial, criar proposta, compor itens e quantidades/horas, revisar valor e avançar de rascunho para revisão/aprovação. Histórico de versões permite rastrear o conteúdo salvo.

**Regras:** composição é feita pelo usuário; não há geração automática integral de proposta por IA. Piso limita o preço. Conteúdo enviado deve corresponder à versão aprovada; revisar escopo, prazo e valores antes de publicar.

**Validar:** rascunho → composição → revisão → aprovação; reabrir e conferir itens/versão/total. Testar item faltante e preço abaixo do piso em dados de teste.

### COM-06 — PDF, envio e decisão no portal

**Situação:** implementado; comunicação/aceite exigem validação autorizada.

Baixar PDF gera arquivo da proposta. A ação Enviar gera/confere o documento e muda o estado que a disponibiliza no portal. O cliente pode aceitar/recusar conforme prazo e estado permitidos.

**Regras/limites:** não há DOCX entregue; publicação no portal não deve ser presumida como WhatsApp/e-mail automático. Aceite registrado não é assinatura digital juridicamente vinculante. Proposta expirada ou já decidida tem guardas próprias.

**Validar:** versão aprovada → PDF → envio → visualização pela conta correta → aceite/recusa em fixture, com conferência de prazo e registro da decisão.

### COM-07 — Contrato comercial e vínculo com faturamento

**Situação:** implementado.

Contrato derivado de proposta aceita tem tipo residente, volante ou avulso; vigência, escopo, valor, vencimento e reajuste. Ativação de recorrente se conecta ao plano de faturamento no Financeiro; avulso não gera recorrência mensal.

**Regras:** ativar apenas rascunho com vigência válida; não avulso precisa valor mensal positivo. Encerramento exige fluxo/motivo e preserva histórico. Reajuste é sinalizado, não aplicado sozinho. Estado suspenso previsto no modelo não equivale a uma automação de suspensão já disponível na interface.

**Validar:** proposta aceita → contrato rascunho → ativação → vínculo financeiro; conferir que repetir a ação não duplica contrato/receita. Testar avulso e vigência vencida em casos separados.

### COM-08 — Dashboard comercial

**Situação:** implementado; depende de histórico suficiente.

Conversão por etapa, ciclo de venda, ticket, motivos de perda, desconto e origem apoiam a revisão comercial. Sem amostra, deve mostrar ausência de dados, não métricas inventadas.

**Validar:** oportunidades conhecidas em cada etapa, perda e ganho; conferir período, denominadores e origem antes de tomar decisão de gestão.

## 11. Financeiro — caixa, controle e gestão

### FIN-01 — Dashboard de caixa

**Situação:** implementado.

Posição, entradas/saídas, previsto × realizado, recebimentos/pagamentos, inadimplência e projeção de 90 dias. Consultar diariamente após atualizar os movimentos.

**Regra:** caixa considera o pagamento; não confundir com DRE por competência. Sem baixas e saldo inicial confiáveis, o painel não representa necessariamente o banco real.

**Validar:** data e conta conhecidas, confronto com extrato e lançamentos, consistência da projeção após uma baixa de teste.

### FIN-02 — Lançamentos, baixas, anexos e correções

**Situação:** implementado.

Registrar entrada/saída prevista com competência, vencimento, categoria, valor, conta e contraparte quando aplicável. Dar baixa na data real; anexar comprovante ao realizado; filtrar/exportar CSV. Corrigir/estornar mantém rastreabilidade.

**Regra:** não apagar e recriar pagamento para ajustar o passado. Previsto e realizado não podem ser somados como se fossem dois recebimentos da mesma cobrança. Competência e data do dinheiro são campos distintos.

**Validar:** previsão → baixa → anexo → correção/estorno em fixture; conferir efeito no saldo e histórico, sem pagar/cobrar alguém de verdade.

### FIN-03 — Categorias e plano de contas

**Situação:** implementado.

Categorias de Entrada/Saída, raízes e subcategorias, edição e desativação estruturam análise, DRE e orçamento. Manter nomenclatura curta e estável antes de alimentar a operação.

**Validar:** uma receita e uma despesa, sua subcategoria e uso no lançamento; conferir que desativar não apaga histórico.

### FIN-04 — Contas bancárias e transferências

**Situação:** implementado.

Cadastrar conta/banco, saldo inicial e corte; os movimentos formam o saldo. Transferência entre contas próprias cria os dois lados relacionados.

**Regra:** transferência não é receita nem despesa operacional. Não ajustar saldo manualmente para esconder diferença sem investigar movimentos.

**Validar:** duas contas de teste, transferência e confronto de saldos; total consolidado não deve crescer com a transferência.

### FIN-05 — Importação OFX e conciliação

**Situação:** implementado.

Selecionar conta, carregar OFX, revisar prévia e confirmar importação. Conciliar com previsto existente, criar lançamento categorizado ou ignorar a transação quando adequado.

**Regras:** identificação FITID impede reimportação duplicada. Procurar o lançamento previsto antes de criar outro evita duplicar cobrança/despesa. Importar arquivo não significa conciliar automaticamente todas as linhas.

**Validar:** arquivo de teste conhecido → importação → conciliação → reimportação sem duplicar; conferir conta, sinal, data e valor.

### FIN-06 — Contas a receber e aging

**Situação:** implementado.

Recebíveis por faixa de atraso ou cliente, vencimentos e baixa. Ajudam a ordenar a cobrança e localizar pendências da carteira.

**Regra:** baixa manual usa data real. Atraso precisa ser avaliado na data-base correta; não confundir pendência de integração com falta de pagamento confirmada.

**Validar:** um previsto futuro, um vencido e um recebido de teste; conferir faixas e retirada da pendência após baixa.

### FIN-07 — Contratos financeiros e previstos mensais

**Situação:** implementado.

Plano de faturamento mensal por cliente: valor, dia, início, fim e status. Gerar previstos do mês materializa os recebíveis; repetir a geração não deve duplicá-los. Pode estar relacionado ao contrato comercial ativado.

**Limite:** a opção de bloqueio de OS por atraso é aviso visual; não bloqueia a operação PCM automaticamente. Contrato financeiro é plano de faturamento, não o documento comercial assinado.

**Validar:** gerar uma competência de teste duas vezes e conferir uma cobrança prevista por contrato/competência; verificar vigência e vencimento.

### FIN-08 — PIX, boleto e integração de cobrança

**Situação:** condicionado a Mercado Pago/configuração e ambiente.

Em Contas a Receber, a ação de cobrança permite emitir PIX/boleto e obter código/link conforme integração. Credenciais e ambiente sandbox/produção são administrativos; retorno do provedor e atualização de status precisam ser conferidos.

**Regra:** exibir um botão não comprova credencial válida, aprovação da conta ou pagamento recebido. Usar sandbox e procedimentos autorizados para homologar, sem cobrança financeira real acidental.

**Validar:** emissão de teste, identificador externo, retorno/webhook e baixa coerente, evitando duplicidade de cobrança.

### FIN-09 — Régua de cobrança e histórico de envios

**Situação:** implementado; envios condicionados aos canais e agendamento.

Configurar pontos antes/depois do vencimento, WhatsApp/e-mail/ambos e mensagem. Ativar/desativar e acompanhar histórico. Recebível pago não deve continuar na régua; canal indisponível deve deixar registro de falha.

**Regra:** sem ponto ativo, não há lembrete configurado. Não ativar régua sobre clientes reais apenas para demonstrar uma tela.

**Validar:** recebível e contato de teste, ponto autorizado, um envio/log e interrupção após pagamento. Conferir destinatário e prevenção de repetição.

### FIN-10 — Contas a pagar e despesas recorrentes

**Situação:** implementado.

Cadastrar despesas fixas com descrição, valor, vencimento, categoria e conta; editar/desativar a regra; Pagar registra a data efetiva. Despesas avulsas são lançamentos, não precisam de recorrência.

**Validar:** recorrência pequena de teste, geração conforme período, baixa e desativação sem apagar pagamentos anteriores.

### FIN-11 — Impostos e provisão gerencial

**Situação:** implementado, com revisão contábil necessária.

Configuração por faixas de RBT12 ou alíquota fixa e provisão por competência. A provisão cria previsão de saída para não tratar receita bruta como caixa livre.

**Limite:** é cálculo gerencial, não apuração fiscal oficial nem emissão do DAS. Este material não recomenda alíquota ou enquadramento tributário; validar com o contador.

**Validar:** parâmetros aprovados pelo contador, competência de teste e conferência do previsto, evitando provisionar duas vezes a mesma obrigação.

### FIN-12 — Fechamento mensal e reabertura

**Situação:** implementado.

Após conciliar extrato, revisar baixas, categorias e provisões, Fechar mês protege a competência. Superadmin pode reabrir com motivo, corrigir e fechar novamente, com histórico.

**Regra:** competência fechada bloqueia alterações; não mudar data apenas para contornar o fechamento. Exportar CSV antes da entrega ao contador e guardar a referência do mês.

**Validar:** competência exclusiva de teste → fechar → tentar alteração → recusa → reabrir com motivo e permissão adequada → corrigir/reencerrar.

### FIN-13 — Custos de pessoal por vigência

**Situação:** implementado.

Custo mensal completo, horas-base e início de vigência por funcionário geram referência de custo/hora. Nova condição deve criar nova vigência, preservando o passado.

**Regra:** custo/hora depende de base consistente; campo vazio não significa custo zero. Critério do que compõe o custo deve ser alinhado pela empresa/contabilidade.

**Validar:** dois períodos de vigência e efeito na referência utilizada, sem reescrever custo histórico de OS antigas.

### FIN-14 — Rentabilidade por cliente e OS

**Situação:** implementado, com pendência observada na consulta.

Foi desenvolvido para comparar receita com custo de horas/despesas e abrir detalhe mensal/OS. Indicador de cobertura deve alertar quando o custo está incompleto. Na consulta desta versão a tela retornou “Falha ao carregar rentabilidade”.

**Limite:** não apresentar uma margem como homologada enquanto o carregamento e a cobertura não forem resolvidos. Ausência de custo não é lucro real.

**Validar depois de destravar:** cliente com receita, horas, vigências e despesas conhecidas; conferir cálculo manual, cobertura e navegação até OS de origem.

### FIN-15 — DRE gerencial

**Situação:** implementado.

Receita, despesas por grupo e resultado no mês de competência. Comparar períodos e entender causas de melhora/piora junto do Dashboard de caixa.

**Regra:** DRE e caixa podem divergir corretamente por diferença entre competência e pagamento. É visão gerencial, não demonstração contábil oficial.

**Validar:** receita em uma competência paga em outra; conferir em qual relatório cada evento aparece e os totais por grupo.

### FIN-16 — Orçamento anual e desvios

**Situação:** implementado.

Definir ano/categoria/meta mensal e aplicar aos 12 meses; acompanhar realizado e desvio percentual. Não confundir com Orçamento de Serviço do PCM nem Proposta comercial.

**Regra:** sem meta, existe realizado, mas não base para percentual de desvio. Definir meta não limita automaticamente a autorização de uma despesa.

**Validar:** categoria de teste com meta e lançamento; conferir desvio e comportamento sem meta.

### FIN-17 — Cockpit financeiro

**Situação:** implementado; confiabilidade depende da base financeira.

Runway/fôlego de caixa, equilíbrio, ticket, inadimplência e margem por cliente apoiam gestão. Aviso de amostra pequena ajuda a não interpretar poucos meses como tendência definitiva.

**Limite:** não é o Cockpit geral de todos os módulos. Indicadores que dependem da rentabilidade/cobertura exigem a mesma cautela descrita em FIN-14.

**Validar:** períodos fechados e números conhecidos; conferir pressupostos e alertas antes de usar para decisão de preço, corte ou expansão.

## 12. Área do Cliente — portal do síndico

### PRT-01 — Central interna e criação de acesso

**Acesso interno:** Área do Cliente; criação no Cliente 360. **Situação:** implementado.

A central explica o portal e o procedimento de teste. Criar acesso ao portal usa nome, e-mail e senha inicial do síndico e vínculo ao condomínio. Testar em sessão privativa, preservando a sessão interna.

**Regras:** login cliente-síndico vinculado a um condomínio; usuário interno não entra na interface externa por simulação. A sessão usada no levantamento é interna: os prints dessa central não devem ser apresentados como prints da sessão do síndico. Não foi criada identidade externa apenas para capturar a apresentação.

**Validar:** conta de teste já autorizada, login privativo e isolamento. Validar destinatário antes de entregar credenciais por canal seguro.

### PRT-02 — Painel, diagnósticos, OS e documentos

**Situação:** implementado; validação visual externa requer sessão própria.

Painel do condomínio, Assessment/inspeções disponíveis, histórico de OS, notas/anexos permitidos e documentos/laudos/relatórios publicados. Cronograma e conformidade contextualizam programação e documentos. Notificações e satisfação complementam o retorno do cliente.

**Regra:** somente dados autorizados do condomínio; não expor custo/margem internos. Documento só deve ser publicado depois da revisão. Satisfação do portal é a fonte canônica; a antiga pesquisa espelhada do Auvo não deve ser considerada uma pesquisa ativa equivalente.

**Validar:** conferir documento publicado, OS e cronograma com o cadastro interno; comprovar que outro cliente não vê esses dados. Testar avaliação/notificação somente em fixture.

### PRT-03 — Chamados e interação com a operação

**Situação:** implementado.

Cliente registra solicitação pelo portal, acompanha retorno, envia comentário/anexo conforme a ação disponível e consulta andamento. A equipe trata a demanda no PCM, preservando o mesmo histórico.

**Validar:** solicitação de teste pelo portal → aparecimento no cliente certo no PCM → interação/retorno → consulta externa. Não confundir chamado criado com técnico já despachado.

### PRT-04 — Orçamentos, propostas e financeiro externo

**Situação:** implementado; depende do que foi publicado/emitido.

Portal tem seções para decisão de Orçamento de Serviço, propostas comerciais e consulta de faturas/vencimentos/segunda via. Decidir uma proposta não equivale a assinatura digital; consultar fatura não demonstra pagamento confirmado.

**Validar:** publicar somente fixture, conferir valores/prazo e aceitar/recusar no estado correto; consultar fatura própria. Testar proteção contra outro cliente e contra repetição/expiração da decisão.

## 13. Configurações, acesso e ajuda

### CFG-01 — Usuários e grupos de permissão

**Situação:** implementado.

Configurações → Grupos/Usuários controla permissões por módulo em leitura ou escrita e atribuição dos usuários. Superadmin/supervisor têm administração conforme suas regras; ações específicas podem ser exclusivas do superadmin.

**Validar:** conta leitura sem botões de escrita, conta com módulo restrito sem acesso à área e cliente-síndico isolado. Fazer testes com contas dedicadas; não alterar o acesso do Fabrício durante uma apresentação.

### CFG-02 — Integrações e segredos

**Situação:** implementado, condicionado à configuração dos provedores.

Central de metadados/estado e credenciais de serviços como e-mail e Mercado Pago; Evolution possui configuração própria no Atendimento. Segredos são gravados no servidor/Vault e não devem ser reexibidos ao usuário. Ambiente de teste/produção precisa ser conferido antes de emitir cobrança ou enviar mensagem.

**Validar:** presença/estado de configuração sem expor conteúdo do segredo; uma integração por vez com destinatário/recurso de teste autorizado. Nunca incluir token, senha ou chave de API no prompt enviado à IA.

### CFG-03 — Configuração de IA e gastos

**Situação:** implementado; geração depende de credencial/quota.

Superadmin configura chave OpenRouter, modelos para funções disponíveis, ativação e quota. Gasto de IA reúne consumo/custo para acompanhamento. Recursos como título de OS e classificação de importação continuam sujeitos a revisão humana.

**Validar:** configuração/estado/quota e um caso autorizado de geração, conferindo saída e registro de consumo. Cadastro manual não deve depender da IA para existir.

### CFG-04 — Priorização e localização Auvo

**Situação:** implementado.

Priorização ajusta os pesos GUTD usados no cálculo da operação. Localização Auvo permite configurar separador e ordem do caminho (Área primeiro ou por último), com prévia da representação plana: o Auvo não reproduz a árvore física completa como hierarquia.

**Validar:** pesos somando 100 e efeito no score; preferência de localização com um cliente/ativo de teste, comparando o resultado no Auvo. Não alterar regras globais para corrigir um único cadastro mal preenchido.

### CFG-05 — Manual operacional e ajuda contextual

**Situação:** implementado e atualizado na PR #70.

Guia do SO → PCM traz 13 roteiros pesquisáveis: rotina, Cliente 360, Chamado, OS, backlog, estrutura, Componentes, Identificador, Sistemas, Preventivas, Ferramentas, consultas/relacionamento e sincronização. Links discretos nos principais contextos abrem o assunto em outra aba para preservar o formulário.

**Validar:** abrir ajuda em Nova OS sem perder texto não salvo; pesquisar “etiqueta”, “abrir OS” e “360”; usar celular/teclado e link direto. Os outros módulos também têm páginas de orientação, com profundidades diferentes.

## 14. O que ainda não deve ser apresentado como entregue

| Item | Situação e consequência |
| --- | --- |
| Marketing operacional | Área planejada/em construção; não há calendário/publicação de conteúdo homologados por essa interface. |
| Growth e atribuição completa de campanhas | Fazem parte da visão de produto; não considerar análise Meta/Google Ads operacional apenas pelo texto do módulo. |
| Cockpit geral da empresa | Planejado/em construção. Início e Dashboard PCM não equivalem ao painel executivo consolidado futuro. |
| Operação & Estoque como módulo completo | Há gestão de ferramentas e dados de materiais/custos em outros fluxos, mas isso não entrega sozinho estoque completo de insumos, compras e consumo integrado. |
| Proposta integral gerada por IA | Não entregue; composição é feita pelo usuário. |
| Proposta em DOCX e assinatura eletrônica contratual | Não entregues; PDF/aceite no sistema não substituem essas capacidades. |
| Bloqueio automático de OS por inadimplência | Aviso visual no Financeiro, não trava efetiva no PCM. |
| Reajuste automático de contratos | Sinalização existe; não pressupor alteração automática de valores. |
| Despacho Auvo plenamente garantido por salvar/planejar | Não: há confirmação, integração e conferência de campos/destino. |
| Homologação de todos os canais externos | Não comprovada neste levantamento. Aba/configuração não basta para afirmar operação ativa. |
| Documento técnico/legal automaticamente aprovado | Não: inspeção, PMOC e SPDA exigem revisão do profissional responsável. |

## 15. Roteiro de homologação por prioridade

Os itens abaixo são critérios sugeridos de aceite operacional, não mudança de escopo do desenvolvimento. Preencher situação como Não iniciado, Em teste, Aprovado ou Reprovado. Registrar também responsável, data e evidência.

| ID | Prioridade | Jornada | Resultado que precisa ser comprovado |
| --- | --- | --- | --- |
| UAT-01 | P0 | Cliente certo no 360 | Dados, ativos e detalhes não misturam dois condomínios. |
| UAT-02 | P0 | Identificador recomendado | Aplicar preenche campo; salvar/reabrir preserva o código; alternativa manual funciona. |
| UAT-03 | P0 | Novo Chamado → OS | Um histórico/vínculo consistente, sem duplicação da demanda. |
| UAT-04 | P0 | PRE → confirmação → planejamento | Mesmo registro evolui e recebe o vínculo correto. |
| UAT-05 | P0 | Confirmação Auvo | Tarefa de teste criada uma vez; conteúdo, técnico e data conferidos no destino. |
| UAT-06 | P0 | Permissões | Leitura não escreve; cliente-síndico só consulta seu condomínio. |
| UAT-07 | P1 | Estrutura → Componente → Sistema | Posição correta, Identificador estável e bloqueio de dois Sistemas para o mesmo Componente. |
| UAT-08 | P1 | Filtros e detalhes do 360 | Combinação correta, Limpar recupera os itens e detalhe retorna ao contexto. |
| UAT-09 | P1 | Preventiva completa | Recorrência, três visões, detalhe, confirmação autorizada e histórico coerentes. |
| UAT-10 | P1 | Inspeção/Assessment → demanda | Achado revisado deriva uma vez com responsável e vínculo. |
| UAT-11 | P1 | Ferramenta | Reserva/entrega/devolução e posse histórica do item corretas. |
| UAT-12 | P1 | Agenda/horas | Planejado e realizado distinguíveis; marcações não contaminam manutenção; CSV conferido. |
| UAT-13 | P1 | Relatório e portal | Documento revisado, publicado explicitamente e visível só ao condomínio correto. |
| UAT-14 | P1 | Inbox/handoff/Zé | Canal de teste recebe, humano assume e agente volta sem conflito. |
| UAT-15 | P1 | Funil → proposta → contrato | Preço/piso, revisão, decisão e vínculo financeiro sem duplicações. |
| UAT-16 | P1 | Financeiro básico | Previsto → baixa → conciliação → saldo/DRE, com datas coerentes. |
| UAT-17 | P1 | Pendências de leitura | Dashboard Atendimento e Rentabilidade carregam e conferem com a origem. |
| UAT-18 | P2 | Cobrança e provedores | Sandbox/canal de teste; emissão/retorno/envio único e sem destinatário indevido. |
| UAT-19 | P2 | Fechamento financeiro | Competência trava, reabertura exige papel/motivo e preserva auditoria. |
| UAT-20 | P2 | Importação Excel | Exportar/reimportar sem alterações; simulação e falha parcial tratadas com segurança. |
| UAT-21 | P2 | PMOC/SPDA | Registros e conclusões revisados pelo responsável técnico antes de uso externo. |
| UAT-22 | P2 | Manual e autonomia | Fabrício conclui uma tarefa consultando a ajuda, sem orientação verbal adicional. |

### Modelo para registrar cada resultado

- Jornada/ID:
- Pessoa responsável e data:
- Cliente/registro de teste utilizado:
- Pré-condições e permissão:
- Passos executados:
- Resultado esperado:
- Resultado observado:
- Evidência (print, número do registro, horário, link sem segredo):
- Situação: Não iniciado / Em teste / Aprovado / Reprovado:
- Próximo passo e responsável:

## 16. Pontos de atenção e decisões da operação

1. **Despacho Auvo:** definir uma conferência obrigatória de atribuição e agenda no destino até o contrato de envio garantir todos os campos necessários. Dono sugerido: Fabrício com responsável pela integração.
2. **Preventivas:** aprovar periodicidade, questionários e os recursos de teste antes de confirmar uma tarefa real. Gate Auvo precisa ser respeitado.
3. **Dashboard Atendimento e Rentabilidade:** investigar os erros de consulta registrados; não assumir causa sem diagnóstico. Isso afeta homologação dos indicadores, não prova falha de todo o módulo.
4. **Cadastros:** definir padrão de nome/sigla/categoria e um responsável pela qualidade. Não refazer códigos antigos por estética, pois há impacto em etiquetas e rastreabilidade.
5. **Financeiro:** combinar data de corte, saldos, categorias e custos com Aline/contador; relatório bem apresentado com base incompleta continua inadequado para decisão.
6. **Canais externos:** manter lista de quais números/contas/provedores estão efetivamente ativos e quais são só configuração implementada.
7. **Portal:** homologar com conta cliente-síndico dedicada e validar o conteúdo antes de liberar a clientes. Não contornar a separação de identidade para uma demonstração.

## 17. Como usar este Markdown com uma IA

O arquivo não contém senha, token ou chave. Ainda assim, nomes de recursos e regras de operação são informação interna. Não anexar extratos, conversas ou documentos pessoais reais à IA sem autorização.

### Prompt para apoio operacional

> Use o documento “Sinérgica SO — funcionalidades entregues e guia de validação” como referência da versão de 14/10/2026. Sou o Fabrício. Quero executar [tarefa]. Diga o caminho da tela, pré-condições, passos, regra de negócio, resultado esperado e como conferir. Diferencie cadastro PCM, envio Auvo e execução em campo. Não invente botões, automações, permissões ou funcionalidades planejadas. Se faltar contexto, faça uma pergunta objetiva antes de orientar uma ação que altera dados. Nunca solicite senha ou token.

### Prompt para homologação

> Ajude a executar a jornada [UAT-ID] sem dados produtivos indevidos. Monte um caso feliz, um caso inválido e um caso de permissão/isolamento. Para cada um, liste pré-condição, passos, resultado esperado e evidência a guardar. Separe o que é implementação descrita do que já foi efetivamente observado. Não marque como aprovado sem meu relato e evidência. Envios, cobranças e tarefas externas exigem recurso de teste autorizado.

### Prompt para reportar problema

> Compare o comportamento esperado da funcionalidade [ID] com este relato: [passos, resultado, erro, horário e registro sem credenciais]. Diga se parece falha, regra, permissão, filtro ou pendência de integração. Se não der para concluir, liste as verificações seguras. Não recomende recadastrar, reenviar ou apagar registros antes de localizar o original e conferir o destino.

## 18. Base de evidência e limites da revisão

Referência imutável do código: [main em 22aca39](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/tree/22aca3918224bc45175e80c6ec88b957fdb604aa). A navegação real e os arquivos de domínio têm prioridade sobre descrições antigas do plano de produto.

| Escopo | Arquivos usados para conferir o comportamento |
| --- | --- |
| Telas realmente montadas | `apps/web/src/app/HomePage.tsx`, `app/modulos.ts` e `app/App.tsx` |
| Operação atual | `features/guia/pcm-manual.ts`, `pcm/pages/VisaoClientePage.tsx`, `pcm/pages/OrdensServicoPage.tsx` e componentes de detalhe/abertura |
| Prioridade e prazos | `pcm/domain/priorizacao-backlog.ts`, `ordens-servico.ts`, `chamados.ts`, `hub-os.ts` |
| Ativos e planilhas | `pcm/domain/identificador-ativo.ts`, `cliente-360-filtros.ts`, `composicao-sistema.ts`, `importacao-estrutura.ts` e componentes correspondentes |
| Preventivas e qualidade | `pcm/components/PreventivasWorkspace.tsx`, `PreventivaDetalheDrawer.tsx`, `pcm/domain/preventivas.ts`, `assessment.ts`, páginas de Inspeções/PMOC/SPDA |
| Agenda/relatórios/ferramentas | páginas e domínios de Agenda, Apontamento, Ferramentas, Reservas e Relatórios; `pcm/application/relatorio-planejamento.ts` |
| Atendimento | `atendimento/pages/AtendimentoConfigPage.tsx`, páginas Inbox/Dashboard e componentes/domínio de canal, Evolution, automações, personas e scoring |
| Comercial | `guia/ComercialGuia.tsx`, `comercial/domain/precificacao.ts`, `contrato.ts`, `proposta.ts`, páginas e componentes do Comercial |
| Financeiro | `guia/FinanceiroGuia.tsx`, páginas/aplicação/domínio do Financeiro e `config/pages/IntegracoesPage.tsx` |
| Portal e segurança de acesso | `area-cliente/PortalShell.tsx`, `area-cliente/pages/AreaClienteAdminPage.tsx`, aplicação/adapter do portal e domínio/configuração de permissões |
| Ajuda e áreas planejadas | `guia/PcmGuia.tsx`, `guia/PlanejadosGuia.tsx`, `guia/VisaoGeralGuia.tsx` |

Os caminhos `features/...` acima são relativos a `apps/web/src/`. Há testes automatizados no repositório para diversas jornadas, inclusive ativos, 360, Chamados, backlog, Comercial, Financeiro e manual. Sua existência não é declaração de que toda essa suíte foi reexecutada nesta sessão: esta foi uma revisão documental e visual de leitura, não uma campanha completa de testes transacionais.

Os prints mostram a interface efetivamente carregada nesta revisão, incluindo estados vazios e erros quando presentes. Contatos foram mascarados para a apresentação. Não foram fabricados indicadores nem criadas capturas de sessão externa por troca artificial de papel. A galeria HTML distingue a central administrativa do portal da interface do síndico que requer login próprio.
