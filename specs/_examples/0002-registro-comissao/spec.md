---
name: spec
description: Contrato do registro de comissão (exemplo de referência das camadas com I/O). Base enquanto ativa.
alwaysApply: true
---

# Spec — Registro de comissão de venda

> **Fonte da verdade.** Status: implementado · **Tier: pequeno** (porta + adapter é padrão
> estabelecido, não decisão difícil de reverter → não exige `design.md`; ver `ANTI-PADROES.md`).
> Este é o **exemplo de referência das camadas com I/O**: porta no domínio
> (`repositorio-comissao.ts`), adapters em `infrastructure/`, caso de uso em `application/`,
> borda em `interfaces/http/`, teste de integração e migration em `db/`.

## Resumo
Recebida uma venda (id + valor), o sistema calcula a comissão (reaproveitando a feature 0001) e
**persiste** o resultado. Se a venda já tem comissão registrada, retorna a existente — não duplica.

## Critérios de aceite

### AC-1: registrar comissão de venda válida persiste e retorna o registro
- **Dado** uma venda nova (`vendaId` ainda sem registro) de R$ 2.000,00 e a tabela vigente (5% ≥ R$ 1.000)
- **Quando** registro a comissão dessa venda
- **Então** persiste e retorna o registro (id, `comissaoCentavos` = 10000, `criadoEm`) com status 201 e `jaExistia = false`

### AC-2: valor de venda inválido é rejeitado na borda
- **Dado** uma requisição com `valorVendaReais` negativo
- **Quando** chamo a borda HTTP
- **Então** responde **422** em `application/problem+json` (com `reqId`), sem persistir nada

### AC-3: registrar a mesma venda duas vezes é idempotente
- **Dado** uma venda que já tem comissão registrada
- **Quando** registro a comissão da mesma `vendaId` de novo (mesmo com outro valor)
- **Então** retorna o registro **existente** (mesmo id e valor original), status 200 e `jaExistia = true` — não cria duplicata

## Casos de borda e erros
- `vendaId` vazio → rejeitado na borda (422), igual a AC-2.
- Valor de domínio inválido que passe pela borda (ex.: fração) → `ErroValidacao` vira 422.
- Erro inesperado de infraestrutura → 500 `problem+json` "Erro interno" (sem vazar stack).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Recalcular/atualizar comissão já registrada quando a tabela muda.
- Estorno, ajuste manual, relatório de fechamento, UI.
- Autenticação/autorização da borda (delegada ao template de Edge Function — `supabase/functions/_template/`).

## Rastreabilidade
- Product: `./product.md` · Tasks: `./tasks.md` · Domínio reaproveitado: `../0001-calculo-comissao/domain.md`
- Código: porta `src/domain/comissao/registro-comissao.ts`; adapters
  `src/infrastructure/comissao/`; caso de uso `src/application/registrar-comissao.ts`;
  borda `src/interfaces/http/registrar-comissao.ts`; migration `db/migrations/0001_comissoes.sql`.
- ADRs relacionados: [ADR-0001 — Dinheiro em centavos](../../../docs/adr/0001-dinheiro-em-centavos.md)
