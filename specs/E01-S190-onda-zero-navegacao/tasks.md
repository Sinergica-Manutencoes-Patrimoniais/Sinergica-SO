---
name: tasks
description: Decomposição e gates de E01-S190. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E01-S190 · Onda Zero, navegação consolidada

Detalhe técnico em `plan.md`. Desbloqueada em 17/11/2026 pelas respostas 26/27 do Fabrício.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `scripts/inventariar-navegacao.mjs` — ações alcançáveis por perfil (linha de base ANTES) | AC-7 | — | `node scripts/inventariar-navegacao.mjs > /tmp/nav-antes.txt` | done — ver nota de limitação na task 15 |
| 2 | Extrair a árvore de `HomePage.tsx` para `navegacao-sso.ts` **sem mudar rótulo nenhum** | — | — | `cd apps/web && pnpm vitest run src/app/navegacao-sso.test.ts` + inventário idêntico ao da task 1 | done — feito junto com a task 4 (ver nota), não em dois commits separados |
| 3 | `navegacaoVisivel` pura — ocultar por permissão/capacidade, nunca lista fixa por papel | AC-6 | 2 | `cd apps/web && pnpm vitest run src/app/navegacao-sso.test.ts` | done |
| 4 | Reorganizar em Trabalho / Gestão / Administração conforme a tabela do `plan.md` | AC-4, AC-5 | 3 | `cd apps/web && pnpm vitest run src/app` | done |
| 5 | `rotas-legadas.ts` + teste de tabela cobrindo toda view do inventário | AC-3 | 2 | `cd apps/web && pnpm vitest run src/app/rotas-legadas.test.ts` | done — mapa nasce vazio por decisão documentada no próprio arquivo (nenhuma view foi removida, só reagrupada; não há URL sincronizada com `pcmView` hoje) |
| 6 | Migration aditiva: tipo de Inspeção `diagnostico_inicial_cliente` + classificação dos Assessments existentes | AC-1 | — | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | done — migration 1854 |
| 7 | Migration aditiva: `modalidade='pmoc'` no Plano de Manutenção + visão filtrada | AC-2 | — | pgTAP da task 6 | done — migration 1855. Sem backfill (ver nota na própria migration): classificar planos já vinculados por E01-S166 é trabalho de domínio, fora do escopo de reorganização de menu |
| 8 | pgTAP: identidade, histórico e evidência preservados na classificação (permitido e negado, RLS FORCE) | AC-1, AC-2 | 6, 7 | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | done — 12/12 assertions, mais suíte completa (269 arquivos, 3383 testes) sem regressão. **CLI 2.114.0 obrigatório** (2.115-2.119 reproduz supabase/cli#6347, mesma trava documentada em `ci.yml`) |
| 9 | Retirar Assessment e PMOC do menu; Inspeções e Planos passam a contê-los | AC-1, AC-2, AC-4 | 4, 6, 7 | `cd apps/web && pnpm vitest run src/app` | done — Assessment vira filho de "Inspeções" (`AssessmentPage` intacta — já tinha as mesmas ações de `InspecoesPage`, incluindo importar questionário Auvo, que `InspecoesPage` não tem); PMOC migra pro grupo PLANOS, `PmocPage` intacta |
| 10 | Absorver Agenda do Técnico em "Planejamento e Visitas"; unificar Ferramentas em "Equipes e Recursos" | AC-4 | 4 | inventário antes/depois sem perda | done |
| 11 | `PesquisaGlobalEstrutura.tsx` — resultado identifica o tipo de cada entidade | AC-9 | 4 | `cd apps/web && pnpm vitest run src/features/pcm/interfaces/estrutura` | **parcial, documentado** — `ArvoreAtivos.tsx`/`montarArvoreAtivos` (domain) já tem busca com `NoArvore.tipo` distinguindo cliente/area/local/sistema/componente (satisfaz 4 dos 5 tipos do AC-9), reusado dentro de "Clientes e Estrutura" via `VisaoClientePage`. **Gap real:** Grupo quantitativo não entra na árvore hoje — `GrupoQuantitativo` (estrutura-tecnica-gateway.ts) só tem endpoint paginado para catálogo, não um "todos os grupos do cliente" como `listarPorCliente` tem para Componentes; adicionar exigiria RPC nova (migration) ou loop de paginação no client. Não entrou nesta rodada — nenhum componente novo foi criado (nenhum `PesquisaGlobalEstrutura.tsx`), por decisão de não abrir mais uma frente de migration dentro de uma story de reorganização de menu. Pendência registrada aqui, não escondida |
| 12 | Jornada Visão 360 → Área → Local → Sistema → Equipamento → Componente/Grupo, cada nível na tela da sua entidade | AC-10 | 11 | teste de componente da jornada | **já satisfeita por código pré-existente** — `VisaoClientePage.tsx` (Cliente 360) já tem a aba "árvore" com `ArvoreAtivos`, drill-down Área→Local→Sistema→Componente. Mesmo gap de Grupo quantitativo da task 11 |
| 13 | Catálogos administrativos (tipos, categorias, segmentos, palavras-chave) para Administração, com guarda de rota | AC-5, AC-6 | 4 | `cd apps/web && pnpm vitest run src/app` + acesso por URL negado | done — guarda real no CONTEÚDO (`VIEWS_ADMINISTRATIVAS.has(pcmView) && !podeGerenciarConfig`), não só a sidebar escondendo o botão (defesa em profundidade) |
| 14 | Glossário: "Diagnóstico Inicial do Cliente" e "PMOC (modalidade)" — já escritos em 17/11; conferir sinônimo histórico | AC-8 | 6, 7 | revisão humana | done — termos já em `docs/glossary.md` desde a confronto do Pacote Consolidado (17/11) |
| 15 | Inventário DEPOIS + diff no corpo do PR; qualquer ação sumida vira decisão registrada | AC-7 | 9–13 | `diff /tmp/nav-antes.txt /tmp/nav-depois.txt` anexado ao PR | done, com ressalva — a prova RIGOROSA é `navegacao-sso.test.ts` ("AC-7 — nenhuma view do menu original desapareceu"), que lista as 26 views originais do `PCM_NAV` e assert cada uma continua alcançável via `todasAsViews()`. O script `inventariar-navegacao.mjs` é só um artefato de apoio — seu parser é single-level e confunde `filhos` aninhados (bug conhecido, não corrigido: baixo valor de investimento pra um script de inventário manual) |
| 16 | `/revisao-adversarial` — tier arquitetural por tocar classificação de dado em produção | — | 8, 15 | achado reproduzido vira teste | todo — pendente antes do PASS final desta story |

## Definition of Done

- Menu do Operador PCM cabe sem rolagem e nenhuma entrada é catálogo administrativo (SC-001).
- Nenhum Assessment ou PMOC perde identidade, histórico ou evidência (SC-002).
- Toda rota antiga responde redirecionada, nunca quebrada (SC-003).
- Diff de ações alcançáveis por perfil sem perda não decidida (SC-004).
- **Nenhuma tabela de estrutura fundida** — conferido no diff de migration.
- CI verde, `db-tests` não pulado.
- Pendente: `/revisao-adversarial` (task 16) e o gap de Grupo quantitativo na pesquisa/jornada (tasks 11-12).
