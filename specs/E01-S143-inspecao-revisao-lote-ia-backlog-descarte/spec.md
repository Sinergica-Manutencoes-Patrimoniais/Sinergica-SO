---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Relatório de Inspeção: revisão em lote (IA calcula GUT/esforço/embasamento, backlog ou descarte)

> **Fonte da verdade.** Origem: Lucas (2026-08-10, itens 5/6/7 + prints do sistema antigo dele).
> Correção sobre E01-S141 (que só tinha "Abrir chamado" por item, opt-in manual):
> - **Item 5:** "não é para abrir chamado automático para todos os itens, o Fabrício avalia os itens
>   e envia para o backlog apenas o que faz sentido, outros são marcados como 'descarte'."
> - **Item 6:** print do sistema antigo — filtro por tipo de falha (sistema), cada item com botões
>   de resultado (Conforme/Não conforme/Atenção/Não avaliado), pílula "no backlog" quando já enviado.
> - **Item 7:** "quando o item vai para o backlog a IA já calcula uma estimativa de horas... e
>   justifica com a norma porque aquilo foi classificado como ponto a ser corrigido."
> - Confirmado em pergunta de acompanhamento: a IA roda **em lote**, só nos itens marcados pra
>   backlog, ao clicar "Gerar backlog" — não automático por item, não a cada mudança de resultado.

## Contexto de código
- `pages/InspecoesPage.tsx` `ItemInspecaoCard`: hoje mostra resultado/grau de risco como badges
  fixos (definidos na criação/edição do item) + ação "Abrir chamado" (E01-S141, mantida — ver
  "Fora de escopo"). Sem seleção múltipla, sem ação em lote.
- `domain/assessment.ts`: `DestinoItemAssessment = "chamado" | "backlog" | "os"` — falta
  `"descarte"`. `validarDerivarItem` bloqueia segunda derivação quando `destino !== null`;
  "descarte" usa a mesma trava (marcar destino uma vez, sem desfazer pela UI).
- `application/assessment.ts` `derivarItemParaOsOuBacklog`: já cria OS/backlog a partir de um item,
  já aceita `gravidade`/`urgencia`/`tendencia` em `CriarOrdemServicoInput` — **hoje só é chamada em
  `AssessmentPage.tsx` com 3/3/3 hardcoded** (sem IA). Reusa sem mudar assinatura.
- `application/qualidade-gateway.ts` `processarRelatorioInspecao(texto): Promise<ItemInspecaoImportado[]>`
  → Edge Function `importar-relatorio-pdf` → `classificarRelatorioInspecao` (`supabase/functions/_shared/`)
  → OpenRouter, prompt v1 (`ia/prompts/e01-s105-inspecao-excel-v1.md`), devolve por item: sistema,
  título, descrição técnica, **citação normativa, gravidade/urgência/tendência (1-5),
  esforço em horas, justificativa do esforço**. **Já existe e já é exatamente o motor pedido no
  item 7** — hoje só usado no import de planilha/PDF (itens novos). Esta story reusa **o mesmo
  endpoint/prompt**, sem tocar no Edge Function, aplicando-o a itens **já existentes** (criados
  manualmente ou já importados) que Fabrício marcou pra backlog.
- `domain/priorizacao-backlog.ts` `calcularScoreGut`/`classificarPrioridade`: mesmo cálculo do board
  de OS (G×U×T, 1-125, faixas crítica/alta/média/baixa) — reusado pro "Score PCM" do item, igual ao
  print do sistema antigo.
- `pcm.inspecao_itens` (migrations `0091`/`0137`/`0150`): tem `destino`/`destino_responsavel`
  (check `chamado|backlog|os`) mas **não tem** gravidade/urgência/tendência/esforço/citação —
  mesmo no import (E01-S105), esses valores são usados só transitoriamente (severidade + texto de
  `recomendacao`) e descartados, nunca persistidos como colunas estruturadas.

## Resumo
Cada item ganha: (1) botões de resultado editáveis inline no card (Conforme/Não conforme/Atenção/
Não avaliado — reusa `RESULTADOS_INSPECAO`, sem "não aplicável" no ribbon rápido, que continua só
no formulário completo); (2) duas ações de triagem — **"Selecionar p/ backlog"** e **"Descartar"**
(`destino = "descarte"`, sem entidade derivada, sem IA); (3) uma barra fixa com **"Gerar backlog
(N)"** quando há itens selecionados. Ao confirmar: chama a IA (mesmo endpoint do import, reusado)
com os itens selecionados, abre uma **revisão editável** (GUT/esforço/citação normativa por item,
pré-preenchidos pela IA, ajustáveis antes de confirmar — mesmo padrão de revisão humana já usado no
import de planilha), e ao confirmar cria uma OS de backlog por item (`derivarItemParaOsOuBacklog`,
com a gravidade/urgência/tendência real da IA em vez de 3/3/3) e persiste GUT/esforço/citação no
próprio item de inspeção. Item mostra selo "No backlog" ou "Descartado" depois de decidido.

## Critérios de aceite

### AC-1: Resultado editável inline
- **Dado** um item de inspeção sem `destino` ainda decidido
- **Quando** o operador clica um dos botões Conforme/Não conforme/Atenção/Não avaliado no card
- **Então** o `resultado` do item é atualizado (reusa `editarItemInspecao`), sem abrir o modal
  completo de edição.

### AC-2: Selecionar para backlog / Descartar
- **Dado** um item sem `destino`
- **Então** o card tem duas ações: "Selecionar p/ backlog" (marca localmente, ainda não grava nada)
  e "Descartar" (grava `destino = "descarte"` direto, sem IA, sem confirmação em lote — reusa o
  padrão `confirm()` já usado em `handleExcluirItem`).
- Selecionar/desselecionar pra backlog é reversível **antes** de "Gerar backlog" (é seleção local,
  não grava no banco).

### AC-3: Barra "Gerar backlog (N)"
- **Dado** N itens selecionados pra backlog
- **Então** uma barra fixa no rodapé mostra "Gerar backlog (N)" (mesmo texto/posição do sistema
  antigo do Lucas), habilitada só com N ≥ 1 e `temEscrita`.

### AC-4: IA calcula GUT/esforço/embasamento em lote, revisão antes de gravar
- **Dado** o operador clica "Gerar backlog (N)"
- **Então** monta um texto com local+descrição de cada item selecionado (mesmo formato do parser de
  planilha: `Local:...\nRelato:...`, blocos separados por `---`) e chama
  `processarRelatorioInspecao` (mesmo endpoint do import — sem prompt novo); abre uma tela de
  revisão com os N itens, cada um mostrando gravidade/urgência/tendência (editável, sliders 1-5),
  esforço estimado em horas (editável), citação normativa (texto, editável) e o Score PCM calculado
  (`calcularScoreGut`) — tudo pré-preenchido pela IA.
- **Se a IA devolver um número de itens diferente do enviado** (falha de correlação — mesmo risco
  já aceito no import E01-S105): mostra aviso claro e usa GUT 3/3/3 + esforço 0 como fallback nos
  itens não correlacionáveis, mesma revisão editável antes de confirmar (nunca bloqueia o fluxo).

### AC-5: Confirmar gera o backlog
- **Dado** a revisão confirmada
- **Então**, por item: persiste gravidade/urgência/tendência/esforço/justificativa/citação normativa
  no item de inspeção; chama `derivarItemParaOsOuBacklog` com `destino = "backlog"`,
  `responsavel = "sinergica"` (fixo — sem UI de escolha nesta story, é sempre backlog interno),
  gravidade/urgência/tendência reais da IA, e `observacao` formatada com esforço estimado +
  justificativa + citação normativa (ver "Decisão de escopo" abaixo); item passa a mostrar selo
  "No backlog".

### AC-6: Selos de estado
- **Dado** um item já decidido
- **Então** mostra "No backlog" (destino = backlog/os/chamado) ou "Descartado" (destino =
  descarte), sem as ações de triagem (mesma trava de `validarDerivarItem`, estendida pra
  "descarte").

### AC-7: Filtro por sistema (confirma comportamento existente)
- **Dado** a lista de itens de uma inspeção com mais de um sistema
- **Então** o filtro por sistema já existente (`FiltroSistemaButton`) continua funcionando —
  nenhuma mudança necessária, só confirmação de que cobre o pedido do item 6 ("filtro por tipo de
  falha").

## Decisão de escopo — esforço/citação normativa na OS
`pcm.ordens_servico`/`CriarOrdemServicoInput` **não têm** campo de esforço estimado nem citação
normativa como colunas próprias (só `gravidade`/`urgencia`/`tendencia`/`observacao` livre) — criar
esses campos como primeira classe na OS afetaria todo o board de Chamados/OS, fora do pedido desta
story. Decisão: esforço + justificativa + citação normativa ficam **persistidos como colunas
estruturadas no item de inspeção** (rastreável, editável, exibido no card) e **também** embutidos
como texto formatado em `observacao` da OS criada (visível no painel de detalhe da OS, sem quebrar
nada existente). Se depois fizer sentido esforço/embasamento como campo próprio da OS, é ADR/story
futura.

## Casos de borda e erros
- IA indisponível/erro (OpenRouter não configurado, timeout): mesma mensagem de erro já usada no
  import (`erroAcao`) — nada é gravado, item continua selecionado, operador tenta de novo.
- Item sem descrição/local preenchidos: entra na classificação mesmo assim (IA já lida com relato
  vazio no import — mesmo tratamento).
- Descartar um item que já está selecionado pra backlog: desmarca a seleção automaticamente antes
  de gravar o descarte (evita os dois estados ao mesmo tempo).

## Fora de escopo
- Ação "Abrir chamado" da E01-S141 **permanece no código** (ainda é um destino válido,
  `DestinoItemAssessment` mantém `"chamado"`) — não é removida, só deixa de ser o caminho principal
  de triagem. Card mostra as duas famílias de ação (resultado/backlog/descarte desta story +
  "Abrir chamado" já existente) sem forçar escolha entre elas.
- Escolher `responsavel` (sinergica/terceiro/cliente) por item nesta tela — fixo em "sinergica".
  Trocar responsável continua possível depois, no board de OS.
- Campo de esforço/citação normativa como coluna própria em `pcm.ordens_servico` (ver "Decisão de
  escopo").
- Reclassificar item já decidido (mudar de ideia depois de "No backlog"/"Descartado") — mesma trava
  de `validarDerivarItem`, já vale hoje pros outros destinos.

## Rastreabilidade
- Código: `domain/assessment.ts` (`DestinoItemAssessment` + "descarte"),
  `domain/inspecoes-laudos.ts`/`application/qualidade-gateway.ts` (novos campos do item),
  `application/qualidade.ts` (persistir GUT/esforço/citação, `descartarItem`),
  `application/assessment.ts` (reuso de `derivarItemParaOsOuBacklog`, sem mudar assinatura),
  `pages/InspecoesPage.tsx` (seleção, barra, modal de revisão).
- Migration: novas colunas em `pcm.inspecao_itens` + `destino` aceita `'descarte'`.
- Reusa: E01-S90 (destino do item), E01-S97 (fotos), E01-S105 (Edge Function/prompt de
  classificação, sem mudança), `priorizacao-backlog.ts` (Score PCM).
- Supersede: E01-S141 (ver nota no ROADMAP — "Abrir chamado" permanece, deixa de ser o fluxo
  principal).
- ADRs relacionados: —
