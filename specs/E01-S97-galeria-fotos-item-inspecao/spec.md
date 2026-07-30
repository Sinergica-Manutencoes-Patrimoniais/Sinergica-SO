---
name: spec-E01-S97-galeria-fotos-item-inspecao
description: Contrato — exibir mais de uma foto no item de inspeção importado do XLS Auvo.
alwaysApply: true
tier: pequeno
---

# Spec — Galeria de fotos no item de inspeção importado

> **Fonte da verdade.** Status: aprovado
> Origem: Lucas, sessão 2026-07-24, ao revisar E01-S96 ("precisa exibir mais de uma foto se tiver").

## Resumo
Cada ocorrência do XLS do Auvo pode trazer várias fotos (URLs do S3 separadas por `;` na coluna
"Ocorrência"). A IA (`importar-relatorio-pdf`) já devolve todas em `fotoUrls: string[]`
(`ItemInspecaoImportado`), mas `criarInspecaoImportada` só grava a primeira
(`foto_url: fotos[0] ?? null`, `supabase-qualidade-adapter.ts:604`) e a tela só renderiza
`item.fotoUrl` (`InspecoesPage.tsx:712-714`). As demais fotos da ocorrência se perdem depois do
import. Esta story persiste a lista completa e exibe todas quando houver mais de uma — sem subir
nada pro Supabase Storage (mesma decisão já registrada em `0091_E01-S73`: mídia vinda de import
externo continua como URL, nunca vira upload).

## Critérios de aceite

### AC-1: Lista completa persistida
- **Dado** um item importado do XLS com N fotos (N ≥ 1)
- **Quando** a inspeção é criada
- **Então** `pcm.inspecao_itens.foto_urls` grava as N URLs (não só a primeira).

### AC-2: Galeria exibida quando há mais de uma foto
- **Dado** um item de inspeção com `fotoUrls.length > 1`
- **Quando** a tela renderiza o item
- **Então** todas as fotos aparecem como thumbnails clicáveis (abrem a URL original), não só a
  primeira.

### AC-3: Compatibilidade com item de 1 foto ou sem foto
- **Dado** um item com 0 ou 1 foto (import antigo, ou item criado manualmente com `fotoUrl` único)
- **Quando** a tela renderiza
- **Então** o comportamento visual não regride — 1 foto continua exibida normalmente, 0 fotos
  continua sem exibir nada.

## Fora de escopo (vinculante)
- Upload das fotos pro Supabase Storage (bucket `inspecoes-midia`) — continuam como URL externa do
  Auvo, mesma decisão de `0091_E01-S73`.
- Mudar o formulário manual de item (`fotoUrl` único) para aceitar múltiplas URLs — só o fluxo de
  import de XLS popula `foto_urls` nesta story.

## Rastreabilidade
- `supabase/migrations/0150_E01-S97_galeria_fotos_inspecao_itens.sql` (nova)
- `apps/web/src/features/pcm/application/qualidade-gateway.ts` (`InspecaoItem.fotoUrls`)
- `apps/web/src/features/pcm/infrastructure/supabase-qualidade-adapter.ts` (`mapItem`, `criarInspecaoImportada`)
- `apps/web/src/features/pcm/pages/InspecoesPage.tsx` (renderização do item)
