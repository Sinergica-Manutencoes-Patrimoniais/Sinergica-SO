---
name: spec
description: Contrato — unidades físicas individuais de ferramenta (código próprio), histórico append-only de posse e correção do modelo de alocação (hoje agregado/sobrescrito pelo sync Auvo).
alwaysApply: true
---

# Spec — E01-S63 · Ferramentas: unidades individuais + histórico de posse

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio
> Origem: feedback do Fabrício testando o PCM (2026-07-13) — "queria ver um histórico de quem
> ficou com cada ferramenta e atribuição ser por código, para saber exatamente quem está e quem
> ficou cada ferramenta". Decisões do PO (Lucas, 2026-07-13, ver perguntas respondidas nesta
> sessão): **PCM gera e controla o código de unidade** (não existe patrimônio físico prévio);
> **PCM é dono da posse/histórico** (Auvo vira sinal de conferência, não sobrescreve).

## Problema com o modelo atual
`pcm.ferramenta_alocacoes` (migration `0033`) é um **snapshot agregado por tipo**: 1 linha por
`(ferramenta_id, auvo_user_id)`, `quantidade` inteira, sobrescrita a cada pull do Auvo
(`pcm.fn_reconcile_ferramenta_alocacoes`, chamada pelo cron 6h de `employeesStock`). Não existe
conceito de unidade física individual (o Auvo também não tem — `GET /products` só devolve
`totalStock`/`employeesStock` agregados, confirmado na API real em 2026-07-13). Duas perguntas do
Fabrício são impossíveis de responder hoje: "quem está com a furadeira #3?" e "quem ficou com ela
mês passado?" — o registro de ontem já foi sobrescrito pelo sync de hoje.

## Resumo
`pcm.ferramenta_unidades`: 1 linha por unidade física de uma ferramenta (`ferramenta_id` +
código sequencial gerado pelo PCM, ex. `FER-0001`). `pcm.ferramenta_movimentacoes`: log
append-only (nunca UPDATE/DELETE) de toda atribuição/devolução por unidade — a fonte do
histórico. O agregado do Auvo (`employeesStock`) passa a ser só um **alerta de divergência**
(ex.: "Auvo diz 3 com o técnico X, PCM tem 2 unidades atribuídas a ele") exibido na tela, nunca
mais grava por cima do histórico do PCM.

## Critérios de aceite

### AC-1: Código de unidade
- **Dado** um usuário com `pcm='escrita'` cadastrando quantidade de uma ferramenta
- **Quando** confirma
- **Então** o sistema cria N linhas em `ferramenta_unidades` (uma por unidade), cada uma com
  código sequencial próprio (`FER-0001`, `FER-0002`, ...) — sequência global, nunca reaproveitada
  mesmo se uma unidade for desativada

### AC-2: Atribuição por unidade
- **Dado** unidades disponíveis (sem atribuição ativa) de uma ferramenta
- **Quando** o usuário atribui uma unidade específica (por código) a um funcionário, com data de
  início
- **Então** grava 1 linha em `ferramenta_movimentacoes` (tipo `atribuicao`), a unidade passa a
  mostrar "com Fulano desde DD/MM"; uma unidade só pode ter 1 atribuição ativa por vez

### AC-3: Devolução
- **Dado** uma unidade atribuída
- **Quando** o usuário registra devolução (data, condição opcional: ok/danificada/perdida)
- **Então** grava movimentação `devolucao`, a unidade volta a "disponível" (ou "baixada" se
  perdida/danificada — ver AC-6)

### AC-4: Histórico por unidade
- **Dado** uma unidade com movimentações
- **Quando** o usuário abre o detalhe dela
- **Então** vê a linha do tempo completa (quem, quando, tipo de movimento), nunca apagada

### AC-5: Histórico por funcionário
- **Dado** um funcionário
- **Quando** o usuário abre "ferramentas com [funcionário]" (tela existente
  `FerramentasPorTecnicoPage`, reformulada)
- **Então** vê as unidades atualmente com ele + histórico do que já teve

### AC-6: Baixa de unidade
- **Dado** uma unidade extraviada/danificada irreparável
- **Quando** o usuário dá baixa (motivo obrigatório)
- **Então** ela sai do disponível permanentemente, mas mantém código e histórico visível
  (nunca deletada — é ativo patrimonial, mesmo padrão soft-delete do resto do repo)

### AC-7: Divergência Auvo como alerta, não sobrescrita
- **Dado** o pull do Auvo trazendo `employeesStock` de uma ferramenta
- **Quando** o total do Auvo por técnico diverge da contagem de unidades atribuídas no PCM
- **Então** a tela mostra um badge de divergência (não altera nada automaticamente); `pcm.fn_reconcile_ferramenta_alocacoes`
  passa a só atualizar uma coluna de "visão Auvo" separada, nunca `ferramenta_movimentacoes`

## Fora de escopo
> Vinculante.
- Reserva futura por data/período — **E01-S64**.
- Cadastro rico + imagem — **E01-S65**.
- Kits — **E01-S66**.
- Leitor de código de barras/QR físico (código é texto digitado/copiado no V1).

## Rastreabilidade
- Origem: feedback Fabrício 2026-07-13 + decisões do PO (código gerado pelo PCM; PCM dono da posse).
- Migration atual: `0033_E01-S30_ferramentas.sql` (`pcm.ferramentas`,
  `pcm.ferramenta_alocacoes` — esta última é substituída em uso, mantida só como "visão Auvo").
- Arquivos-âncora: `apps/web/src/features/pcm/domain/ferramentas.ts`,
  `pages/FerramentasPage.tsx`, `pages/FerramentasPorTecnicoPage.tsx`,
  `infrastructure/supabase-ferramentas-adapter.ts`, `supabase/migrations/` (próximo número,
  seguinte a `0083`), `supabase/functions/_shared/auvo/registry/ferramentas.ts`
  (`fn_reconcile_ferramenta_alocacoes` já existente, migration `0033`).
