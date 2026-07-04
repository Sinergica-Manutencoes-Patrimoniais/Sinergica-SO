---
name: tasks-E01-S18-abertura-manual-os-pcm
description: Tasks da abertura manual de OS no PCM.
alwaysApply: false
---

# Tasks — E01-S18 Abertura Manual de OS no PCM

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Domain puro: opções de categoria/tipo Auvo/origem, cálculo GUT e sugestão de prioridade | AC-3 | `pnpm test` | done |
| 2 | Application gateway/caso de uso para listar dados do formulário e criar OS | AC-2, AC-4, AC-5 | `pnpm run typecheck` | done |
| 3 | Adapter Supabase para `pcm.clientes`, `pcm.tecnicos_cache`, `pcm.ordens_servico` | AC-2, AC-4, AC-5 | `pnpm run typecheck` | done |
| 4 | UI `NovaOrdemServicoModal` com selects e estados de erro/salvando | AC-1..AC-5 | `pnpm run build` | done |
| 5 | Wiring no dashboard PCM com gate de escrita | AC-1 | `pnpm run build` | done |
| 6 | Atualizar ROADMAP/STATE | — | `pnpm run audit:esteira` | done |

## Resultado
- Adicionado botão "Nova OS" no dashboard PCM, visível só para quem tem escrita no módulo.
- Criado `NovaOrdemServicoModal` com cliente, solicitante, título, descrição, categoria, origem,
  prioridade, GUT, tipo Auvo, técnico, localização e data prevista.
- Categoria sugere tipo Auvo; GUT sugere prioridade; prioridade/tipo podem ser sobrescritos.
- Criação persiste em `pcm.ordens_servico` com `status='solicitacao'`.

## Gates rodados
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm test` ✅ (103 passed, 9 skipped)
- `pnpm run build` ✅ (warning conhecido de chunk >500k)

## Ressalvas
- Sem migration nova; `tipoAuvo`, técnico selecionado e data prevista são preservados na
  `descricao` até existir schema próprio de Hub de OS/despacho.
- Geração `CH-XXX` por contagem segue o MVP já usado no fluxo do Zé; sequence/RPC transacional fica
  recomendada quando o Hub de OS amadurecer.

## Revisão adversarial esperada
- Usuário sem escrita não vê botão.
- Cliente/título/categoria obrigatórios bloqueiam submit.
- Prioridade sugerida pode ser sobrescrita.
- Falha de banco não limpa campos.
