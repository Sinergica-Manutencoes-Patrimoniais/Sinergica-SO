---
name: spec-E04-S07-robustez-lancamentos
description: Contrato — robustez operacional do caixa: comprovantes anexados ao lançamento, estorno/correção auditável e transferência entre contas. Prepara o Financeiro para uso real.
alwaysApply: true
tier: pequeno
---

# Spec — Robustez operacional dos lançamentos

> **Fonte da verdade.** Status: aprovado. Depende de **E04-S01** (fundação).
> Origem: pedido do Lucas (2026-07-20) — deixar o Financeiro apto para usar com clientes de verdade.
> Cobre lacunas de operação diária que o V1 (S01) não tratou.

## Resumo
Três reforços para o Financeiro aguentar o dia a dia real: **anexar comprovantes** a um lançamento,
**estornar/corrigir** lançamento e baixa de forma auditável, e registrar **transferência entre contas
bancárias** sem inflar entradas/saídas.

## Contexto atual (AS-IS)
- `financeiro.lancamentos` (E04-S01, design.md:74-90): ciclo `previsto→realizado`, `conciliado`
  derivado. Regra: lançamento conciliado não pode ser excluído/alterado (design.md:92-94).
- `financeiro.contas_bancarias` com saldo derivado. Buckets privados + signed URL já são padrão do
  projeto (`inspecoes-midia` etc.).

## Critérios de aceite

### AC-1: Comprovante anexado ao lançamento
- **Dado** um lançamento
- **Quando** o usuário (módulo `financeiro`, escrita) anexa um comprovante (PDF/imagem)
- **Então** o arquivo sobe a um bucket privado novo (`financeiro-comprovantes`), a referência é
  gravada no lançamento e o acesso é por signed URL; valida tipo/tamanho.

### AC-2: Estorno/correção auditável
- **Dado** um lançamento `realizado` (não conciliado)
- **Quando** o usuário o estorna ou corrige valor/categoria/data
- **Então** a mudança é registrada de forma auditável (append-only: quem/quando/de→para) e o saldo da
  conta recalcula. Lançamento **conciliado** exige desfazer a conciliação antes (regra de S01).

### AC-3: Transferência entre contas
- **Dado** duas contas bancárias
- **Quando** o usuário registra uma transferência (origem, destino, valor, data)
- **Então** o sistema move o saldo entre as contas **sem** contar como entrada nem saída no resultado
  (é movimentação interna), rastreável como par vinculado.

### AC-4: Estorno de baixa
- **Dado** um recebível/pagável baixado por engano
- **Quando** o usuário estorna a baixa
- **Então** o item volta a `previsto`, o lançamento realizado é revertido (auditável), e o aging
  recalcula.

## Casos de borda e erros
- Anexo inválido → rejeita antes do upload.
- Estornar lançamento conciliado → bloqueado até desfazer conciliação.
- Transferência com origem=destino → rejeita.

## Fora de escopo (vinculante)
- Aprovação/workflow de lançamento (sem alçada no V1).
- Multi-moeda.

## Rastreabilidade
- Migration: bucket `financeiro-comprovantes` + coluna de anexo em `financeiro.lancamentos` +
  tabela de eventos append-only (estorno/correção) + par de transferência
- `apps/web/src/features/financeiro/` (telas Lançamentos/Contas — substituem os mocks
  `LancamentosMock.tsx`/`ContasBancariasMock.tsx`)
- Storage: padrão signed URL do projeto
