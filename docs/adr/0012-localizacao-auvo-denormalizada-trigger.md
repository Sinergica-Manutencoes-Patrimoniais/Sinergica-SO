---
name: adr-0012-localizacao-auvo-denormalizada-trigger
description: ADR — localização enviada ao Auvo é uma coluna denormalizada (auvo_localizacao), recalculada por trigger no PCM, nunca por join em tempo de leitura no drain.
alwaysApply: false
---

# ADR-0012 — Localização Auvo denormalizada e recalculada por trigger

> **ADRs são imutáveis.** Não edite; se mudar de ideia, crie um novo que o substitua.

**Status:** Aceito
**Data:** 2026-07-21
**Decisores:** Claude (sessão Lucas), seguindo `specs/E01-S85-sync-ativos-localizacao-auvo/design.md`
**Relacionados:** ADR-0005 (outbox sync Auvo), ADR-0009 (hierarquia de localização/Sistema como Equipment), E01-S22/S23/S36, E01-S76, E01-S85

## Contexto
O Auvo não entende hierarquia — só um campo de texto plano (`location`). No PCM, a localização real
de um ativo é uma cadeia `Área → Local → Sublocal` (`pcm.areas`/`pcm.locais`, árvore via
`parent_id`, E01-S76). O motor de sync genérico (`AuvoEntityDescriptor.toAuvo(row)`, ver
`supabase/functions/_shared/auvo/registry/types.ts`) é **função pura sem I/O** — recebe só a linha
de origem já buscada por `pcm-auvo-push` (`select("*")` na tabela do descriptor), nunca faz join
com outra tabela em tempo de drain. Calcular a cadeia hierárquica ali exigiria quebrar esse
contrato (I/O dentro de `toAuvo`) ou reescrever o motor — nenhuma das duas é aceitável pra uma
mudança tier arquitetural que também precisa preservar 2000+ linhas de produção e o pipeline já
verificado (ADR-0006/0009).

## Decisão
1. **Coluna denormalizada `auvo_localizacao text`** em `pcm.equipamentos` e `pcm.sistemas`
   (migration `0131`), populada por função SQL (`pcm.fn_montar_localizacao_hierarquica`/
   `fn_montar_localizacao_area`) que caminha a árvore via CTE recursiva e aplica separador/ordem
   configuráveis (`config.preferencia_localizacao_auvo`, superadmin). `toAuvo()` só lê essa coluna
   (`row.auvo_localizacao ?? row.localizacao` em equipamentos — fallback pro texto livre legado
   enquanto o item não tiver `local_id`/nunca foi tocado, zero regressão).
2. **Recalcula on-write via trigger `BEFORE INSERT OR UPDATE OF local_id/area_id`** — mover um
   ativo (Board, E01-S78/79, já usa `editarEquipamento` que faz `UPDATE ... local_id`) recalcula a
   coluna automaticamente, sem nenhuma mudança de frontend.
3. **Rename propaga por fan-out, reusando o outbox genérico já existente** — trigger
   `AFTER UPDATE OF nome` em `pcm.areas`/`pcm.locais` faz um `UPDATE` em lote nos
   `equipamentos`/`sistemas` afetados, só tocando `auvo_localizacao`. Esse `UPDATE` já dispara o
   trigger de enqueue genérico (`trg_equipamentos_auvo_enqueue`/`trg_sistemas_auvo_enqueue`,
   `after insert or update or delete`, E01-S22/E01-S76) — **nenhum insert direto no outbox foi
   necessário**, o mecanismo existente já cobre o caso.
4. **Sem backfill em massa na migration**: itens existentes ficam com `auvo_localizacao = null`
   (cai no fallback) até serem tocados por um rename ou um move — `equipamentos.writeEnabled` já é
   `true` em produção (decisão anterior, ADR-0006), então um backfill de ~2000 linhas dispararia
   PATCH real imediato pra conta Auvo real sem verificação prévia. Verificado antes de decidir:
   `pcm.fn_montar_localizacao_hierarquica` rodada read-only contra dados reais de produção (5
   equipamentos com `local_id`) devolveu valores corretos (`"Torre A · 3º andar · Sala 302"` etc.)
   — achado um bug real nesse teste (`max(uuid)` não existe no Postgres), corrigido em `0132` antes
   do deploy da Edge Function.

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| Coluna denormalizada + trigger (escolhida) | Preserva o contrato `toAuvo(row)` puro; reusa o outbox genérico sem tocá-lo; barato de calcular (CTE recursiva só roda no write) | Duas fontes derivadas da mesma verdade (hierarquia); precisa trigger em 4 tabelas | **Escolhida** — menor risco, zero mudança no motor de sync |
| Join dentro de `toAuvo`/`fetchOrigem` | Sempre atual, sem denormalização | Quebra o contrato "função pura sem I/O" de todo o registry; obriga reescrever `pcm-auvo-push` pra todo descriptor, não só localização | Rejeitada — blast radius desproporcional ao pedido |
| View materializada com refresh periódico | Não precisa trigger por tabela | Lag entre rename e sync (AC-2 pede propagação, não polling); overhead de refresh geral | Rejeitada — não atende AC-2 |
| Backfill imediato de todos os ativos existentes | Localização hierárquica correta desde já pra 100% da base | Dispara ~2000 PATCH reais na conta Auvo de produção numa migration não supervisionada, sem verificação item a item (viola AC-5) | Rejeitada — risco desproporcional; rollout incremental (on-touch) é suficiente |

## Consequências
**Positivas:**
- `location` enviado ao Auvo passa a refletir a hierarquia real, sem reescrever o motor de sync.
- Rename de Área/Local propaga automaticamente pros ativos afetados, sem edição manual item a item.
- Separador/ordem configuráveis sem deploy (`config.preferencia_localizacao_auvo`, superadmin).

**Negativas / trade-offs aceitos:**
- Itens existentes só ganham a localização hierárquica quando tocados (movidos, ou a Área/Local
  deles é renomeada) — rollout gradual, não imediato. Aceito conscientemente (ver Decisão #4).
- `auvo_localizacao` é dado derivado, não fonte de verdade — se `fn_montar_localizacao_hierarquica`
  mudar de comportamento (ex.: trocar separador padrão), itens não tocados não refletem
  retroativamente até o próximo write real.
