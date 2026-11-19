---
name: perguntas-fabricio-2026-11-19
description: Perguntas abertas que dependem de decisão funcional do Fabrício, levantadas no confronto da entrega de 17-19/11/2026 com o Pacote Consolidado v1.0.
alwaysApply: false
---

# Perguntas para o Fabrício — rodada de 19/11/2026

Cada pergunta abaixo **trava uma decisão que não é técnica**. Onde havia escolha de implementação,
a equipe decidiu e registrou; o que está aqui é o que depende da regra de negócio, do risco
operacional ou da prioridade — e por isso não foi decidido unilateralmente.

Formato: **o que está pronto** · **por que a pergunta existe** · **o que muda conforme a resposta**.

---

## Bloco 1 — Ativação: o que ligar, quando e para quem

### P1. Podemos liberar "um Chamado com várias OS" para toda a operação de uma vez? (BL 001)

- **Pronto:** a separação Chamado × OS está no banco, testada. A tela de abertura de OS adicional
  existe. Há um procedimento auditado de abertura e de retorno.
- **Por que a pergunta:** a trava é **única e global**. Não dá para ligar só no Guainumbi: no
  momento em que ela abre, qualquer Chamado do sistema passa a aceitar OS adicional. Fechar de
  volta impede **novas** OS adicionais, mas as já criadas permanecem (e é assim que deve ser).
- **Muda conforme a resposta:** (a) ligar agora para todos; (b) ligar em janela combinada, com um
  Cliente em observação e um responsável acompanhando; (c) esperar a sua validação de tela antes.
- **Recomendação da equipe:** (b).

### P2. Quem recebe a permissão de abrir OS no Auvo "na mão"? (BL 004)

- **Pronto:** a criação manual virou **contingência auditada** — exige permissão específica, pede
  **motivo obrigatório** e registra quem fez (pessoa real, não "sistema").
- **Por que a pergunta:** a permissão nasce concedida a **ninguém**. Enquanto não for concedida,
  o botão "Abrir no Auvo" recusa — correto por desenho (o caminho normal é confirmação + T−24),
  mas significa que ninguém abre OS manual até você decidir.
- **Muda conforme a resposta:** a lista de quem recebe. Sugestão da equipe: só o Gestor PCM, e não
  o Operador — se a contingência for ampla, ela deixa de ser contingência e vira o caminho normal
  de novo, que é o problema que o pacote mandou resolver.

### P3. Qual perfil valida e finaliza OS? (BL 005, BL 007)

- **Pronto:** finalizar uma OS passou a exigir a capacidade de **validação**. As sete capacidades
  sensíveis do pacote (planejar, validar, aprovar, cancelar, exportar, ver custo, administrar)
  existem e são concedíveis por perfil ou por pessoa.
- **Por que a pergunta:** o mecanismo está pronto, **a política não**. Ninguém definiu quais
  capacidades cada um dos grupos do seu pacote (Administrador, Gestor de Engenharia/PCM, Operador
  PCM, Inspetor/Engenharia, Financeiro, Comercial, Cliente) recebe de fato.
- **Muda conforme a resposta:** a matriz inteira de quem faz o quê. É o insumo que falta para a
  entrega de BL 005 sair de "mecanismo pronto" para "em uso".
- **Pergunta específica dentro desta:** hoje, quem tem o perfil de validação **herda** a validação
  por perfil, sem precisar de concessão individual. As outras seis capacidades sensíveis exigem
  concessão pessoa a pessoa. Validar deve continuar no grupo mais frouxo, ou deve passar a exigir
  concessão individual como as outras?

---

## Bloco 2 — Regras que o pacote não fecha

### P4. Quantas horas tem a jornada, e de quem? (BL 009)

- **Pronto:** o enquadramento do deslocamento está implementado exatamente como você escreveu —
  residência↔cliente **não computa** (inclusive com veículo da empresa em casa); escritório↔cliente,
  cliente↔cliente e retirada a serviço **computam**. O sistema soma o computável e o não computável
  e mostra os dois.
- **Por que a pergunta:** sua regra diz *"o sistema calcula tempo computável e eventual
  **excedente a validar**"*. Excedente **em relação a quê**? Não existe jornada contratada
  cadastrada em lugar nenhum do sistema. A equipe se recusou a inventar um número — seria criar
  regra de negócio sem aprovação.
- **Muda conforme a resposta:** (a) jornada fixa igual para todos (quantas horas?); (b) jornada por
  técnico, vinda do cadastro do funcionário; (c) por contrato de cliente; (d) não calcular
  excedente nesta fase, só mostrar o total.

### P5. Quem passa a alimentar a Agenda do Técnico? (BL 003)

- **Pronto:** o diagnóstico que você pediu. A causa da evidência que você levantou ("Agenda do
  Técnico sem alocações na mesma semana com dezenas de Chamados") está nomeada: **a Agenda é um
  cadastro próprio, não uma projeção da Visita**. Ninguém escreve nela a partir de Visita ou OS —
  por isso ela aparece vazia.
- **Por que a pergunta:** seu pacote é explícito: *"Agenda por técnico e calendário por cliente são
  projeções das mesmas Visitas, não cadastros paralelos"*. Fazer a Agenda virar projeção significa
  **aposentar o cadastro manual atual**. E existe dado lá dentro hoje.
- **Muda conforme a resposta:** (a) Agenda passa a ser só leitura, derivada da Visita, e o que foi
  lançado à mão é migrado; (b) o manual continua existindo em paralelo durante uma transição —
  e aí precisamos saber por quanto tempo e qual prevalece em caso de divergência; (c) o manual é
  descartado sem migração.
- **Observação:** enquanto isso não for decidido, a evidência que você levantou **continua
  reproduzível** — é o único item da sua lista original que segue exatamente como estava.

---

## Bloco 3 — Prioridade da próxima rodada

### P6. A navegação por função entra agora? (BL 013)

- **Pronto:** nada. A spec e o plano estão escritos; nenhuma tarefa foi executada.
- **Por que a pergunta:** é o maior buraco da entrega, e ele **segura outros três itens do seu
  pacote**: Assessment virar Inspeção "Diagnóstico Inicial do Cliente", PMOC virar modalidade do
  Plano, e a área única "Materiais e Aquisições". Nenhum desses três sai sem a reorganização do
  menu.
- **Muda conforme a resposta:** se entra agora, é a próxima rodada inteira (é uma reorganização de
  menu que toca todas as telas, com risco de esconder uma ação que alguém usa hoje — por isso o
  plano prevê inventário antes e depois). Se não entra, vale dizer agora, porque as três
  consequências acima ficam paradas junto.

### P7. Precisamos de um monitor de exceções do Auvo? (BL 004 AC-11)

- **Pronto:** a contingência manual tem registro consolidado.
- **Por que a pergunta:** seu AC pede monitor de exceções. Hoje **não existe em lugar nenhum do
  sistema** uma consulta que junte: Visita não confirmada que deixou de gerar tarefa, falha de
  envio ao Auvo, e tarefa órfã. Cada uma dessas informações existe separada; ninguém as reúne.
  Esse achado é novo — não estava no diagnóstico de 13/11.
- **Muda conforme a resposta:** se é P1, vira story própria. Se é "só quando acontecer", a equipe
  mantém como está e documenta onde olhar manualmente.

### P8. A API de domínio deve expor aprovar/rejeitar levantamento já na v1? (BL 014)

- **Pronto:** a API existe, autenticada e versionada, com duas ações: criar lote em staging e
  consultar prévia. Nenhuma interface externa escreve no cadastro oficial, como você determinou.
- **Por que a pergunta:** aprovar e rejeitar ficaram **fora** da v1 de propósito: a função que faz
  isso está sem permissão e com duas travas fechadas desde que foi escrita, e nunca passou por
  revisão de uso real. Expor uma capacidade adormecida e não revisada através de uma API nova é
  trocar a ordem do seu próprio pacote ("construir API de domínio **antes** do MCP", e MCP
  "primeira entrega em leitura").
- **Muda conforme a resposta:** se aprovar/rejeitar entram agora, precisam de revisão de segurança
  própria antes. Se ficam para v2, a API segue como está e o MCP continua só-leitura.

---

## Bloco 4 — Confirmações rápidas (sim/não)

| # | Pergunta | Por quê |
|---|---|---|
| P9 | O fator **1,5** continua significando preço = **150% do custo** (markup de 50%)? | Está implementado assim. É uma das duas regras numéricas que seu pacote mandou conferir na homologação |
| P10 | Os tributos devem continuar **configuráveis na aplicação** (não fixos no código)? | Idem — segunda regra numérica a conferir |
| P11 | Confirma que **não** haverá área do técnico no SSO nesta fase? | Nada foi construído nessa direção; a confirmação evita que alguém "descubra" o tema de novo daqui a dois meses |
| P12 | Confirma que Estrutura Técnica, Relatórios/Área do Cliente e Cockpit seguem **em validação**, sem implementação? | Nada foi implementado. A confirmação fecha o ciclo do que ficou parado de propósito |

---

## O que a equipe decidiu sozinha (para você conferir, não decidir)

Registrado aqui porque são escolhas visíveis que você pode querer reverter:

1. **"Campo a conciliar" não aceita arrastar.** É fila de entrada; sair dela é decisão de triagem,
   não mudança de status. Arrastar fingiria um caminho que não existe.
2. **Retorno do Auvo "Finalizada" cai em Validação PCM, não em Finalizado.** É o que seu pacote
   manda, mas muda o que o operador vê no dia seguinte à publicação.
3. **"Corretiva" deixou de ser coluna do Kanban.** Era `categoria`, nunca foi etapa — nenhum dado
   se perdeu.
4. **O enquadramento do deslocamento não é editável.** É sempre derivado de origem e destino, por
   construção. Quem quiser mudar o enquadramento tem de mudar origem ou destino.
5. **Só a entrada em "Finalizado" ganhou trava de permissão.** As demais transições do Kanban
   seguem livres — travar todas sem inventariar quem as usa hoje arriscava quebrar caminho
   legítimo.
