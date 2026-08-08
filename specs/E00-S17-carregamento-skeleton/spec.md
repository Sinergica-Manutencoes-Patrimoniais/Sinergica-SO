---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Estados de carregamento: skeleton e resposta imediata

> **Fonte da verdade.** Status: rascunho
> Depende de **E00-S15** (primitivas). Apple, *Designing Fluid Interfaces*: "no instante em que
> o lag aparece, a sensação de contato direto despenca."

## Resumo
Toda tela para de piscar branco com a palavra "Carregando" e passa a mostrar a forma do conteúdo
que está chegando, com resposta ao clique no `pointer-down`, não no fim da requisição.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Arquivos com estado "Carregando" | **70** |
| Componentes de skeleton | **0** |
| `Carregando...` (três pontos ASCII) | 36 |
| `Carregando…` (reticência tipográfica U+2026) | 32 |
| `Carregando itens…` / outras variações | 3+ |
| Botões com `:active` / feedback de pressão | **0** |

Além do skeleton ausente: **duas grafias de reticência convivem no mesmo produto**. É o tipo de
detalhe que ninguém aponta conscientemente e todo mundo sente.

## Critérios de aceite

### AC-1: Skeleton com a forma do conteúdo real
- **Dado** `src/components/ui/Skeleton.tsx`
- **Quando** uma tela está buscando dados pela primeira vez
- **Então** ela renderiza o **esqueleto do layout final** (linhas de tabela, cards, campos),
  não um spinner centralizado nem texto
- **E** `DataTable` (E00-S15) tem `loading` embutido que renderiza N linhas fantasma com a
  largura real das colunas
- **E** a contagem de `Carregando` como **texto renderizado** em `.tsx` cai para **0**
  (identificadores como `setCarregando` continuam válidos)

### AC-2: O esqueleto não pisca em requisição rápida
- **Dado** uma requisição que responde em menos de 200ms
- **Quando** a tela carrega
- **Então** o skeleton **não é exibido** (delay de 200ms antes de mostrar) — piscar esqueleto
  por 80ms é pior do que não mostrar nada
- **E** uma vez exibido, permanece no mínimo 400ms (evita flash de aparecer-e-sumir)

### AC-3: Recarga não destrói a tela
- **Dado** uma tela já com dados
- **Quando** o usuário aplica filtro, ordena, ou os dados são revalidados
- **Então** o conteúdo atual **permanece na tela** com indicação sutil de atualização — nunca
  volta ao skeleton
- **E** o scroll não é perdido

### AC-4: Botão responde no toque, não no fim
- **Dado** qualquer `Button` (E00-S15)
- **Quando** o usuário pressiona (`pointerdown`)
- **Então** o feedback visual (`scale(0.97)`) é **imediato**, sem esperar `click` nem a resposta
  do servidor
- **E** ação que dispara requisição entra em `loading` no mesmo frame do clique

### AC-5: Reticência única em todo o produto
- **Dado** qualquer string de interface
- **Quando** o gate estático roda
- **Então** a contagem de `...` (três pontos ASCII) dentro de texto de UI é **0** — o padrão é
  `…` (U+2026)
- **E** isso vale também para `placeholder`, `title` e `aria-label`

### AC-6: Estado vazio distingue "vazio" de "filtrado a zero"
- **Dado** uma lista sem resultados
- **Quando** ela é exibida
- **Então** se **nunca houve** registro, mostra estado vazio com a ação primária de criar
- **E** se houve mas o **filtro zerou**, mostra "nenhum resultado para estes filtros" com ação
  de limpar filtro — nunca a mesma mensagem para os dois

## Casos de borda e erros
- Falha de rede durante a carga → estado de erro **com botão "Tentar de novo"**, nunca skeleton
  eterno nem tela branca.
- Permissão negada → mensagem de permissão, não estado vazio (o usuário precisa saber que o dado
  existe mas não é dele).
- Carga parcial (lista carregou, contadores não) → cada bloco tem seu próprio estado; um bloco
  lento não segura a tela inteira.
- `prefers-reduced-motion` → skeleton sem animação de shimmer, só o bloco estático.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Cache/revalidação (React Query, SWR) — decisão própria, ADR próprio.
- Atualização otimista de mutação — depende de cache, fica para depois.
- Paginação/virtualização.

## Rastreabilidade
- Depende de: **E00-S14**, **E00-S15**
- Relacionado: E00-S19 (movimento — shimmer e `reduced-motion`)
