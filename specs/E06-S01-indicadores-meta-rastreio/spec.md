# Feature Specification: Marketing — indicadores das campanhas da Meta e rastreio até a venda

> **Convenção Sinérgica:** cada Acceptance Scenario tem id global **AC-N**; tasks e testes citam esses ids.

**Feature Branch**: `feat/E06-S01-marketing-indicadores-meta`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Módulo Marketing: indicadores das campanhas da Meta (gasto, alcance, impressões, cliques, leads, custo por lead) por campanha → conjunto → anúncio com período, mais rastreio anúncio → lead → oportunidade/proposta/contrato para responder 'qual campanha gerou receita'. Schema `marketing` com RLS FORCE e pgTAP. Sincronização por Edge Function idempotente com janela de reprocessamento, credencial no Vault, sem API real nesta entrega (fixtures, adapter pronto). Escrever na API da Meta (criar/pausar campanha) está FORA DE ESCOPO. ADR-1699."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver o desempenho das campanhas por período (Priority: P1)

O gestor de marketing abre o módulo Marketing, escolhe um período e vê, numa tela só, quanto foi
gasto, quantas pessoas foram alcançadas, quantas impressões e cliques houve, quantos leads
entraram e quanto custou cada lead. Ele começa pelo total, abre a campanha que mais gastou, vê os
conjuntos dela e, dentro do conjunto, os anúncios — sempre com os mesmos números, para poder
comparar peça a peça.

**Why this priority**: é a pergunta que abriu o módulo ("os indicadores das campanhas da Meta").
Sem ela não existe módulo Marketing; com ela sozinha já existe algo utilizável.

**Independent Test**: carregar dados de uma conta de anúncios com três níveis de hierarquia e um
intervalo de datas, abrir a tela e conferir que os totais batem com a soma dos níveis abaixo.

**Acceptance Scenarios**:

1. **AC-1** — **Given** uma conta de anúncios com campanhas, conjuntos e anúncios e métricas
   diárias gravadas, **When** o gestor abre a tela de indicadores com um período que cobre essas
   métricas, **Then** vê gasto, alcance, impressões, cliques, leads e custo por lead agregados do
   período inteiro.
2. **AC-2** — **Given** a tela carregada, **When** o gestor abre uma campanha, **Then** vê os
   conjuntos dela com os mesmos seis indicadores, e a soma dos conjuntos é igual ao número da
   campanha para gasto, impressões, cliques e leads.
3. **AC-3** — **Given** um conjunto aberto, **When** o gestor expande, **Then** vê os anúncios do
   conjunto com os mesmos indicadores.
4. **AC-4** — **Given** um período em que não houve veiculação, **When** o gestor seleciona esse
   período, **Then** a tela mostra um estado de vazio explícito ("nenhuma veiculação no período"),
   nunca zeros silenciosos nem tabela em branco.
5. **AC-5** — **Given** um anúncio com gasto e zero leads no período, **When** o custo por lead é
   exibido, **Then** aparece como indisponível ("—"), nunca como divisão por zero, infinito ou
   zero.
6. **AC-6** — **Given** a busca dos indicadores em andamento ou falhando, **When** o gestor está na
   tela, **Then** vê estado de carregando e, em caso de falha, uma mensagem de erro com ação de
   tentar de novo — a tela nunca fica em branco sem explicação.
7. **AC-7** — **Given** o gestor troca o período rapidamente duas vezes, **When** a primeira
   resposta chega depois da segunda, **Then** a tela mostra o resultado do período atualmente
   selecionado, nunca o antigo.

---

### User Story 2 - Trazer os números da Meta sem duplicar e sem ficar desatualizado (Priority: P2)

Alguém com permissão de escrita no Marketing dispara a sincronização (ou ela é disparada por
rotina). O sistema busca os números da conta de anúncios para uma janela de dias e grava. Rodar
duas vezes o mesmo dia não duplica nada, e os dias recentes são sempre reprocessados, porque a
plataforma revisa números retroativamente.

**Why this priority**: sem isso a tela da US1 só mostra dado parado. É o que faz o indicador ser
confiável ao longo do tempo.

**Independent Test**: rodar a sincronização duas vezes seguidas sobre a mesma janela e verificar
que a contagem de métricas não muda e os valores refletem a última leitura.

**Acceptance Scenarios**:

8. **AC-8** — **Given** uma conta de anúncios configurada, **When** a sincronização roda para uma
   janela de dias, **Then** campanhas, conjuntos, anúncios e métricas diárias do período ficam
   gravados.
9. **AC-9** — **Given** a sincronização já rodou para a janela, **When** ela roda de novo para a
   mesma janela com números revisados, **Then** nenhuma linha é duplicada e os valores passam a ser
   os revisados (uma métrica por anúncio e dia).
10. **AC-10** — **Given** a plataforma ainda não está conectada (nenhuma credencial no cofre),
    **When** a sincronização é chamada, **Then** ela roda em modo demonstração com dados de
    exemplo e a resposta declara explicitamente que a origem é demonstração — não falha em
    silêncio nem apresenta dado de exemplo como real.
11. **AC-11** — **Given** qualquer execução da sincronização, **When** ela termina (com sucesso ou
    com falha), **Then** fica registrada com a janela pedida, a origem dos dados, as contagens e o
    resultado, consultável depois.
12. **AC-12** — **Given** um usuário sem permissão de escrita no Marketing, **When** ele tenta
    disparar a sincronização, **Then** é recusado pelo servidor, não só pela interface.

---

### User Story 3 - Saber qual campanha gerou receita (Priority: P3)

O gestor publica um link rastreado em um anúncio. Quem clica chega ao canal de entrada carregando
a identificação do anúncio. Quando esse contato vira oportunidade no Comercial e a oportunidade
vira contrato, o Marketing consegue responder: desta campanha saíram N leads, M viraram
oportunidade, X viraram contrato, somando R$ Y — comparado com o que foi gasto nela.

**Why this priority**: é o que transforma indicador em decisão de investimento. Depende de US1 e
US2 existirem.

**Independent Test**: criar um link rastreado para um anúncio, registrar uma entrada por ele,
vincular essa entrada a uma oportunidade que virou contrato e conferir que a campanha aparece com
a receita correspondente.

**Acceptance Scenarios**:

13. **AC-13** — **Given** um anúncio cadastrado, **When** o gestor gera um link rastreado para ele,
    **Then** recebe uma URL de destino que carrega a identificação do anúncio de forma estável e
    legível pelo sistema.
14. **AC-14** — **Given** uma URL de chegada com a identificação de um anúncio conhecido, **When**
    o sistema a interpreta, **Then** reconhece o anúncio; com identificação ausente ou desconhecida,
    a entrada é registrada como sem origem, nunca atribuída ao anúncio errado.
15. **AC-15** — **Given** uma entrada registrada a partir de um anúncio, **When** ela é vinculada a
    uma oportunidade do Comercial, **Then** o vínculo fica gravado e é único por entrada.
16. **AC-16** — **Given** entradas vinculadas a oportunidades que viraram contrato, **When** o
    gestor consulta a receita por campanha num período, **Then** vê, por campanha: gasto, leads,
    oportunidades, contratos e receita, podendo ordenar pela receita.
17. **AC-17** — **Given** um usuário com permissão só no Marketing (sem Comercial), **When** ele
    consulta a receita por campanha, **Then** é recusado — o dado de receita do Comercial não vaza
    por caminho do Marketing.
18. **AC-18** — **Given** uma campanha sem nenhuma entrada vinculada no período, **When** ela
    aparece no quadro de receita, **Then** mostra gasto e zero receita, deixando claro que não houve
    atribuição (nunca some da lista escondendo o gasto).

---

### User Story 4 - O módulo deixa de ser uma promessa (Priority: P3)

Quem entra em Marketing hoje vê "Em construção". Depois desta entrega, encontra um menu com
"Indicadores" e "Receita por campanha", e o que ainda não existe (calendário editorial, geração de
conteúdo) se anuncia como não ativado em vez de simplesmente não aparecer.

**Why this priority**: a decisão de alcance do projeto: recurso desligado se anuncia; `return null`
silencioso é indistinguível de "não foi feito".

**Independent Test**: abrir o módulo Marketing e navegar pelos itens de menu.

**Acceptance Scenarios**:

19. **AC-19** — **Given** um usuário com leitura no módulo Marketing, **When** ele abre o módulo,
    **Then** cai na tela de indicadores (não no placeholder "Em construção") e tem no menu lateral
    um caminho nomeado para "Indicadores" e "Receita por campanha".
20. **AC-20** — **Given** a jornada de indicadores desligada por configuração, **When** o usuário
    abre o módulo, **Then** vê um aviso de recurso não ativado que nomeia o recurso — a área não
    desaparece do menu.

---

### Edge Cases

- Período invertido (fim antes do início) ou maior que um ano: recusado na borda com mensagem, sem
  consulta pesada no banco.
- Anúncio que existe na métrica mas cujo conjunto/campanha foi apagado na plataforma: o histórico
  gravado permanece; a tela mostra a hierarquia como ela foi sincronizada, não desaparece.
- Métrica com gasto zero e cliques zero: participa das somas, aparece com zeros, não é filtrada.
- Duas entradas rastreadas da mesma pessoa, por anúncios diferentes: ambas ficam registradas; o
  vínculo com oportunidade é por entrada, e uma oportunidade não é contada duas vezes na mesma
  campanha.
- Moeda: valores monetários são inteiros em centavos em todo o caminho; nenhum arredondamento de
  ponto flutuante entre a origem e a tela.
- Credencial configurada mas inválida/expirada: a sincronização falha registrando o erro, e a tela
  continua mostrando o último dado sincronizado, rotulado com a data da última sincronização.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST guardar a hierarquia de anúncios da plataforma (conta → campanha →
  conjunto → anúncio) com a identificação original de cada nível, de forma que a mesma entidade
  sincronizada duas vezes seja a mesma linha.
- **FR-002**: O sistema MUST guardar métricas diárias por anúncio (gasto, alcance, impressões,
  cliques, leads) com no máximo uma linha por anúncio e dia.
- **FR-003**: O sistema MUST agregar as métricas por período e por nível da hierarquia, derivando
  custo por lead como gasto dividido por leads, indisponível quando não há leads.
- **FR-004**: Os usuários MUST poder escolher o período dos indicadores e trocar de período sem que
  um resultado antigo sobrescreva o atual.
- **FR-005**: O sistema MUST expor os indicadores em uma tela do módulo Marketing com os estados de
  carregando, vazio e erro tratados.
- **FR-006**: O sistema MUST sincronizar os dados da plataforma por um processo de servidor,
  reprocessando uma janela de dias recentes configurável, com padrão de 7 dias.
- **FR-007**: A sincronização MUST ser idempotente: reexecutar a mesma janela não duplica linhas e
  atualiza valores revisados.
- **FR-008**: O sistema MUST registrar toda execução de sincronização com janela, origem dos dados,
  contagens e resultado, incluindo as que falharam.
- **FR-009**: A credencial de acesso à plataforma MUST ficar no cofre de segredos, nunca em tabela
  de aplicação, nunca no navegador, nunca em log ou mensagem de erro.
- **FR-010**: Enquanto não houver credencial configurada, o sistema MUST operar com dados de
  demonstração e MUST declarar essa origem em toda resposta e na tela.
- **FR-011**: O sistema MUST permitir gerar um link rastreado que identifica um anúncio, e MUST
  interpretar a identificação na chegada, registrando entrada sem origem quando ela falta ou é
  desconhecida.
- **FR-012**: O sistema MUST registrar entradas originadas de anúncio e permitir vincular cada
  entrada a no máximo uma oportunidade do Comercial.
- **FR-013**: O sistema MUST responder, por campanha e período, quantos leads, oportunidades e
  contratos foram atribuídos e qual a receita correspondente, ao lado do gasto.
- **FR-014**: O acesso de leitura MUST exigir permissão no módulo Marketing; o de escrita
  (sincronizar, gerar link, vincular) MUST exigir permissão de escrita, verificada no servidor.
- **FR-015**: A consulta de receita por campanha MUST exigir permissão no Marketing **e** no
  Comercial, porque combina dado dos dois contextos.
- **FR-016**: O módulo Marketing MUST deixar de exibir o placeholder "Em construção" e MUST
  anunciar, de forma nomeada, os recursos ainda não ativados.
- **FR-017**: O sistema MUST NOT escrever nada na plataforma de anúncios — criar, pausar, editar
  campanha, conjunto, anúncio, orçamento ou criativo está fora de escopo e não deve existir nem
  como caminho desativado.

### Key Entities *(include if feature involves data)*

- **Conta de anúncios**: a conta da empresa na plataforma. Identificação externa, nome, moeda, se
  está ativa. Nunca guarda credencial.
- **Campanha**: objetivo de veiculação dentro de uma conta. Identificação externa, nome, objetivo,
  situação.
- **Conjunto**: agrupamento de anúncios dentro de uma campanha, com a segmentação. Identificação
  externa, nome, situação.
- **Anúncio**: a peça veiculada dentro de um conjunto. Identificação externa, nome, situação.
- **Métrica diária do anúncio**: o desempenho de um anúncio em um dia — gasto em centavos, alcance,
  impressões, cliques, leads. Única por anúncio e dia; é o grão de tudo que a tela agrega.
- **Link rastreado**: a URL publicável associada a um anúncio, com um identificador estável usado
  para reconhecer a origem na chegada.
- **Entrada por anúncio**: o lead que chegou por um anúncio — quando chegou, qual anúncio, dados de
  contato mínimos, e opcionalmente a oportunidade do Comercial com que foi casado.
- **Sincronização**: o registro de uma execução — janela pedida, origem dos dados, contagens,
  resultado, quando.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com dados de uma conta sincronizada, o gestor responde "qual campanha gastou mais e
  qual teve o menor custo por lead no mês" em menos de 1 minuto, sem sair da tela.
- **SC-002**: Reexecutar a sincronização da mesma janela três vezes seguidas mantém a contagem de
  métricas idêntica e reflete sempre a última leitura — verificável por comando.
- **SC-003**: 100% das tabelas novas têm proteção de acesso por permissão de módulo comprovada por
  teste automatizado com caso permitido **e** caso negado.
- **SC-004**: Nenhuma credencial aparece em tabela de aplicação, resposta de rede ao navegador,
  log ou mensagem de erro — verificável por inspeção do schema e das respostas.
- **SC-005**: Dado um anúncio que gerou um contrato, a receita aparece atribuída à campanha certa
  em uma única consulta, sem o gestor precisar abrir o Comercial.
- **SC-006**: Nenhum caminho do produto escreve na plataforma de anúncios — verificável por
  inspeção do adapter, que não declara operação de escrita.

## Assumptions

- A Meta **não está conectada** nesta entrega: não há App ID, token de sistema nem conta `act_<id>`
  cadastrada. Toda a feature é exercitada com dados de demonstração determinísticos, e o adapter da
  plataforma fica pronto para receber a credencial depois (ADR-1699).
- A plataforma de anúncios é a Meta (Facebook/Instagram). Outras plataformas (Google, TikTok) estão
  fora desta story; o modelo é genérico o bastante para recebê-las depois, mas nada é generalizado
  agora (YAGNI).
- Oportunidade, proposta e contrato continuam sendo do Comercial (E03-S01/S04/S07). O Marketing
  referencia, não reimplementa — a receita atribuída é a do contrato ativo do Comercial.
- O vínculo entrada → oportunidade é explícito (alguém ou algum processo casa os dois); o Marketing
  não infere sozinho que um lead virou determinada oportunidade.
- Permissão por módulo (`marketing`, `comercial`) já existe e é resolvida no login (E00-S09/S10).
- Valores monetários em centavos inteiros, conforme ADR-0001.
- A janela padrão de reprocessamento é de 7 dias, por ser o intervalo em que a plataforma revisa
  números com mais frequência; é parâmetro, não constante escondida.
- Disparo da sincronização por rotina agendada fica para uma story seguinte; aqui ela é disparável
  sob demanda por quem tem escrita no módulo.
