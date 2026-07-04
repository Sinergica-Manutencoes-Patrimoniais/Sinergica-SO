---
name: spec-E01-S18-abertura-manual-os-pcm
description: Contrato da abertura manual de OS no PCM, inspirada na tela legada e enriquecida com campos inteligentes.
alwaysApply: false
---

# Spec — E01-S18 Abertura Manual de OS no PCM

> Status: aprovado para implementação nesta sessão (2026-07-04). Tier: Pequeno.
> Sem migration nova: usa `pcm.clientes`, `pcm.ordens_servico` e `pcm.tecnicos_cache`.

## Resumo
O dashboard PCM ganha uma ação "Nova OS" que abre uma tela/modal de abertura manual de chamado,
inspirada no PCM antigo, com campos selecionáveis e inteligência operacional: categoria, tipo de
tarefa Auvo sugerido pela categoria, prioridade sugerida pelo GUT, origem, técnico responsável,
localização e data prevista.

## Critérios de aceite

### AC-1: Usuário com escrita PCM consegue abrir o formulário
- **Dado** um usuário com `podeAcessar('pcm','escrita')`
- **Quando** ele está no dashboard PCM
- **Então** há uma ação "Nova OS" que abre o formulário; usuário sem escrita não vê a ação.

### AC-2: Formulário carrega clientes e técnicos selecionáveis
- **Dado** clientes ativos e técnicos ativos no banco
- **Quando** o formulário abre
- **Então** cliente é obrigatório e vem de `pcm.clientes`; técnico é opcional e vem de
  `pcm.tecnicos_cache`, com opção "Sem técnico".

### AC-3: Campos inteligentes sugerem prioridade e tipo Auvo
- **Dado** o usuário altera categoria ou fatores GUT
- **Quando** o formulário recalcula
- **Então** o tipo Auvo sugerido acompanha a categoria e a prioridade sugerida acompanha o score GUT,
  mas o usuário pode sobrescrever a prioridade.

### AC-4: Submissão cria OS em `solicitacao`
- **Dado** cliente, título e categoria preenchidos
- **Quando** o usuário salva
- **Então** uma linha em `pcm.ordens_servico` é criada com `status='solicitacao'`, `origem` escolhida,
  `numero` `CH-XXX`, GUT, localização, solicitante e descrição.

### AC-5: Erro de criação é visível e não fecha o formulário
- **Dado** a inserção falha
- **Quando** o usuário tenta salvar
- **Então** o formulário mostra erro neutro e mantém os campos preenchidos.

## Fora de escopo
- Despachar imediatamente para Auvo.
- Vincular técnico ao Auvo task nesta tela.
- Upload de anexos/fotos.
- Fluxo de orçamento (E01-S14).
