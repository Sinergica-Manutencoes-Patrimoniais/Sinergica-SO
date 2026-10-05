---
name: design-E01-S162
description: Consulta operacional de um Sistema em drawer compartilhado entre a lista global e a Visão 360.
alwaysApply: true
---

# Design — Detalhe operacional do Sistema

> Decisão arquitetural registrada em
> [`ADR-0024`](../../docs/adr/0024-read-model-detalhe-operacional-sistema.md).

## Decisão

`DrawerDetalheSistema` é uma única superfície de consulta, aberta tanto pela lista global de
Sistemas quanto pela aba Sistemas da Visão 360. Ele recebe a identidade do Sistema e o cliente
esperado quando esse contexto já for conhecido. A tela que o abre conserva o elemento acionador;
ao fechar por botão, fundo ou Escape, o foco volta para ele.

O drawer não contém comandos de alteração. Editar e compor continuam nos controles atuais. A
leitura só é montada para quem tem `pcm:leitura`; `pcm:escrita` não cria ações extras no drawer.

## Consulta agregada

O novo `DetalheSistemaGateway.obter` consulta tudo a partir do Sistema autorizado e de seus
**membros atuais**. A sequência é deliberadamente limitada pelo `cliente_id` do Sistema:

1. Sistema ativo, cliente e posição; se não existir, devolver `null`.
2. `sistema_itens` e Componentes ainda ativos do mesmo cliente; a lista de componentes é a
   composição atual, nunca uma reconstrução de composição passada.
3. OS do mesmo cliente cujo `sistema_id` é o Sistema, cujo `equipamento_id` é um membro atual ou
   cujo vínculo Auvo (`os_equipamentos_auvo`) aponta para o Auvo Equipment do Sistema ou dos
   membros. As fontes são reunidas por ID da OS e preservam todas as origens.
4. Planos preventivos do mesmo cliente cujo alvo é o Sistema ou um membro atual; ocorrências são
   selecionadas só pelos IDs desses planos e enriquecidas com OS, técnico e link remoto já
   persistido.

Nenhuma tabela filha é consultada com conjunto vazio. As consultas não fazem join implícito entre
clientes: `client_id`/`cliente_id` acompanha todas as listas; RLS continua sendo a barreira final.

## Regras de apresentação

- OS aberta: `status` diferente de `finalizado` e `cancelado`.
- Histórico: somente `finalizado` ou `cancelado`, em ordem de execução concluída (`check_out_at`)
  ou última atualização conhecida. A manutenção mais recente é exclusivamente a maior
  `check_out_at` de uma OS `finalizado`; agendamento e cancelamento nunca contam.
- Uma OS que chega por Sistema e por um ou mais Componentes é uma linha, com todas as origens
  legíveis. O link Auvo é formado apenas para `auvo_task_id` positivo.
- Preventivas usam os estados e resultados de E01-S53. Plano pausado continua exibindo as
  ocorrências passadas, mas não oferece "próximo vencimento" ativo.
- A posição de cada Componente é resolvida pela sua própria Área/Local, não herdada do Sistema.
- Dados ausentes usam `—`/`Não informado`; datas nunca são derivadas de outra data.

## Estado e falhas

O drawer possui query TanStack Query com chave incluindo Sistema e cliente esperado. Cadastro,
OS, preventivas e componentes são seções independentes no resultado: falha numa seção traz
"Tentar novamente" nela, sem esconder dados das outras. Um Sistema removido/desativado devolve
estado indisponível e fecha o contexto antigo. Trocar de cliente desmonta o painel da Visão 360
por chave do cliente e limpa a seleção antes de renderizar o novo cliente.

## Navegação

`onAbrirOs` é injetado pelo shell e pela Visão 360, reutilizando o deep-link existente para a
tela de OS. Não é feita mutação de dados. Links do Auvo abrem em nova aba com `noopener`.
Clique em um componente reaproveita `DrawerDetalheAtivo` já existente, sobre o drawer de Sistema.

## Testes e segurança

- Domínio: agrupar fontes, separar aberta/histórico, deduplicar e calcular última manutenção a
  partir de execução concluída.
- Adapter: cliente A não consulta/exibe OS, planos, ocorrências ou componentes de B; conjunto
  vazio não dispara query filha; link Auvo só existe com ID remoto conhecido.
- Componente: fechar restaura foco, estados de seção, links e composição atual.
- Integração de tela: lista global e 360 abrem o mesmo drawer; mudança do cliente elimina seleção.
- Regressão: origens de componentes são identificadas por ID, não por nome; um drawer de
  componente sobreposto consome Escape antes do drawer de Sistema.

Não há migration, deploy, chamada de escrita, criação de OS ou leitura remota do Auvo nesta story.
