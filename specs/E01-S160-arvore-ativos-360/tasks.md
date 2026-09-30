---
name: tasks-E01-S160
description: Tasks da E01-S160 — domínio montarArvoreAtivos/filtrarArvore, componente ArvoreAtivos, aba Árvore na 360.
alwaysApply: false
---

# Tasks — E01-S160 Árvore de ativos na Visão 360

> Commits: `feat(E01-S160): ...`. Paths relativos a `apps/web/src/features/pcm/`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Domínio** `domain/arvore-ativos.ts`: tipo `NoArvore` e `montarArvoreAtivos` exatamente pelas regras 1–9 da spec (use `areaEfetiva` de `domain/posicao-ativo.ts`). `arvore-ativos.test.ts`: fixture do AC-1 montada em código (helper `fixtureGuainumbi()`), asserts estruturais por caminho (ex.: raiz → Torre B → filhos contém Sistema Incêndio → filhos = [Hidrante 1, Hidrante 2]); `total` = 10; Componente em Sistema com posição diferente preenche `posicaoDivergente`; desativados fora. | AC-1 | — | `vitest run src/features/pcm/domain/arvore-ativos.test.ts` | todo |
| 2 | **Filtro** puro `filtrarArvore(no, termo)` no mesmo arquivo (normalização sem acento/caixa; mantém ancestrais; `< 2` caracteres devolve o nó intacto). Testes: termo acha Componente dentro de Sistema dentro de Local e devolve o caminho; busca por identificador; nada encontrado → `null`. | AC-3 | 1 | mesmo gate | todo |
| 3 | **Query**: em `application/ativos-cliente-queries.ts`, `useArvoreAtivos(cliente)` compõe os hooks existentes (áreas, locais, sistemas, componentes, membros) e devolve `{ data: NoArvore \| undefined, isLoading, error, refetch }` usando `useMemo(() => montarArvoreAtivos(...))`. Sem query nova no servidor (AC-5). Se algum hook ainda não existir (S159 não mergeada), crie-o aqui no mesmo padrão. | AC-5 | 1 | typecheck | todo |
| 4 | **UI** `components/ArvoreAtivos.tsx`: linha recursiva `NoArvoreLinha` que só renderiza `filhos` quando expandido (AC-5); estado de expansão em `Set<string>` (`useState`, estado de UI); toolbar com busca + "Expandir tudo"/"Recolher tudo"; estilos do AC-2 (tokens, sem hex); clique em Componente abre `DrawerDetalheAtivo` (veja como `BoardAtivos.tsx` abre o drawer e copie a integração). Teste `ArvoreAtivos.test.tsx`: recolhido não renderiza filhos; busca expande o caminho; clique em componente chama o handler do drawer. | AC-2, AC-3, AC-4, AC-5 | 2, 3 | `vitest run src/features/pcm/components/ArvoreAtivos.test.tsx` | todo |
| 5 | **Aba**: em `pages/VisaoClientePage.tsx`, `Aba360` ganha `"arvore"`, `ABAS` ganha `{ id: "arvore", label: "Árvore", icon: Network }` na posição do AC-2, e o render ganha `{aba === "arvore" && <ArvoreAtivos clienteId={cliente.id} clienteNome={cliente.nome} />}`. | AC-2 | 4 | typecheck + `pnpm run ci:local` | todo |
| 6 | **E2E** `apps/web/e2e/arvore-ativos.spec.ts` (cliente de teste com 1 Área > 1 Local, 1 Sistema no Local com 1 Componente): a aba mostra o caminho; recolher esconde; buscar o componente mostra o caminho expandido; clique abre o drawer. Cleanup via `limpeza-e2e.ts`. | AC-2, AC-3, AC-4 | 5 | `pnpm --filter @sinergica/web run test:e2e arvore-ativos` | todo |

## Plano de teste
- Unidade: montagem + filtro (fixture do diagrama).
- Componente: render recolhido/expandido/busca.
- Aceite: E2E (task 6).

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes · `ci:local` · E2E verde
- [ ] ROADMAP · STATE
