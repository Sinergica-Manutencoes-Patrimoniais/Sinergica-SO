---
name: spec
description: Contrato — Kits de ferramentas (conjunto nomeado de ferramentas atribuído/devolvido como uma unidade). Conceito PCM-only; Auvo não tem kit nativo.
alwaysApply: true
---

# Spec — E01-S66 · Kits de ferramentas

> **Fonte da verdade.** Status: pronto para implementar · Tier: pequeno
> **Depende de: E01-S63** (unidades individuais — um kit é composto de unidades existentes).
> Origem: feedback Fabrício 2026-07-13 — "criação de Kits e ferramentas contendo as ferramentas".

## Achado técnico
O Auvo não tem conceito de kit/bundle nos endpoints auditados (`/products` é item individual;
nenhum endpoint de agrupamento em `docs/AUDITORIA-AUVO-API.md`). Kit é **conceito só do PCM** —
não sincroniza com o Auvo como entidade própria; cada ferramenta dentro do kit continua sendo seu
próprio `product` no Auvo (via `pcm.ferramentas`/descriptor existente), o kit só agrupa
referências para agilizar atribuição em lote.

## Resumo
`pcm.kits` (nome, descrição) + `pcm.kit_itens` (kit → ferramenta, quantidade esperada). Atribuir
um kit a um técnico atribui automaticamente uma unidade disponível de cada ferramenta do kit
(reaproveita `ferramenta_movimentacoes` da S63, cada unidade fica marcada com o `kit_atribuicao_id`
que as agrupou); devolver o kit devolve todas de uma vez.

## Critérios de aceite

### AC-1: Cadastro de kit
- **Dado** um usuário com `pcm='escrita'`
- **Quando** cria um kit com nome e uma lista de (ferramenta, quantidade)
- **Então** o kit aparece na lista de Kits, com indicador de "completo agora" (há unidades
  disponíveis suficientes de cada item) ou "incompleto" (falta estoque de algum item)

### AC-2: Atribuir kit
- **Dado** um kit completo
- **Quando** o usuário atribui o kit a um funcionário
- **Então** cada item do kit recebe uma atribuição de unidade (S63 AC-2), todas linkadas por um
  `kit_atribuicao_id` comum; se faltar unidade de algum item, a operação inteira falha (tudo ou
  nada — não atribui kit pela metade) com mensagem dizendo qual item faltou

### AC-3: Devolver kit
- **Dado** um kit atribuído (todas as unidades do mesmo `kit_atribuicao_id` ainda com o mesmo
  funcionário)
- **Quando** o usuário devolve o kit
- **Então** todas as unidades do grupo são devolvidas numa operação só (S63 AC-3 em lote)

### AC-4: Kit parcialmente devolvido
- **Dado** um kit atribuído onde 1 unidade foi devolvida/baixada individualmente (fora do fluxo
  de kit — ex.: ferramenta quebrou e foi baixada isolada)
- **Quando** o usuário olha o kit atribuído
- **Então** o sistema mostra "kit incompleto com o técnico" (não trava nada, é informativo — o
  histórico de cada unidade continua sendo a fonte de verdade)

### AC-5: Editar composição do kit
- **Dado** um kit existente
- **Quando** o usuário adiciona/remove um tipo de ferramenta do kit
- **Então** a mudança vale só para futuras atribuições — atribuições já feitas mantêm a
  composição de quando foram atribuídas (não retroage)

## Fora de escopo
> Vinculante.
- Kit como entidade sincronizada no Auvo (não existe endpoint — ver achado técnico).
- Reserva de kit inteiro (E01-S64 trata unidade a unidade; combinar os dois é evolução futura).
- Kit com quantidade variável por atribuição (V1: quantidade fixa por item, definida no cadastro).

## Rastreabilidade
- Origem: feedback Fabrício 2026-07-13.
- Depende de: `pcm.ferramenta_unidades`/`ferramenta_movimentacoes` (E01-S63).
- Arquivos-âncora: migration nova (`pcm.kits`, `pcm.kit_itens`, coluna `kit_atribuicao_id` em
  `ferramenta_movimentacoes`), `domain/kits.ts`, `pages/KitsPage.tsx` (nova).
