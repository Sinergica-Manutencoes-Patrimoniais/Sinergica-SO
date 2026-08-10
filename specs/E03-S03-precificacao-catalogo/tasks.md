---
name: tasks
description: Decomposição e gates — motor de precificação, parâmetros, níveis de técnico e catálogo de materiais.
alwaysApply: false
---

# Tasks — E03-S03 · Precificação + catálogo de materiais

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S03-precificacao-catalogo`.
> **Story-ilha** — pode correr em paralelo com a E03-S01. Se for a primeira a mergear, ela cria o
> `grant usage` no schema `comercial`; se a S01 já mergeou, reusa. A migration deve ser escrita
> para ser idempotente nesse ponto (`create schema if not exists` / `grant` repetível).

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Task obrigatória antes de codar o motor**: confirmar por query read-only em produção o estado de `financeiro.custos_funcionario` (tem linha? quais níveis?) e de `financeiro.config_impostos` (`tipo`, faixas ainda no seed?). Registrar o achado aqui — o AC-4 e o AC-6 dependem do que existe de verdade | AC-4, AC-6 | — | `supabase db query --linked` (read-only) | todo |
| 2 | Migration `NNNN_E03-S03_precificacao.sql`: `parametros_preco` (singleton `check (id = 1)`, inclui `mo_inclui_inss_patronal`), `niveis_tecnico`, `materiais`; RLS FORCE + policies por `user_modulos.comercial`; seed de 1 linha em `parametros_preco` com valores neutros e comentário "confirmar com o PO" | AC-1, AC-9 | — | `pnpm run lint:migrations` | todo |
| 3 | `domain/precificacao.ts`: `calcularCusto`, `calcularPreco`, `calcularPiso`, `calcularDescontoMaximo`, `precoValido` — **puras**, centavos inteiros, erro de domínio explícito para alíquota ≥ 1 e margem negativa. Unit tests com os casos da spec (margem 0, alíquota 0, alíquota 1, custo 0, arredondamento) | AC-2, AC-7 | — | `pnpm run test` | todo |
| 4 | RPC no Financeiro para o Comercial ler custo/hora médio por nível — `security definer` **com guarda manual de permissão** (padrão `fn_rentabilidade_cliente_mes` da E04-S06). O Comercial nunca faz `select` em `financeiro.*` | AC-3 | 2 | `pnpm run lint:migrations` | todo |
| 5 | `application/precificacao-gateway.ts` + adapter: lê custo de MO (RPC da task 4) e alíquota efetiva (RPC/config do Financeiro), com **fallback para `niveis_tecnico`** e flag de "custo estimado" viajando até a UI | AC-3, AC-4, AC-5 | 3, 4 | `pnpm run test` | todo |
| 6 | `ParametrosPrecoPage`: edição do singleton, campo `mo_inclui_inss_patronal` com a explicação Anexo III × IV, exibição da **alíquota vigente e sua origem**, aviso quando as faixas ainda são o seed da E04-S10 | AC-5, AC-6, AC-9 | 5 | `pnpm run test` | todo |
| 7 | `NiveisTecnicoPage` + `MateriaisPage`: CRUD, markup por material com herança do padrão, desativar em vez de excluir | AC-8 | 5 | `pnpm run test` | todo |
| 8 | Navegação: itens sob COMERCIAL na sidebar com gate `podeAcessar('comercial', ...)`; se a S01 ainda não mergeou, criar o grupo (idempotente com a task 10 da S01) | AC-1 | 6, 7 | `pnpm run test` | todo |
| 9 | pgTAP `supabase/tests/comercial_precificacao_rls.test.sql`: RLS das 3 tabelas nos 4 perfis, singleton recusando a 2ª linha, RPC de custo negando sem permissão | AC-1 | 2, 4 | CI `db-tests` | todo |
| 10 | `pnpm run ci:local` + Playwright (dev server local): editar parâmetros, cadastrar nível e material, ver preço/piso/desconto calculados e o aviso de custo estimado + ROADMAP/STATE | todos | 1–9 | `pnpm run ci:local` | todo |

## Plano de teste
- **Unit (o coração desta story)**: a fórmula com margem 0, alíquota 0, alíquota 1 (erro), custo 0,
  margem negativa (erro) e um caso realista conferido na mão. Arredondamento em centavos: garantir
  que `preço − piso` nunca fica negativo por erro de ponto flutuante.
- **pgTAP**: singleton (2ª linha recusada) e a guarda de permissão da RPC.
- **Playwright**: o aviso de "custo estimado" precisa aparecer de verdade quando não há custo
  cadastrado — é o comportamento honesto do AC-4.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| `financeiro.custos_funcionario` vazia em produção | Task 1 confirma antes; AC-4 já define o fallback com aviso |
| Alíquota errada (Anexo III × IV) contaminar toda proposta | Fonte única no Financeiro + AC-6 avisa quando não confirmada; nunca constante no código |
| INSS patronal contado duas vezes | `mo_inclui_inss_patronal` (AC-9), conferido uma vez na task 1 |
| Float acumulando centavo | Domínio em inteiros; arredondar só na exibição (task 3) |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Revisão adversarial (borda: alíquota 100%, margem 0, catálogo vazio)
- [ ] ROADMAP/STATE atualizados · glossário conferido (**Piso** já registrado)
