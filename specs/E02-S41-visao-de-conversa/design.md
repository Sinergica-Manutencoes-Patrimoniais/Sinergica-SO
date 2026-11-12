---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — Visão de conversa do Atendimento

> **Tier:** arquitetural (substitui a superfície inteira do Atendimento e troca o contrato do
> repositório) · **Status:** rascunho
> **Autor:** sessão Claude (porte TriviAtende) · **Data:** 2026-11-12
> Depende de **E02-S37** e **E02-S38** (os tipos de conteúdo que a timeline renderiza) e do lote
> visual **E00-S14/S15/S18/S19/S20/S22** (tokens, primitivas, tipografia, movimento, elevação, tema).

## Contexto da funcionalidade

`apps/web/src/features/atendimento/components/ConversaChat.tsx` (10 KB) concentra cabeçalho, lista de
mensagens, compositor, emoji, templates, tags, acionar IA, assumir/devolver e envio de histórico num
componente só, recebendo **13 props**. `ConversaLista.tsx` (4 KB) não tem escopo nem contador.
`ConversaPerfil.tsx` (4 KB) mostra quatro campos. `MensagemBubble.tsx` (4 KB) sabe renderizar texto e
áudio — e só.

Consequências medidas no código atual:

- **Tipo de conteúdo não existe na tela.** Com S37/S38 a mensagem passa a ter `conteudoRecebido`
  (imagem, vídeo, documento, figurinha, localização, contato, enquete), `anexoEstado`, `legenda`,
  `citada_*` e reação. A bolha atual ignora tudo isso — uma foto entraria como bolha vazia.
- **Rascunho é `useState` do componente.** Trocar de conversa perde o que foi digitado.
- **Permissão é decidida no browser.** `temEscrita` é booleano vindo de cima; não há sinal calculado
  pelo servidor nem tratamento de conflito de versão.
- **Nada da conversa tem URL.** Herdado do estado pré-E00-S21; a conversa selecionada é `useState`.
- **Sem escopo na fila.** Conversas encerradas ou somem ou poluem; não há como olhar só o que
  aguarda humano.
- **Cor fora do token.** `MensagemBubble` usa `bg-orange`, `bg-orange-soft`, `bg-line-soft` como
  utilitários diretos. Laranja é o CTA da marca (`--color-orange`, "cirúrgico: só CTA/ativo", comentário
  do próprio `index.css`) — usá-lo como cor de bolha de saída gasta o recurso mais escasso da paleta
  na coisa mais repetida da tela.

Referência de linguagem visual: `rosefish/DESIGN.md` ("sala de decisão comercial" — precisão do Attio,
hierarquia por tamanho, peso, espaço e separadores finos; cor de marca pontual). **Portamos o método, não
a paleta:** a Sinérgica tem identidade própria (navy + laranja + papel quente) já tokenizada no
E00-S14.

## Goals / Non-goals

**Goals**

- Cada tipo de conteúdo tem uma forma própria, legível em varredura rápida, sem o atendente abrir nada
  para saber o que chegou.
- Hierarquia vem de **tamanho, peso, espaço e hairline** — não de cor. Laranja só em CTA, estado ativo e
  prioridade.
- A tela sobrevive a troca de conversa, F5 e sessão concorrente sem perder trabalho digitado.
- Densidade operacional: cabe uma fila útil e a conversa na mesma tela em notebook de 1366 px.
- Contraste AA em claro e escuro, com `prefers-reduced-motion` respeitado.
- Nenhuma cor hardcoded; tudo por token semântico do E00-S14.

**Non-goals**

- Trocar a paleta ou a tipografia da Sinérgica pela do TriviAtende.
- Redesenhar a casca (sidebar, header) — é E00-S21/S23.
- Tema escuro novo: herda o que o E00-S22 já definiu.
- Resumo por IA, sinal comercial e transferência entre grupos (não se aplicam).

## Design proposto

### Grade e layout

```
≥1280px   [ fila 340px ][ conversa 1fr ][ contexto 360px ]   contexto colapsável
 768–1279 [ fila 300px ][ conversa 1fr ]                      contexto = painel sobreposto (direita)
 <768px   pilha: fila é a tela → conversa empurra; ações secundárias no menu ⋯
```

Ritmo de **4 px** em todo espaçamento (`gap-1` = 4, `gap-2` = 8, `gap-3` = 12, `gap-4` = 16).
Separação entre colunas por **hairline** (`border-line`), nunca por sombra — sombra fica reservada a
elementos que de fato flutuam (`--shadow-overlay` no painel sobreposto, `--shadow-modal` em diálogo).

Fundo: coluna da conversa em `--color-paper` (papel quente), fila e contexto em `--color-card`.
É o inverso do que a intuição sugere e é proposital: a conversa é a área de leitura longa, e o papel
quente cansa menos que branco puro; as colunas laterais são de varredura curta e ganham contraste.

### Item da fila

```
┌────────────────────────────────────────────────┐
│ ◯  Condomínio Villa Real            14:32   ●  │   avatar 36px · nome text-body-sm/600
│    Maria (síndica)                              │   contato text-caption, ink-3
│    [imagem] orçamento do elevador…       ⬤ 3   │   prévia text-caption, ink-2, 1 linha
│    ◷ aguardando humano   #urgente               │   selo text-micro
└────────────────────────────────────────────────┘
```

- Altura-alvo **72 px**; 1366×768 mostra ~8 itens sem rolar.
- Hairline `--color-line-soft` entre itens; item ativo com **barra de 2 px laranja à esquerda** e fundo
  `--color-orange-soft` (é estado ativo — uso legítimo do laranja).
- Prévia de mídia entra com o rótulo do tipo em colchete, igual ao que o banco grava
  (`[imagem]`, `[documento] laudo.pdf`), nunca uma bolha vazia.
- Badge de não lidas: pílula `--color-orange` com número; só aparece acima de zero.
- Selo de situação por **forma e texto**, com cor de apoio: aguardando humano
  (`warning-soft`/`warning`), com o Zé (`info-soft`/`info`), encerrada (`line-soft`/`ink-3`).

### Bolha de mensagem — anatomia

```
    ┌─ citação (quando houver) ────────────┐
    │▎Zé: "A visita está agendada para…"   │  barra 2px ink-3, trecho 2 linhas, clicável
    └──────────────────────────────────────┘
    ┌──────────────────────────────────────┐
    │ conteúdo (texto | mídia | aviso)     │
    │                              14:32 ✓✓│  hora+entrega text-micro, dentro da bolha
    └───────────────────────────────── 👍 ─┘  reação ancorada na borda inferior
```

| Autor | Alinhamento | Fundo | Borda | Rótulo |
|---|---|---|---|---|
| cliente | esquerda | `--color-card` | `--color-line` | nome do contato |
| Zé / agente | direita | `--color-info-soft` | `--color-info-line` | "Agente Zé" + ícone bot |
| humano (formulário) | direita | `--color-navy` com texto claro | — | "Você" |
| humano (celular) | direita | `--color-navy` 8% + borda navy | `--color-navy-line` | "Pelo celular" + ícone |
| automática do WhatsApp | direita | `--color-line-soft` | `--color-line` | "Mensagem automática" |

**Decisão deliberada:** sai o `bg-orange` da bolha de saída. Azul institucional (navy/info) separa "nós"
de "cliente" sem queimar o laranja, que volta a significar só ação e prioridade. A distinção
Zé × humano passa a ser visível de longe, que é o que a operação pede desde o ADR-0049.

Largura máxima da bolha **68ch** (não 75% da coluna): linha longa demais perde a volta, e em monitor
largo 75% vira parágrafo de 140 caracteres.

### Mídia na timeline

| Tipo | Forma |
|---|---|
| imagem | miniatura `max-h-240px`, `radius-lg`, clique abre lightbox; legenda abaixo, dentro da mesma bolha |
| figurinha | `max-h-120px`, **sem moldura e sem fundo de bolha** — figurinha é adesivo, não mensagem |
| vídeo | `<video controls preload="metadata">`, mesma caixa da imagem |
| documento | cartão: ícone por extensão, nome saneado (2 linhas, truncado no meio), `tipo · tamanho`, botão baixar |
| áudio | player + duração; transcrição **abaixo, dentro da mesma bolha**, em `text-body-sm` `ink-2`, com rótulo "Transcrição" |
| falha de anexo | cartão em `warning-soft`, ícone de atenção, o aviso + legenda preservada |
| aviso (localização/contato/enquete) | linha em `line-soft`, `text-caption`, ícone do tipo, sem bolha |

Imagem e vídeo carregam com `aspect-ratio` reservado antes do byte chegar — sem salto de layout quando
o anexo resolve.

### Estados

- **Fila vazia por filtro:** "Nenhuma conversa em *encerradas*" + ação "ver todas".
- **Fila vazia de verdade:** ilustração mínima + "As conversas do WhatsApp aparecem aqui".
- **Conversa não selecionada** (≥1280 px): painel central com a marca em 6% e uma linha de instrução.
- **Carregando:** skeleton do E00-S17 com a **mesma métrica** do conteúdo real (72 px por item de fila,
  3 bolhas de alturas diferentes) — skeleton que não casa com o resultado é pior que spinner.
- **Enviando:** bolha otimista com opacidade 0,6 e relógio; falha troca para borda `danger-line` e
  "não enviada · tentar de novo", reusando o `operacaoId`.
- **Sem permissão:** compositor desabilitado com o motivo acima dele, nunca um campo que aceita texto e
  recusa no envio.
- **Conflito de versão:** faixa `warning-soft` no topo da conversa com "mudou em outra sessão" +
  "recarregar", e as ações desabilitadas até recarregar.

### Movimento

Só três, todos com `--duration-fast` (120 ms) e `--ease-out`, e nenhum com `prefers-reduced-motion`:

1. Mensagem nova entra com `translateY(4px) → 0` + fade.
2. Painel de contexto desliza com `--ease-drawer` e `--duration-base`.
3. Destaque da mensagem citada ao clicar: `--color-orange-soft` por 600 ms, decaindo.

Sem animação de troca de conversa — a lista precisa parecer instantânea.

## Cobertura dos 5 eixos

### 1. Tech stack
Nada novo. React 19 + Vite + TS + Tailwind v4, tokens do `index.css`, primitivas de
`packages/ui` (E00-S15), ícones `lucide-react`, TanStack Query e TanStack Router já em uso. Lightbox é
`<dialog>` nativo com `showModal()` — sem lib.

### 2. Arquitetura base
`features/atendimento/` ganha a pasta `interfaces/`, completando as quatro camadas do DDD tático.
O contrato sai de `atendimento-gateway.ts` (raso) para `application/portas.ts`, com o ator **fora** do
parâmetro. Nenhum import cruzado com outras features; o que for de outro domínio (chamado, OS) entra por
render-prop injetada no `app`, como o `renderizarDemandasDaConversa` do TriviAtende.

### 3. Infra
Nenhum recurso novo. Zero migrations (tudo veio de S35–S40). Reversão: a tela antiga continua no código
sem rota durante toda a story; voltar é trocar o componente da rota num commit.

### 4. Qualidade
Pirâmide: unidade (contador, filtro, rascunho, `operacaoId`), componente (timeline com os 9 tipos +
citação + reação + 4 rótulos; estados de falha), integração de query (`keepPreviousData`, cancelamento,
invalidação), E2E Playwright (assumir → responder → devolver → encerrar, e conflito em duas abas).
**Budget de performance:** fila de 50 itens renderiza em <16 ms por frame; abrir conversa com 200
mensagens < 400 ms p95; a query da fila é paginada por offset com índice
`idx_conversas_status_atividade` já existente. Gate de a11y: `axe` sem violação crítica na rota.

### 5. Observabilidade
Nenhuma telemetria nova de produto nesta story. Erros de mutation vão para o `log.ts` existente com
`conversa_id` e código — **nunca** conteúdo de mensagem. O sinal de que funcionou é o gate de E2E e a
checagem de paridade funcional no PR.

## Mapa de dependências

| Dependência | Tipo | Descrição | Métodos / endpoints |
|---|---|---|---|
| `E02-S37` | interna | tipos de conteúdo e proxy de anexo | `atendimento-anexo` |
| `E02-S38` | interna | citação e reação | `reacoes_mensagem`, `citada_*` |
| `E00-S14/S15/S18/S19/S20` | interna | tokens, primitivas, tipografia, movimento, elevação | `index.css`, `packages/ui` |
| `E00-S21` | interna | rota com parâmetro de conversa | `/atendimento/conversas/$id` |
| TanStack Query | lib | dado de servidor (obrigatório, `CLAUDE.md`) | `app/query-client.ts` |

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| **A — tela nova ao lado, troca de rota no fim (escolhida)** | rollback de um commit; antiga serve de referência viva na revisão | código duplicado por uma story | o atendimento está em produção: trocar in-place não tem volta barata |
| B — refatorar `ConversaChat` incrementalmente | sem duplicação | o contrato de portas muda por baixo; cada passo deixa a tela meio-nova meio-velha | arrasta o risco por semanas |
| C — adotar a paleta do TriviAtende | paridade visual com a referência | quebra a identidade da Sinérgica e o E00-S14 inteiro | portamos método, não marca |
| D — manter laranja na bolha de saída | nada muda, menos diff | gasta o CTA na coisa mais repetida; Zé e humano ficam iguais | contraria o próprio comentário do `index.css` |

## Trade-offs e consequências

- **Ganhamos:** tipo de conteúdo legível de relance, trabalho que não se perde, permissão decidida no
  servidor, laranja devolvido ao CTA.
- **Aceitamos perder:** um ciclo com dois conjuntos de componentes no repositório, e um PR de limpeza
  depois do PASS.
- **Dívida assumida:** rascunho vive só em memória — F5 perde o texto digitado. É deliberado (conteúdo
  de conversa de cliente não fica no `localStorage`) e precisa estar escrito na tela, não ser descoberto
  pelo atendente.

## Riscos

| Risco | Descrição | Prob. × Impacto | Ações / mitigações |
|---|---|---|---|
| Paridade incompleta | a tela nova esquece mensagem rica, templates ou custo de IA | média × alto | checklist item a item no PR (tarefa 15) + E2E |
| Regressão de contraste no escuro | navy sobre papel escuro perde contraste nas bolhas | média × médio | token check em claro e escuro; gate `axe` nas duas aparências |
| Anexo lento degrada a timeline | muitas imagens pedindo bytes ao proxy ao mesmo tempo | média × médio | `loading="lazy"`, `aspect-ratio` reservado, no máximo 3 downloads simultâneos |
| Mudança de cor da bolha estranha a equipe | a operação está acostumada com laranja | alta × baixo | mostrar a tela ao Lucas antes do PASS; é reversível num token |
| S37/S38 atrasarem | a tela fica pronta sem conteúdo para renderizar | média × médio | a timeline degrada: tipo ausente cai no render de texto, sem quebrar |

## Roadmap da feature

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | portas + adapter + queries (sem tela nova visível) | — |
| 2 | timeline + compositor, montados na rota atrás da tela antiga | 1, S37, S38 |
| 3 | fila com escopo + contexto do cliente + ações | 2 |
| 4 | responsivo, a11y, movimento; troca da rota | 3 |
| 5 | PR de limpeza remove os componentes antigos (**story própria**) | 4 + PASS |

## Questões em aberto

- [ ] **Cor da bolha de saída** — a proposta tira o laranja e usa navy/info. Decisão do Lucas, antes da
      fase 2; é um token, não um refactor.
- [ ] **Largura da fila em 1366 px** — 340 px deixa a conversa com 1026 px. Confirmar na tela real se
      vale 300 px para dar mais respiro à conversa.
- [ ] **Rascunho perdido no F5** — aceitar como está (decisão atual) ou guardar só o texto, sem anexo,
      em `sessionStorage`? Toca privacidade; se mudar, vira linha em `docs/SECURITY_DEBT.md`.

> Decisões difíceis de reverter tomadas aqui → registre como ADR em `docs/adr/`.
