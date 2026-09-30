---
name: tasks-E01-S159
description: Tasks da E01-S159 — abas Componentes/Sistemas/Ferramentas com CRUD na Visão 360, extração de SistemaModal e PainelFerramentasCliente, TanStack Query.
alwaysApply: false
---

# Tasks — E01-S159 Cadastro completo na Visão 360

> Commits: `feat(E01-S159): ...`. Paths relativos a `apps/web/src/features/pcm/`.
> Regra: dado de servidor **só** via TanStack Query (`CLAUDE.md`). Nada de `useEffect` + `carregar()`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Gateway/adapter**: `EquipamentosGateway.listarPorCliente(clienteId): Promise<EquipamentoItem[]>` (filtro no servidor, `deleted_at is null`, ordem por nome, `clienteNome` preenchido com 1 select do cliente). `SistemasGateway.listarMembrosDoCliente(clienteId): Promise<Array<{ sistemaId: string; itemId: string }>>` (join `sistema_itens` → `sistemas.cliente_id`). | AC-1, AC-3 | — | typecheck | feito |
| 2 | **Queries** em `application/ativos-cliente-queries.ts`: chaves `componentes(c)`, `sistemas(c)`, `membrosSistemas(c)`, `ferramentasAlocadas(c)`, `ferramentasDisponiveis()`; hooks `useComponentesDoCliente`, `useSistemasDoCliente`, `useMembrosSistemasDoCliente`, `useFerramentasAlocadas`, `useFerramentasDisponiveis`; mutations `useCriarComponente`, `useEditarComponente`, `useDesativarComponente`, `useCriarSistema`, `useEditarSistema`, `useDesativarSistema`, `useAlocarFerramenta`, `useDevolverFerramenta`. Cada uma invalida as chaves afetadas (componente ⇒ `componentes` + `membrosSistemas`; sistema ⇒ `sistemas` + `membrosSistemas`). As mutations chamam os casos de uso de `application/` (nunca o adapter direto). | AC-1, AC-3, AC-5 | 1 | typecheck | feito |
| 3 | **`desativarSistema`** (`application/sistemas.ts`): antes de `gateway.desativar`, remove todos os membros (`listarItensDoSistema` + `removerItem` em `Promise.all`). Teste com gateway fake: remove membros e depois desativa. | AC-4 | — | `vitest run src/features/pcm/application/sistemas.test.ts` | feito |
| 4 | **Extrair `SistemaModal`** de `pages/SistemasPage.tsx` para `components/SistemaModal.tsx`, com prop `clienteFixoId?: string` (esconde o select de cliente). `SistemasPage` passa a importar dali, sem mudar comportamento. | AC-3 | — | typecheck + `pnpm --filter @sinergica/web run test:e2e hierarquia-sistemas` (regressão) | feito local; E2E no lote |
| 5 | **`EquipamentoModal`**: prop `clienteFixoId?: string` (esconde o select de cliente e usa o id fixo). | AC-1 | — | typecheck | feito |
| 6 | **Aba Componentes**: reescrever `components/PainelItensDoCliente.tsx` (mantém o nome do arquivo) como a lista do AC-1: busca, colunas, "Novo componente", "Editar", "Desativar" (reaproveite o `ConfirmDialog` e o texto de `EquipamentosPage` L269–L280), tudo via hooks da task 2. Posição: calcule o texto com `areaEfetiva` + árvore de locais (hooks `useAreasDoCliente`/`useLocaisDoCliente` da S155). Sistema: mapa `itemId → sistemaNome` a partir de `useMembrosSistemasDoCliente` + `useSistemasDoCliente`. Estado vazio: "Nenhum componente cadastrado para este cliente." | AC-1 | 2, 5 | `vitest run src/features/pcm/components/PainelItensDoCliente.test.tsx` (render com QueryClient de teste + dados fake: filtra por busca, esconde botões sem escrita) | todo |
| 7 | **Auvo recolhido**: em `VisaoClientePage.tsx` (aba `ativos`), envolva `PainelEquipamentos` num `<details>` fechado com `<summary>` "Equipamentos no Auvo (somente leitura)". | AC-2 | — | typecheck | todo |
| 8 | **Aba Sistemas**: `components/PainelSistemasCliente.tsx` ganha "Novo sistema", "Editar", "Desativar" (confirmação com o texto literal do AC-3) e as colunas do AC-3, via hooks da task 2. "Compor itens" continua como está. | AC-3, AC-4 | 2, 3, 4 | typecheck | todo |
| 9 | **Aba Ferramentas**: extrair `PainelFerramentasCliente` e `AlocarFerramentaModal` de `VisaoClientePage.tsx` (~L871–L1060) para `components/PainelFerramentasCliente.tsx`, trocando o carregamento manual pelos hooks da task 2. Em `VisaoClientePage.tsx`: `Aba360` ganha `"ferramentas"`, `ABAS` ganha `{ id: "ferramentas", label: "Ferramentas", icon: Package }`, o render ganha `{aba === "ferramentas" && <PainelFerramentasCliente .../>}` e a linha ~L533 (Resumo) é removida. | AC-5 | 2 | typecheck | todo |
| 10 | **Ordem e rótulos das abas** conforme AC-6 (`ABAS` em `VisaoClientePage.tsx` ~L110): label "Ativos" → "Componentes". | AC-1, AC-6 | 9 | typecheck | todo |
| 11 | **E2E** `apps/web/e2e/cadastro-ativos-360.spec.ts` (cliente de teste): cria Sistema e Componente pela 360, vê o Componente na lista com o Sistema depois de compor, desativa o Sistema e o Componente fica sem Sistema, abre aba Ferramentas. Cleanup via `limpeza-e2e.ts`. | AC-1, AC-3, AC-4, AC-5 | 6, 8, 9 | `pnpm --filter @sinergica/web run test:e2e cadastro-ativos-360` | todo |

## Plano de teste
- Unidade: `desativarSistema`, `PainelItensDoCliente` com dados fake.
- Regressão: `hierarquia-sistemas.spec.ts`, `board-ativos.spec.ts`, `ferramentas.spec.ts`.
- Aceite: E2E (task 11).

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-6 verdes · `ci:local` · E2E novos e de regressão verdes
- [ ] Nenhum `useEffect` buscando dado de servidor nos arquivos tocados (`rg -n "useEffect" components/PainelItensDoCliente.tsx components/PainelSistemasCliente.tsx components/PainelFerramentasCliente.tsx`)
- [ ] ROADMAP · STATE
