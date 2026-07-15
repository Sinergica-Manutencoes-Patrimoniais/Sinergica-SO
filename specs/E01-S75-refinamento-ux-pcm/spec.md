---
name: refinamento-ux-pcm
description: Contrato — refinamento de UX/visual do PCM: ferramenta em lista com histórico por unidade, detalhe da OS expandível com questionários/fotos, densidade compacta transversal e relatório de horas navegável.
alwaysApply: true
---

# Spec — E01-S75 · Refinamento UX do PCM

> **Fonte da verdade.** Status: pronto para implementar · Tier: **médio (frontend-only, zero
> migration)**. Origem: teste de produção do Lucas (2026-07-14), depois da verificação Playwright
> das stories E01-S68..S74. São 6 pontos de UX/visual apontados por ele.

## Resumo
Seis melhorias transversais de UX no PCM, todas **frontend puro** (React + Tailwind), **sem
migration** e **sem mudança de regra de negócio/RLS/schema**:
1. Ferramentas viram **lista** (não card grid), com drill até a unidade e **histórico de posse por
   unidade** (quem esteve com cada ferramenta, quando) — pra rastrear responsabilidade por dano.
2. Detalhe da OS **maior/expandível** (hoje espremido em 380px, com buraco vazio ao lado).
3. Questionários e fotos da OS **visíveis** no detalhe (dado read-only do Auvo).
4. **Densidade** — cards e botões grandes demais em Ferramentas, Equipamentos, Backlog.
5. Relatório **Apontamento de Horas** com linhas **clicáveis** (cliente → visão 360 no mesmo
   período; técnico → OS do técnico no período).
6. **Polimento visual** on-brand (consistência de cor/classe, hierarquia).

> **Princípio-guia:** o repo já tem um sistema visual denso e coerente (classes compartilhadas em
> `apps/web/src/index.css`; `OrdensServicoPage.tsx` é o benchmark de densidade). Esta story **usa o
> que já existe**, não inventa design novo nem biblioteca.

## Critérios de aceite

### AC-1: Ferramentas em lista + histórico de posse por unidade
- **Dado** um usuário com acesso ao PCM na tela **Ferramentas**
- **Quando** a página carrega
- **Então** as ferramentas aparecem em **lista densa** (não card grid), cada ferramenta expansível
  para suas unidades; cada unidade mostra `codigo` (FER-NNNN), status, com quem está e **desde
  quando** (`atribuidaEm`); e há um botão **"Histórico"** por unidade
- **E quando** o usuário clica em "Histórico" de uma unidade
- **Então** abre um modal com a **timeline de movimentações daquela unidade** (atribuição →
  devolução → atribuição…), cada evento com tipo, nome do funcionário, data e condição — permitindo
  responder "quem estava com a FER-0003 quando quebrou". Usa `listarHistoricoUnidade` (já existe em
  todas as camadas, sem caller de UI hoje)

### AC-2: Detalhe da OS maior e expandível
- **Dado** a tela **Ordens de Serviço** (view "Lista") com uma OS selecionada
- **Quando** o detalhe (`DetalheOs`) é exibido
- **Então** o layout **não deixa uma área grande vazia** ao lado do painel (hoje o painel é
  `self-start` num grid `minmax(520px,1fr)_380px` e sobra buraco), e o detalhe tem **mais largura
  útil**
- **E** há um controle **"Expandir"** no cabeçalho do detalhe que abre a OS completa (Info + todas
  as abas ricas) num **modal grande**, legível, sem espremer

### AC-3: Questionários e fotos visíveis no detalhe da OS
- **Dado** uma OS com `auvo_detalhes` populado (questionários, anexos/fotos, assinatura)
- **Quando** o detalhe é exibido (inline ou expandido)
- **Então** as abas **Questionários** (pergunta→resposta) e **Anexos/Fotos** (miniaturas `<img>`
  reais) ficam **acessíveis e legíveis** — hoje `DetalhesTarefaAuvo` já renderiza isso, mas
  espremido; o ganho é espaço/visibilidade
- **Nota vinculante (fora de escopo de edição):** questionários/fotos são dados do **Auvo** (system
  of record da execução em campo) — **read-only** no PCM. **Não** entram no formulário de edição
  (`NovaOrdemServicoModal`) — editá-los no PCM seria sobrescrito no próximo sync. A melhoria é de
  **visualização**, não de edição

### AC-4: Densidade compacta transversal
- **Dado** as telas de card grid do PCM (Ferramentas, Equipamentos, Backlog GUT, e demais cadastros)
- **Quando** exibidas em desktop
- **Então** cards e botões ficam **mais compactos** — alinhados ao benchmark do `OrdensServicoPage`
  (`py-2`, `text-xs`, botões `h-8`) e às classes compartilhadas já compactas (`.btn-accent`/
  `.btn-secondary` = `h-8`/`text-xs`, `.surface-card`), em vez das variantes grandes hand-rolled
  (`h-9`/`text-sm`, `p-4`) que cada página reimplementa hoje
- **E** mais informação útil cabe na primeira dobra, sem reduzir o corpo abaixo da escala legível

### AC-5: Apontamento de Horas navegável
- **Dado** o relatório **Apontamento de Horas** com um período (De/Até) selecionado
- **Quando** o usuário clica numa linha de **"Horas por cliente"**
- **Então** abre a **visão 360** daquele cliente **já filtrada ao mesmo período** (as OS/backlog
  exibidos respeitam `inicio..fim`)
- **E quando** clica numa linha de **"Horas por técnico"**
- **Então** abre a tela de **Ordens de Serviço filtrada por aquele técnico e período** (OS que ele
  atendeu no intervalo)

### AC-6: Polimento visual on-brand + qualidade
- **Dado** o conjunto de mudanças visuais
- **Quando** renderizadas e os gates rodam
- **Então** a identidade é preservada (navy = estrutura, orange = acento cirúrgico, paper quente,
  Saira p/ números), cores de status/erro deixam de ser hex inline duplicado (usam
  `.status-error`/helper de pill), e testes/typecheck/lint/build/auditoria **não regridem**; um
  smoke autenticado cobre as telas tocadas em desktop

## Casos de borda e erros
- Ferramenta **sem unidades geradas** e unidade **sem histórico** → estado vazio curto, não erro.
- Unidade **baixada** (danificada/perdida) aparece no histórico com a condição e o motivo.
- OS **sem `auvo_detalhes`** (não sincronizada) → abas ricas mostram estado vazio honesto, sem
  quebrar (o dado aparece após re-sync, fora desta story).
- Modal expandido respeita altura disponível e é fechável por teclado (Esc) e clique fora.
- Apontamento: linha **"sem-vínculo"** (cliente/técnico nulo) **não** é clicável (não há destino).
- Tema escuro preserva contraste; nenhum fundo claro literal para estado sem alternativa.

## Fora de escopo
> Vinculante.
- Tornar questionários/fotos do Auvo **editáveis** no PCM (são read-only; ver AC-3).
- Qualquer **migration**, mudança de RLS, Edge Function ou regra de negócio.
- Popular `auvo_detalhes` (isso é sync, não UI) — visibilidade depende de dado já existente.
- Adicionar **filtro por data no gateway** de cliente-360 (o filtro de período do AC-5 é
  **client-side** sobre os dados já carregados; não muda o contrato do adapter/gateway).
- Redesign/biblioteca visual nova; o conceito de **grupo/almoxarifado** (bolsa/maleta como container
  físico) discutido e **adiado** pelo PO — não faz parte desta story.

## Rastreabilidade
- Origem: teste Lucas 2026-07-14; complementa a leva E01-S68..S74 (já mergeada/verificada).
- **Âncoras de arquivo (estado atual, confirmado por exploração):**
  - **Item 1** — `apps/web/src/features/pcm/pages/FerramentasPage.tsx` (card grid `xl:grid-cols-2`
    ~L274; `FerramentaCard` ~L533; unidade expandida ~L625-646, mostra só codigo/status/quem);
    `apps/web/src/features/pcm/infrastructure/supabase-ferramenta-unidades-adapter.ts:116`
    (`listarHistoricoUnidade`, sem caller de UI); render reusável `HistoricoModal` em
    `apps/web/src/features/pcm/pages/FerramentasPorTecnicoPage.tsx:447-494`
    (usa `listarHistoricoFuncionario`); domínio `MovimentacaoFerramentaItem`
    (`domain/ferramenta-unidades.ts:17-28`).
  - **Item 2/3** — `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx` (grid
    `xl:grid-cols-[minmax(520px,1fr)_380px]` :508; painel direito `self-start` :576; `DetalheOs`
    :616; `DetalhesTarefaAuvo` embutido :719-725); `apps/web/src/features/pcm/components/
    DetalhesTarefaAuvo.tsx` (7 abas :31-39; questionários pergunta→resposta :228-250; fotos `<img>`
    :345-372); dado vem de `auvo_detalhes` jsonb (`supabase-hub-os-adapter.ts:53,57,88`); edit em
    `NovaOrdemServicoModal.tsx` (campos básicos :306-439, payload :170-183 — sem Auvo, correto).
  - **Item 4/6** — tokens/classes em `apps/web/src/index.css` (`@theme` L8-32; `.btn-accent`/
    `.btn-secondary` `h-8`/`text-xs` L110-114; `.surface-card` L98; `.input` `h-9` L140;
    `.status-error` L126); páginas grandes: `FerramentasPage.tsx`, `EquipamentosPage.tsx`,
    `BacklogGutPage.tsx` (botões `h-9`/`text-sm`, cards `p-4`); benchmark denso:
    `OrdensServicoPage.tsx`. Tabela hand-rolled de referência: `TiposTarefaPage.tsx:193+`.
  - **Item 5** — `apps/web/src/features/pcm/pages/ApontamentoHorasPage.tsx` (linhas `<li>` não
    clicáveis; `AgregadoHoras.chave` = clienteId / tecnicoFuncionarioId, `domain/apontamento-horas.ts`
    :14-19,90-104; período `inicio`/`fim` no estado); `VisaoClientePage.tsx` (props
    `{clienteId, onAbrirOs}` :63-69, sem filtro de data); `OrdensServicoPage.tsx` (filtros internos
    `FiltrosOrdens`, sem prop de preset :52-62,68); navegação `app/HomePage.tsx` (`PcmView` :109-131,
    `irParaPcmView` :523-527, precedentes de param `clienteSelecionado` :505 e `osDeepLink`
    :512-538).
- **Sem ADR novo** — nada durável/irreversível (frontend, sem schema).
- Termos novos pro glossário, se aplicável: "histórico de posse (ferramenta)".
