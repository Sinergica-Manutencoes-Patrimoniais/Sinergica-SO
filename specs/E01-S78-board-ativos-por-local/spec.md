---
name: spec-E01-S78-board-ativos-por-local
description: Contrato — board visual de ativos por Local (colunas nível-1 + subgrupos) e drawer de detalhe do ativo.
alwaysApply: true
tier: pequeno
---

# Spec — Board de ativos por Local + detalhe do ativo

## Resumo
Fase 1 da visualização espacial dos ativos (a fase 2, "planta do andar com pins", vem depois). Nova
aba **Board** na Visão do Cliente (ao lado de "Estrutura", E01-S76): escolhida uma Área, mostra os
ativos daquele "andar" em colunas por Local, agrupados por sub-local, e um **drawer de detalhe** ao
clicar num ativo. Frontend-only — reusa a hierarquia (Área/Local/Item) e o `obterContextoItem` de
E01-S76. Feedback do Lucas (2026-07-18): "visualização de todos os ativos de uma vez meio que na
linha de um mapa do andar, detalhe do ativo."

## Decisões travadas (PO, via AskUserQuestion)
| Decisão | Escolha |
|---------|---------|
| Onde vive o board | Aba nova na `VisaoClientePage` (contexto de cliente já selecionado) |
| Layout das colunas | Colunas = Locais **nível-1** da Área; itens de sub-locais **agrupados por sub-local** dentro da coluna |
| Drawer de detalhe | Completo: breadcrumb + foto + tipo + sistemas + componentes filhos + **histórico de OS** + última manutenção |

## Critérios de aceite

**AC-1 — Aba Board com seletor de Área.** Given um cliente com ≥1 Área (E01-S76), When abre a aba
"Board" na Visão do Cliente, Then vê um seletor de Área e o board da Área selecionada (primeira por padrão).

**AC-2 — Colunas por Local nível-1 + subgrupos.** Given uma Área com Locais em árvore, When o board
renderiza, Then cada coluna é um Local **filho direto da Área** (nível-1); os itens instalados num
sub-local aparecem **agrupados sob o nome do sub-local** dentro da coluna do ancestral nível-1; itens
instalados diretamente no Local nível-1 aparecem sem subgrupo.

**AC-3 — Coluna "Sem local".** Given itens do cliente com `local_id = null`, When o board renderiza,
Then eles aparecem numa coluna "Sem local" (não somem), permitindo posicioná-los depois.

**AC-4 — Card do item.** Given um item no board, When exibido, Then o card mostra o ícone do `tipo`
(equipamento/componente), o nome, a miniatura da foto (`url_imagem`) quando houver, e o status ativo/inativo.

**AC-5 — Drawer de detalhe.** Given um card, When o usuário clica, Then abre um drawer lateral com:
breadcrumb **Cliente > Área > Local**, foto, tipo, **chips dos Sistemas** de que participa e os
**componentes filhos** aninhados (tudo via `obterContextoItem`, E01-S76). Fecha por X e por Esc.

**AC-6 — Histórico de OS no drawer.** Given um item com OS vinculadas (`pcm.os_equipamentos_auvo`
por `auvo_equipment_id`), When o drawer abre, Then mostra a **última manutenção** e a lista de OS do
item (número, categoria/status, data), mais recente primeiro. Sem OS → estado vazio honesto ("Nenhuma
OS registrada para este ativo"), nunca erro.

**AC-7 — Estados de borda e sem regressão.** Given um cliente sem Áreas, When abre a aba Board, Then vê
um estado vazio com atalho para a aba "Estrutura" (onde se criam Áreas/Locais). As demais abas da Visão
do Cliente (Resumo, Ativos, Estrutura, OS…) continuam idênticas.

## Casos de borda e erros
- Local nível-1 sem nenhum item (nem em descendentes) → coluna aparece vazia com "Sem ativos" (mostra a estrutura mesmo vazia).
- Item cujo `local_id` aponta para um Local de **outra** Área (não deveria, dado o trigger de E01-S76) → não entra em nenhuma coluna da Área atual; aparece só quando a sua Área é selecionada.
- Item sem `auvo_equipment_id` → drawer mostra histórico de OS vazio (não há chave de junção), sem erro.
- Falha ao carregar histórico de OS → o drawer degrada só naquela seção ("não foi possível carregar o histórico"), sem derrubar o resto do detalhe (mesmo padrão de degradação da Visão 360).

## Fora de escopo (vinculante)
- Planta do andar com imagem de fundo e pins arrastáveis (coordenadas) — é a **fase 2**, story separada.
- Drag-and-drop de card entre Locais para mover a instalação — mover local segue pela edição do item existente.
- Escrita no Auvo — nada novo é empurrado; o board é leitura + navegação sobre dado de E01-S76.

## Rastreabilidade
- Domínio: `apps/web/src/features/pcm/domain/board-ativos.ts` (+ `.test.ts`) — `montarColunasBoard` puro.
- Application: `apps/web/src/features/pcm/application/board-ativos-gateway.ts` + `board-ativos.ts` (compõe `HierarquiaGateway` + itens).
- Infra: `apps/web/src/features/pcm/infrastructure/supabase-board-ativos-adapter.ts` (itens do cliente + histórico de OS por `auvo_equipment_id`).
- Reuso: `HierarquiaGateway` (`listarAreas`/`listarLocaisDoCliente`), `EquipamentosGateway.obterContextoItem`, `domain/hierarquia.montarArvore`.
- UI: `apps/web/src/features/pcm/pages/VisaoClientePage.tsx` (aba "board"), novo `components/BoardAtivos.tsx` + `components/DrawerDetalheAtivo.tsx`.
- Sem migration (frontend-only sobre schema de E01-S76/E01-S16).
