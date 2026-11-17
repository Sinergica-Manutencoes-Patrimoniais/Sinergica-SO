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
| 1 | `scripts/inventariar-navegacao.mjs` — ações alcançáveis por perfil (linha de base ANTES) | AC-7 | — | `node scripts/inventariar-navegacao.mjs > /tmp/nav-antes.txt` | todo |
| 2 | Extrair a árvore de `HomePage.tsx` para `navegacao-sso.ts` **sem mudar rótulo nenhum** | — | — | `cd apps/web && pnpm vitest run src/app/navegacao-sso.test.ts` + inventário idêntico ao da task 1 | todo |
| 3 | `navegacaoVisivel` pura — ocultar por permissão/capacidade, nunca lista fixa por papel | AC-6 | 2 | `cd apps/web && pnpm vitest run src/app/navegacao-sso.test.ts` | todo |
| 4 | Reorganizar em Trabalho / Gestão / Administração conforme a tabela do `plan.md` | AC-4, AC-5 | 3 | `cd apps/web && pnpm vitest run src/app` | todo |
| 5 | `rotas-legadas.ts` + teste de tabela cobrindo toda view do inventário | AC-3 | 2 | `cd apps/web && pnpm vitest run src/app/rotas-legadas.test.ts` | todo |
| 6 | Migration aditiva: tipo de Inspeção `diagnostico_inicial_cliente` + classificação dos Assessments existentes | AC-1 | — | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | todo |
| 7 | Migration aditiva: `modalidade='pmoc'` no Plano de Manutenção + visão filtrada | AC-2 | — | pgTAP da task 6 | todo |
| 8 | pgTAP: identidade, histórico e evidência preservados na classificação (permitido e negado, RLS FORCE) | AC-1, AC-2 | 6, 7 | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | todo |
| 9 | Retirar Assessment e PMOC do menu; Inspeções e Planos passam a contê-los | AC-1, AC-2, AC-4 | 4, 6, 7 | `cd apps/web && pnpm vitest run src/app` | todo |
| 10 | Absorver Agenda do Técnico em "Planejamento e Visitas"; unificar Ferramentas em "Equipes e Recursos" | AC-4 | 4 | inventário antes/depois sem perda | todo |
| 11 | `PesquisaGlobalEstrutura.tsx` — resultado identifica o tipo de cada entidade | AC-9 | 4 | `cd apps/web && pnpm vitest run src/features/pcm/interfaces/estrutura` | todo |
| 12 | Jornada Visão 360 → Área → Local → Sistema → Equipamento → Componente/Grupo, cada nível na tela da sua entidade | AC-10 | 11 | teste de componente da jornada | todo |
| 13 | Catálogos administrativos (tipos, categorias, segmentos, palavras-chave) para Administração, com guarda de rota | AC-5, AC-6 | 4 | `cd apps/web && pnpm vitest run src/app` + acesso por URL negado | todo |
| 14 | Glossário: "Diagnóstico Inicial do Cliente" e "PMOC (modalidade)" — já escritos em 17/11; conferir sinônimo histórico | AC-8 | 6, 7 | revisão humana | todo |
| 15 | Inventário DEPOIS + diff no corpo do PR; qualquer ação sumida vira decisão registrada | AC-7 | 9–13 | `diff /tmp/nav-antes.txt /tmp/nav-depois.txt` anexado ao PR | todo |
| 16 | `/revisao-adversarial` — tier arquitetural por tocar classificação de dado em produção | — | 8, 15 | achado reproduzido vira teste | todo |

## Definition of Done

- Menu do Operador PCM cabe sem rolagem e nenhuma entrada é catálogo administrativo (SC-001).
- Nenhum Assessment ou PMOC perde identidade, histórico ou evidência (SC-002).
- Toda rota antiga responde redirecionada, nunca quebrada (SC-003).
- Diff de ações alcançáveis por perfil sem perda não decidida (SC-004).
- **Nenhuma tabela de estrutura fundida** — conferido no diff de migration.
- CI verde, `db-tests` não pulado.
