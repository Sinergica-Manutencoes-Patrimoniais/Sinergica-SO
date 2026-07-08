---
name: tasks
description: Decomposição e gates — write path instantâneo PCM→Auvo.
alwaysApply: false
---

# Tasks — Write path instantâneo PCM→Auvo

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `design.md` — drain imediato pós-enqueue com cron como fallback; regra "só habilita com mapeamento verificado" | AC-2, AC-4 | — | revisão humana | feito |
| 2  | Verificação de contrato do mapeamento por entidade contra a API Auvo real/sandbox; documentar campos confirmados; teste de contrato por descriptor | AC-4 | — | `deno test supabase/functions/_shared/auvo/registry/` | **bloqueado — sem credenciais/acesso à API Auvo real neste ambiente. Ver Divergências.** |
| 3  | Flip `writeEnabled=true` só nas entidades verificadas em `_shared/auvo/registry/*.ts` (funcionarios, clientes, equipamentos, ferramentas, tickets, servicos, equipes, tipos-tarefa, categorias, segmentos, grupos) | AC-1 | 2 | `deno test` do descriptor | **não feito — depende da task 2 (bloqueada). Nenhum flag flipado nesta sessão.** |
| 4  | Migration `0051_E01-S36_drain_imediato.sql`: `fn_auvo_enqueue()` (trigger, 0024) dispara `pcm-auvo-push` via `pg_net` logo após o `insert` no outbox, reusando os secrets do Vault de `0011`/`0037`/`0038`; cron 1 min permanece fallback | AC-2 | 1 | `lint:migrations` (Squawk + custom) | feito — 51 migrations, verde |
| 5  | Propagação de EDIT/DELETE de funcionário — **já ocorre pelo mecanismo genérico**: `supabase-funcionarios-adapter.ts` seta `auvo_sync_status:'pending'` no UPDATE da linha, a trigger `fn_auvo_enqueue` (anexada em `0031`) enfileira e agora dispara o drain imediato (task 4). Falta só o flip de `funcionariosDescriptor.writeEnabled` (task 3, bloqueada) para o PATCH/desativação realmente sair | AC-3 | 4 | — | **código-caminho pronto; efeito real depende da task 3** |
| 6  | Garantir skip explícito na saúde de sync p/ entidade `writeEnabled=false` (integra com `E00-S11`) | AC-4 | 3 | `deno test` (writeEnabled=false ⇒ skip explícito, não `sent`) | feito em `E00-S11` (`pcm-auvo-push` faz upsert em `pcm.auvo_entity_status` a cada entidade vista no lote — ver `0050`) |
| 7  | pgTAP/Deno de idempotência sob drain imediato (edições rápidas não duplicam) | AC-1 | 3,4 | `supabase test db` / `deno test` | pendente — cobre a lógica de `processOutboxRow` já existente (E01-S22), sem mudança nova de idempotência nesta story; drain imediato só antecipa quando ela roda |
| 8  | `pnpm run ci:local` + atualizar ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | feito (gates Node — ver Divergências para o que ficou de fora) |

## Plano de teste
- Unidade/Contrato (Deno): mapeamento de campos por descriptor contra fixtures da API Auvo (AC-4) — **bloqueado, ver Divergências**.
- Integração (Deno): enqueue dispara `pcm-auvo-push` — coberto pelo trigger `pg_net` (task 4), sem teste Deno novo (é SQL/trigger, não Deno); validar com o teste manual comentado no fim da migration.
- Aceite: matriz de decisão da spec (create/edit/delete × writeEnabled × verificado) — só o eixo "writeEnabled=false" é demonstrável hoje; os demais dependem do flip.

## Divergências (SPEC_DEVIATION)
- [x] **Task 2/3 · AC-1/AC-4 · motivo:** a spec exige verificar o mapeamento de campos contra a API Auvo real antes de qualquer flip de `writeEnabled`. Este ambiente de execução não tem credenciais/acesso de rede à API Auvo (só um login de UI do Auvo foi fornecido pelo usuário, para teste manual via browser — não é uma verificação de contrato de API). Flipar `writeEnabled` sem essa verificação arriscaria gravar dado malformado na conta de produção real do cliente (dado de negócio real: condomínios, funcionários) — ação externa de alto risco e difícil reversão. **Resolução: nenhum `writeEnabled` foi alterado nesta sessão** (todos os 13 descriptors continuam `false`, estado seguro pré-existente). Fica como próximo passo explícito para quem tiver acesso à API Auvo real (ou sandbox) — usar `pcm-auvo-tickets-referencia`/logs de produção para confirmar nomes de campo por entidade, então flipar uma a uma com teste de contrato.
- [x] **Task 4 · motivo:** o `design.md` recomendava "Opção A" (invoke a partir dos adapters do front) como MVP, com "Opção B" (`pg_net` na própria trigger) como evolução. Implementei a **Opção B diretamente**: cobre toda escrita (inclusive fora do adapter, ex. futuras integrações server-side) com uma única mudança centralizada na trigger, em vez de tocar em ~10 adapters TS individualmente — menor superfície de erro (esquecer de disparar num adapter) e reusa exatamente o padrão já testado em produção por `0011`/`0037`/`0038`. Resolução: `design.md` atualizado para refletir a Opção B como a implementada.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável — **AC-1/AC-3/AC-4 dependem do flip de `writeEnabled`, bloqueado (ver Divergências); AC-2 implementado e coberto pelo padrão já usado em produção**
- [x] Nenhum `SPEC_DEVIATION` pendente — as 2 divergências acima foram resolvidas (documentadas, não deixadas em aberto)
- [ ] ADR-0005 — não precisou de atualização: a decisão de outbox/anti-loop não mudou, só ganhou um disparo adicional; avaliar se cabe uma nota curta
- [x] Entidades `writeEnabled=false` restantes documentadas (não silenciosas) — via `pcm.auvo_sync_health` (E00-S11)
- [x] Spec reflete o que foi construído (esta tabela + Divergências)
- [ ] `docs/STATE.md` atualizado
