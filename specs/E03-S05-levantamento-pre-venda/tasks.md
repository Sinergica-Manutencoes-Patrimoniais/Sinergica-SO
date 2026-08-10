---
name: tasks
description: Decomposição e gates — levantamento de pré-venda reusando o Assessment do PCM.
alwaysApply: false
---

# Tasks — E03-S05 · Levantamento de pré-venda

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S05-levantamento-pre-venda`. **Depende de S01 e S04 mergeadas.**
> Esta story **consome** o Assessment do PCM — não altera a tela de coleta.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Task obrigatória antes de codar**: mapear em produção como o Assessment é criado hoje (`pcm.inspecoes` com `e_assessment=true`, valores reais de `motivo_assessment`, campos obrigatórios, vínculo com `tipo_inspecao_id`). Confirmar se cabe um motivo de pré-venda ou se precisa de valor novo | AC-1 | — | `supabase db query --linked` (read-only) | todo |
| 2 | Migration (se a task 1 indicar necessidade): novo valor de `motivo_assessment` para pré-venda + RPC `pcm.fn_criar_assessment_pre_venda(cliente_id, ...)` `security definer` com guarda de permissão — **a interface publicada pelo PCM** (R2) | AC-1, AC-2 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Coluna/relação `propostas.assessment_id` já prevista na S04 — validar FK para `pcm.inspecoes` (padrão `not valid` + `validate` em migration separada, como 0139/0140) | AC-4 | 2 | `pnpm run lint:migrations` | todo |
| 4 | `application/`: caso de uso "criar levantamento a partir da oportunidade" (chama a RPC da task 2) e "listar assessments da Conta" — adapter nunca faz `select` direto em `pcm.inspecoes` | AC-1, AC-2 | 2 | `pnpm run test` | todo |
| 5 | `domain/importacao-levantamento.ts`: converter itens do Assessment em itens de proposta **acrescentando** aos existentes (nunca sobrescrever), com contagem do que entrou — pura + unit tests | AC-5 | — | `pnpm run test` | todo |
| 6 | Editor de proposta (S04): seletor de Assessment **da mesma Conta**, botão "importar itens" com aviso de quantos entraram, indicador de levantamento em andamento | AC-4, AC-5, AC-6 | 4, 5 | `pnpm run test` | todo |
| 7 | Atalho "novo levantamento" na oportunidade + exibição do levantamento na aba Comercial da Visão 360, com link para o Assessment completo | AC-1, AC-7 | 4 | `pnpm run test` | todo |
| 8 | Tratamento de Assessment indisponível (excluído/arquivado) — proposta mantém os itens importados e marca o vínculo como indisponível, sem quebrar a tela | AC-4 | 6 | `pnpm run test` | todo |
| 9 | `pnpm run ci:local` + Playwright (dev server local): oportunidade→novo levantamento→preencher no Assessment→vincular na proposta→importar (acrescenta, não sobrescreve) + ROADMAP/STATE | todos | 1–8 | `pnpm run ci:local` | todo |

## Plano de teste
- **Unit**: a importação é o ponto de risco — testar com proposta já preenchida (AC-5), com
  Assessment vazio, e com item duplicado (entra mesmo assim, o usuário decide o que apagar).
- **Playwright**: o fluxo inteiro de ponta a ponta é o que prova que o reuso funcionou sem tela
  nova de coleta.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Acoplar Comercial ao PCM por `select` direto | AC-2 exige RPC publicada; revisão adversarial confere |
| Importação sobrescrevendo composição já trabalhada | AC-5 + unit test com proposta preenchida |
| Assessment do PCM mudar e quebrar a importação | Consumo por interface publicada (task 2), não por leitura de tabela |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Revisão adversarial (borda: assessment de outra Conta, assessment vazio, vínculo indisponível)
- [ ] ROADMAP/STATE atualizados · glossário conferido (**Levantamento**)
