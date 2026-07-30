---
name: spec-E01-S96-fix-erro-generico-import-xls
description: Contrato — propagar o detail real do erro da Edge Function no import de XLS de Inspeção.
alwaysApply: true
tier: trivial
---

# Spec — Fix: erro genérico no import de XLS de Inspeção

> **Fonte da verdade.** Status: aprovado
> Origem: apontamento de Lucas (2026-07-24), `docs/Apontamentos/Apontamentos-Fabricio-Aline.md`.
> Ao importar o XLS padrão do Auvo na tela de Inspeções, a subida falha com "Edge Function returned
> a non-2xx status code" — mensagem genérica do `supabase-js`, sem o motivo real.

## Resumo
`supabaseQualidadeAdapter.processarRelatorioInspecao` (`supabase-qualidade-adapter.ts:561`) chama
`supabase.functions.invoke("importar-relatorio-pdf", ...)` e, em erro, faz `throw error` direto —
perde o `detail` real do corpo `problem+json` que a Edge Function já devolve (ex.: `"OpenRouter
respondeu 429"`, `"OPENROUTER_API_KEY ausente"`, `"Input inválido"` — ver
`supabase/functions/importar-relatorio-pdf/index.ts:46-51`). O `supabase-js` só expõe
`error.message` genérico; o corpo de verdade fica em `error.context` (a `Response` bruta).

Mesmo bug já apareceu e foi corrigido em `financeiro` (E04-S09, função `erroDetalhado` em
`supabase-financeiro-adapter.ts:103-114`, sinalizada em `docs/STATE.md` como "candidato a extrair
pra um lugar compartilhado se mais Edge Functions passarem a devolver erro estruturado" — este é
esse segundo caso). Esta story extrai o helper para `apps/web/src/lib/http/` e usa no adapter de
qualidade.

## Critérios de aceite

### AC-1: Mensagem real chega na UI
- **Dado** a Edge Function `importar-relatorio-pdf` responde não-2xx com corpo
  `{ type, status, detail }`
- **Quando** o import falha na tela de Inspeções
- **Então** a mensagem exibida ao usuário é o `detail` do corpo (não o texto genérico do SDK).

### AC-2: Corpo não-JSON não quebra o fluxo
- **Dado** a Edge Function falha sem corpo JSON válido (ex.: erro de rede/timeout da plataforma)
- **Quando** o erro é tratado
- **Então** cai de volta para a mensagem original do SDK, sem lançar exceção não tratada.

## Fora de escopo (vinculante)
- Investigar/corrigir a causa raiz de falhas reais da OpenRouter em produção (chave/quota/modelo) —
  isso é verificação operacional (logs de produção), não um bug de código; fica sinalizado para
  conferência do Lucas.
- Migrar `supabase-financeiro-adapter.ts` para o helper compartilhado (fora do relato original).

## Rastreabilidade
- `apps/web/src/lib/http/edge-function-error.ts` (novo, helper compartilhado)
- `apps/web/src/features/pcm/infrastructure/supabase-qualidade-adapter.ts` (`processarRelatorioInspecao`)
