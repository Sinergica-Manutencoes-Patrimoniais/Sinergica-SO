---
name: spec-E01-S76-hierarquia-localizacao-ativos
description: Contrato — AC Given/When/Then da hierarquia de localização de ativos + Sistemas.
alwaysApply: true
tier: arquitetural
---

# Spec — Hierarquia de localização de ativos + Sistemas

## Resumo
Introduz `Cliente > Área > Local (árvore) > Item (Equipamento|Componente)` + Sistemas transversais (N:N)
no PCM, estendendo `pcm.equipamentos`. Sistemas empurrados ao Auvo como Equipment (push-only, gated).

## Matriz de decisão (PO — travada)
| Decisão | Escolha |
|---------|---------|
| Profundidade de Local | Árvore aninhada (`parent_id`) |
| Componente × Equipamento | Componente pode ser filho de Equipamento (`parent_item_id`) |
| Sistema → Auvo | Equipamento Auvo (`/equipments`) |
| Área obrigatória | Sim, sempre presente |

## Critérios de aceite

**AC-1 — Criar Área.** Given um cliente existente e usuário `pcm:escrita`, When cria uma Área ("Torre A"),
Then persiste em `pcm.areas` vinculada ao cliente e aparece na lista de Áreas do cliente.

**AC-2 — Criar Local em árvore.** Given uma Área, When cria um Local ("3º andar") e depois um sub-local
("Sala 302") com `parent_id` do primeiro, Then ambos persistem em `pcm.locais` com o mesmo `area_id` e a
árvore é montável (pai→filho).

**AC-3 — Integridade da árvore.** Given um Local, When tenta-se setar `parent_id` que gere ciclo OU cujo pai
esteja em outra Área, Then o trigger `fn_locais_valida_hierarquia` rejeita com erro (nenhuma linha inconsistente grava).

**AC-4 — Instalar Item em Local.** Given um Item e um Local, When atribui `local_id` ao Item, Then o Item passa
a resolver o caminho Cliente>Área>Local. `tipo` aceita `equipamento` ou `componente`.

**AC-5 — Componente filho de Equipamento.** Given um Equipamento, When cria um Componente com `parent_item_id`
apontando pra ele (mesmo cliente), Then o Componente aparece aninhado sob o Equipamento; pai de cliente diferente é rejeitado.

**AC-6 — Visão do Item.** Given um Item instalado num Local e membro de ≥1 Sistema, When abre o detalhe do Item,
Then vê o breadcrumb **Cliente > Área > Local** e os **chips dos Sistemas** de que participa.

**AC-7 — Criar Sistema e agrupar itens.** Given um cliente com itens, When cria "Sistema de Hidrante Torre A" e
adiciona N itens, Then persiste em `pcm.sistemas` + `pcm.sistema_itens` (N:N; um item pode entrar em >1 sistema);
membro de cliente diferente é rejeitado.

**AC-8 — Sistema enfileira no Auvo (gated).** Given `writeEnabled:false` no descriptor `sistemas`, When cria um
Sistema, Then o trigger insere linha no `pcm.auvo_sync_outbox` (op `create`) e o drain retorna dry-run
(`"writeEnabled=false, pulado"`) sem POST real ao Auvo.

**AC-9 — RLS por papel.** Given usuário `pcm:leitura`, When lê Áreas/Locais/Sistemas, Then vê os registros mas
INSERT/UPDATE/DELETE falham; `pcm:escrita` e `superadmin` escrevem. Testado por efeito (contagem) em pgTAP.

**AC-10 — Preservação dos equipamentos existentes.** Given as 2000+ linhas atuais de `pcm.equipamentos`, When a
migration 0095 aplica, Then todas ficam `tipo='equipamento'`, `local_id=null`, sem perda de dados nem quebra do sync Auvo.

## Casos de borda / erro
- Área/Local/Sistema com nome vazio → validador de domínio rejeita.
- Nome de Área duplicado no mesmo cliente → unique index rejeita (case-insensitive).
- Remover um Local com filhos/itens → definir comportamento: bloquear ou soft-delete em cascata (decidir em tasks; default: bloquear se tiver filhos/itens ativos).
- Item já em um Sistema, re-adicionar → unique `(sistema_id,item_id)` impede duplicata.

## Fora de escopo (vinculante)
- Auto-parse de `equipamentos.localizacao` texto-livre para Área/Local.
- Flip `writeEnabled:true` do descriptor `sistemas` (follow-up com teste de contrato real + mitigação da linha-fantasma).
- Rotas por URL / deep-link.

## Rastreabilidade
- Migrations: `0095_E01-S76_hierarquia_localizacao_ativos.sql`, `0096_E01-S76_validate_constraints.sql`.
- Domínio: `apps/web/src/features/pcm/domain/{hierarquia,sistemas,equipamentos}.ts`.
- Application: `.../application/{hierarquia,hierarquia-gateway,sistemas,sistemas-gateway}.ts` + extensão de equipamentos.
- Infra: `.../infrastructure/{supabase-hierarquia-adapter,supabase-sistemas-adapter,supabase-equipamentos-adapter}.ts`.
- Auvo: `supabase/functions/_shared/auvo/registry/{sistemas.ts,index.ts}`.
- UI: `.../pages/*`, `apps/web/src/app/HomePage.tsx`.
- pgTAP: `supabase/tests/`.
