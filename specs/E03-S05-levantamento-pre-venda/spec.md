---
name: spec
description: Contrato — levantamento de pré-venda reusando o Assessment do PCM, alimentando a proposta tipo levantamento.
alwaysApply: true
---

# Spec — E03-S05 · Levantamento de pré-venda

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Depende de **E03-S04** (proposta com `assessment_id`) e **E03-S01** (oportunidades).
> Decisão 6 do PO: **reusar o Assessment do PCM**, não construir coleta nova.

## Resumo
O levantamento comercial é um **Assessment do PCM com finalidade de pré-venda** sobre uma Conta em
funil — não uma entidade nova. Reusa questionário, itens, galeria de fotos e análise por IA que já
existem (E01-S90/S97/S98/S130). A proposta tipo `levantamento` referencia esse Assessment e importa
os sistemas encontrados como ponto de partida da composição.

`pcm.inspecoes` já tem `e_assessment boolean`, `motivo_assessment` e `client_id` apontando para a
Conta — o encaixe é por dado existente, sem tabela nova.

## Critérios de aceite

### AC-1: Levantamento nasce da oportunidade
- **Dado** uma oportunidade aberta com `comercial='escrita'`
- **Quando** o usuário pede "novo levantamento"
- **Então** é criado um Assessment (`pcm.inspecoes` com `e_assessment = true` e
  `motivo_assessment` indicando pré-venda) para a Conta daquela oportunidade, e a oportunidade
  passa a exibir o vínculo

### AC-2: Escrita no PCM só por interface publicada
- **Dado** que `pcm.inspecoes` pertence ao PCM (ADR-0019, R1)
- **Quando** o Comercial cria ou lê o levantamento
- **Então** usa **RPC/serviço publicado pelo PCM**, nunca `insert`/`select` direto na tabela — o
  Comercial é canal, não dono

### AC-3: Preencher reusa a tela do PCM
- **Dado** um levantamento criado
- **Quando** o técnico ou o comercial preenche em campo
- **Então** usa a **tela de Assessment que já existe**, com questionário, itens, fotos por item e
  análise por IA — nenhuma tela de coleta nova é construída nesta story

### AC-4: Proposta importa o levantamento
- **Dado** uma proposta tipo `levantamento` e um Assessment concluído da mesma Conta
- **Quando** o usuário vincula o Assessment à proposta
- **Então** `propostas.assessment_id` é preenchido e o editor oferece **importar** os sistemas/itens
  encontrados como linhas iniciais da composição — sempre **editáveis**, nunca travadas

### AC-5: Importar não sobrescreve trabalho
- **Dado** uma proposta que já tem itens
- **Quando** o usuário importa do Assessment
- **Então** os itens importados são **acrescentados**, com aviso de quantos entraram; nada do que
  já existia é apagado ou alterado

### AC-6: Levantamento incompleto não trava a proposta
- **Dado** um Assessment ainda em andamento (sem todos os itens)
- **Quando** vinculado à proposta
- **Então** a vinculação é permitida e a proposta indica que o levantamento está em andamento —
  o comercial pode trabalhar em paralelo com o campo

### AC-7: Levantamento aparece na Visão 360
- **Dado** uma Conta com levantamento de pré-venda
- **Quando** o usuário abre a aba Comercial da Visão 360
- **Então** o levantamento aparece junto da oportunidade, com link para o Assessment completo

## Casos de borda e erros
- **Conta sem oportunidade** → pode ter Assessment (é do PCM), mas o atalho "novo levantamento" só
  existe a partir de uma oportunidade.
- **Assessment de outra Conta** → não pode ser vinculado à proposta; a busca só oferece os da
  mesma Conta.
- **Assessment excluído/arquivado depois de vinculado** → a proposta mantém os itens importados
  (foram copiados) e mostra o vínculo como indisponível, sem quebrar.
- **Dois levantamentos na mesma Conta** → permitido; a proposta vincula um.
- **Levantamento sem nenhum item** → importar não faz nada e avisa; não é erro.

## Fora de escopo
- **Chat com IA para coletar o levantamento** (o blueprint prevê; a decisão 6 escolheu reusar o
  Assessment). Se a coleta conversacional fizer falta, vira story própria.
- **Geração do texto da proposta por LLM** — fora do V1 (mesmo non-goal da S04).
- **Alterar o Assessment do PCM** — esta story consome o que existe; melhoria no Assessment é
  story do E01.
- **Levantamento pelo portal do cliente.**

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (decisão 6) · ADR-0019 (R1/R2)
- Reuso: E01-S90 (assessment), E01-S97 (galeria de fotos), E01-S98 (análise IA), E01-S130
  (questionário live Auvo)
