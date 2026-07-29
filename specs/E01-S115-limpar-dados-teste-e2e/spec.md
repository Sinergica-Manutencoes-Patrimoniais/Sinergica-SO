---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Limpar dados de teste E2E do banco

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas (2026-07-29). Item 9 — retoma o item 5 da lista original da reunião
> (2026-07-27: "Excluir os dados de E2E sempre depois dos testes").

## Contexto
Não existe Postgres local neste projeto (sem Docker no ambiente de desenvolvimento) — os testes
Playwright/E2E rodam contra o Supabase **linked** (o mesmo de produção/staging usado pelo app).
Isso deixa dados de teste acumulados no banco real (ex.: `apps/web/e2e/ordens-servico.spec.ts` cria
títulos como `` `[TESTE E2E] OS ${Date.now()}` ``). Esta story é uma ação de **limpeza de dados**,
não de código — cuidado redobrado por ser uma exclusão em banco compartilhado.

## Resumo
Identificar e remover registros de teste E2E acumulados no banco, e (separado) garantir que rodadas
futuras de E2E se auto-limpem ao final (teardown), sem depender de faxina manual recorrente.

## Critérios de aceite

### AC-1: Inventário antes de excluir
- **Dado** o banco linked
- **Quando** a limpeza é preparada
- **Então** existe uma lista (query de leitura, sem `DELETE`) de tudo que parece dado de teste
  (busca por marcadores conhecidos: `[TESTE E2E]`, nomes de cliente/título usados nos specs de
  `apps/web/e2e/*.spec.ts`) — revisada pelo Lucas antes de qualquer exclusão.

### AC-2: Exclusão só do que foi confirmado
- **Dado** a lista de AC-1 aprovada
- **Quando** a exclusão roda
- **Então** remove exatamente os registros listados — nunca um `DELETE` amplo por padrão de nome
  sem revisão prévia линha a linha (ou por lote claramente identificado).

### AC-3: Teardown automático nos specs E2E daqui pra frente
- **Dado** um spec Playwright que cria dado real no banco linked
- **Quando** o teste termina (sucesso ou falha)
- **Então** um hook de teardown remove o que aquele teste criou — não depende de faxina manual
  recorrente no futuro.

## Casos de borda e erros
- Registro de teste antigo que já virou dado real usado por outro fluxo (raro, mas possível se
  alguém interagiu manualmente com um registro de teste) → sinalizar, não excluir automaticamente
  se houver dúvida.

## Fora de escopo
- Criar um Supabase local/staging separado pra rodar E2E sem tocar produção — mudança de
  infraestrutura maior, não cabe nesta story (mas resolveria a causa raiz; registrar como ideia
  futura).

## Rastreabilidade
- Código: `apps/web/e2e/*.spec.ts` (todos os specs que criam dado real).
- ADRs relacionados: —
