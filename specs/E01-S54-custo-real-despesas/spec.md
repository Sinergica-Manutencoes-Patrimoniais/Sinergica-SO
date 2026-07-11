---
name: spec
description: Contrato — espelho de despesas (/expenses + /expensetypes) e custo real por OS/cliente (dor L2 rentabilidade).
alwaysApply: true
---

# Spec — Custo real da OS: despesas do Auvo no PCM

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Origem: `docs/AUDITORIA-AUVO-API.md`. A API expõe `/expenses` (CRUD + anexos de comprovante) e
> `/expensetypes`; o menu Financeiro/Despesas existe na conta. Hoje o PCM não vê nenhum custo —
> dor L2 do ESCOPO-MESTRE ("não sei se o contrato dá lucro") não tem nem o primeiro insumo.

## Resumo
Dois espelhos novos no motor de sync (`pcm.despesa_tipos`, `pcm.despesas`) + custo agregado por
OS e por cliente/mês. Quando a despesa referencia uma tarefa, liga na OS; a OS mostra "custo
registrado" (despesas + horas de check-in/out valoradas depois — valoração de MO fica fora). É o
primeiro tijolo da rentabilidade por contrato (§6.5), sem inventar o módulo Financeiro inteiro.

## Critérios de aceite

### AC-1: Espelho de tipos e despesas
- **Dado** o pull rodando
- **Quando** sincroniza
- **Então** `pcm.despesa_tipos` e `pcm.despesas` refletem o Auvo (idempotente por `auvo_id`),
  despesa ligada a `pcm.funcionarios` e, quando houver referência de tarefa, à OS

### AC-2: Custo na OS
- **Dado** uma OS com despesas vinculadas
- **Quando** aberta (painel/tooltip)
- **Então** mostra a soma e a lista das despesas (tipo, valor, data, técnico)

### AC-3: Custo por cliente
- **Dado** o cliente-360
- **Quando** aba Financeiro carrega
- **Então** inclui despesas por mês (12 meses) ao lado do proxy operacional existente (E01-S51)

### AC-4: Sem write
- **Dado** o descriptor novo
- **Quando** registrado
- **Então** `writeEnabled:false` (lançar despesa continua no app do técnico; escrita só via E01-S47)

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Valorar mão de obra (R$/hora por técnico) e margem por contrato — Fase 3 (§6.5).
- Contas a pagar/receber, conciliação, `/receivables`/`/invoices` (decisão: Financeiro Auvo descartado).
- Km rodado (sem endpoint público; proxy GPS é E01-S52).

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · ESCOPO-MESTRE §2.1 L2, §6.5.
- Contrato API: `GET /expenses`, `GET /expensetypes` — **verificar payload real com credencial antes
  da migration** (campo de vínculo com tarefa não confirmado).
- Arquivos-âncora: `supabase/functions/_shared/auvo/registry/` (2 descriptors novos),
  `apps/web/src/features/pcm/` (OS painel + cliente-360 aba Financeiro).
