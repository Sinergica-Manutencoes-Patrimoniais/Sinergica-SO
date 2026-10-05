---
name: tasks-E01-S162
description: Entregas do drawer operacional de Sistema compartilhado pelo PCM e Cliente 360.
alwaysApply: false
---

# Tasks — E01-S162 Detalhe operacional do Sistema

> Commits: `feat(E01-S162): ...`. Paths relativos a `apps/web/src/features/pcm/`.
> Não criar migration, deploy, OS ou chamada de escrita/Auvo nesta story.

| # | Task | Cobre AC | Gate | Status |
|---|---|---|---|---|
| 1 | Registrar este design e plano canônicos; preservar a composição como estado atual e a manutenção como execução concluída. | AC-1..AC-7 | `pnpm eval:spec` | feito |
| 2 | Criar modelo de domínio do detalhe: fontes de OS, dedupe, divisão aberta/histórico, última manutenção por `finalizado + check_out_at`, plano/ocorrência e componente atual. Cobrir regras com teste puro. | AC-3, AC-4, AC-5, AC-6 | `pnpm --filter @sinergica/web test -- detalhe-sistema` | feito |
| 3 | Criar gateway e adapter Supabase de leitura: resolver Sistema ativo e cliente, membros atuais, OS por fontes locais/Auvo, preventivas e posições próprias. Cada consulta é limitada pelo cliente; conjunto vazio não consulta filhos. | AC-2..AC-7 | `pnpm --filter @sinergica/web test -- supabase-detalhe-sistema` | feito |
| 4 | Criar hook TanStack Query e `DrawerDetalheSistema`, com cadastro, OS abertas, histórico, preventivas e componentes; tratar carregando/vazio/erro por seção, Escape/foco e links PCM/Auvo. | AC-1..AC-7 | `pnpm --filter @sinergica/web test -- DrawerDetalheSistema` | feito |
| 5 | Integrar o mesmo drawer em `SistemasPage` e `PainelSistemasCliente`; preservar composição/edição existentes e desmontar a seleção na troca de cliente. | AC-1, AC-6, AC-7 | `pnpm --filter @sinergica/web test -- SistemasPage PainelSistemasCliente VisaoClientePage` | feito |
| 6 | Rodar gates finais: testes focados, typecheck, `pnpm run ci:local`, `pnpm eval:spec` e `git diff --check`; registrar limitações de E2E autenticado se faltar sessão. | AC-1..AC-7 | comandos acima | bloqueado — Node/pnpm ausentes no ambiente |
| 7 | Registrar ADR-0024 e corrigir regressões adversariais: preservar componentes homônimos por ID, link Auvo apenas para ID positivo, não fechar o Sistema quando um componente sobreposto recebe Escape, não consultar membros ao carregar cadastro e descartar visão de cliente obsoleta. | AC-2..AC-7 | testes de domínio e drawer | feito — aguardando gate do item 6 |

## Divergências (SPEC_DEVIATION)

- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done

- [ ] AC-1..AC-7 verdes por teste/gate (execução bloqueada pela ausência de Node/pnpm)
- [x] Sem query de servidor via `useEffect` nos arquivos novos
- [x] Sem migration, deploy, push ou chamada que crie task Auvo
- [x] ADR-0024 registra o read-model e seus limites
