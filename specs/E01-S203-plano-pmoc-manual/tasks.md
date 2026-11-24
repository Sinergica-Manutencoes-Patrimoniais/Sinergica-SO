---
name: tasks
description: "Decomposição e gates de E01-S203. Puxe ao implementar."
alwaysApply: false
---

# Tasks — E01-S203 · Plano PMOC criado à mão pelo PCM

Detalhe técnico em `plan.md`. Decisão em `docs/adr/1698-plano-pmoc-criado-a-mao-pelo-pcm.md`.

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Inventário das tabelas PMOC (`0023`), do Plano (`0260`/`1869`) e das pontes (`0337`, `1631`); conclusão registrada | AC-1 | relatório no `plan.md` | **done** — 7 tabelas PMOC, zero FK para `planos_manutencao` |
| 2 | Avaliar reuso de `pcm.sso_vinculos_ciclo_pmoc` antes de criar tabela; registrar o veredito | AC-1 | `plan.md` §2 + ADR-1698 §2 | **done** — não serve (exige Plano, versão aprovada, proposta e decisão; cardinalidade por ciclo) |
| 3 | Migration `1871`: vínculo `pcm.sso_vinculos_plano_contrato_pmoc`, unicidade dos dois lados, RLS FORCE, append-only | AC-1, AC-2, AC-10 | `node scripts/lint-migrations.mjs` | **done** — aditiva, reverso no cabeçalho |
| 4 | Migration `1871`: RPC `sso_criar_plano_do_contrato_pmoc` — herança derivável, idempotência por `request_id` em `pcm.plano_comandos`, gate/capacidade reusados, `audit.events` | AC-3, AC-4, AC-6, AC-8, AC-9 | `node scripts/lint-migrations.mjs` | **done** — sem gate, capacidade ou livro novos |
| 5 | Travas da criação humana: `auth.uid()`, `p_confirma_criacao`, `revoke execute` de `service_role` e `anon`; nenhuma criação em massa na migration | AC-5 | pgTAP da task 7 | **done** |
| 6 | Migration `1871`: indicador `sso_listar_contratos_pmoc_sem_plano` + `sso_resumir_cobertura_plano_pmoc`, com os órfãos contados à parte | AC-7, AC-9 | `node scripts/lint-migrations.mjs` | **done** |
| 7 | pgTAP `E01-S203_plano_pmoc_manual.test.sql`: permitido e negado, gate fechado nomeado, duplicidade recusada, idempotência, Contrato intacto, RLS FORCE | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 | `npx supabase test db supabase/tests/E01-S203_*.test.sql` | **done** — 43 asserções verdes |
| 8 | `domain/plano-pmoc-manual.ts` puro: progresso, nome sugerido igual ao da RPC, cinco frases distintas, recusas nomeadas em português | AC-3, AC-7, AC-F4 | `pnpm vitest run src/features/pcm/domain/plano-pmoc-manual.test.ts` | **done** — 10/10 verdes |
| 9 | Adapter com Zod `.strict()`, recibo conferido contra o pedido, chaves em `application/` | AC-3, AC-4, AC-8, AC-F5 | `pnpm vitest run src/features/pcm/infrastructure/supabase-plano-pmoc-adapter.test.ts` · `pnpm run typecheck` | **done** — 8/8 verdes; recibo com `rotinasCriadas ≠ 0` é recusado |
| 10 | Tela `ContratosPmocSemPlano` dentro do Workspace de Planos, atrás da flag, com confirmação antes de criar e invalidação das chaves | AC-F1, AC-F3, AC-F5 | `pnpm run typecheck` · `pnpm run arch:check` | **done** |
| 11 | Flag `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED` no registro, `.env.example` e `netlify.toml`, `false` explícito | AC-F2 | `node scripts/check-flags-declaradas.mjs` | **done** |
| 12 | PMOC permanece no menu: `VIEWS_CONSOLIDADAS` intocada, comentário da `navegacao-sso.ts` atualizado para apontar a resposta | AC-11 | `pnpm vitest run` (testes de navegação) | **done** |
| 13 | ADR-1698 registrando a decisão (b) e referenciando a ADR-1697 (sem editá-la) | AC-1, AC-5 | revisão humana | **done** |
| 14 | Revisão adversarial do tier arquitetural; achado reproduzido vira teste | — | `/revisao-adversarial` | **done** — ver §Revisão adversarial |

## Definition of Done

- pgTAP com permitido **e** negado (SC-001); migration que não cria Plano e Contrato intacto
  provados (SC-002); duplicidade e idempotência provadas (SC-003); indicador andando (SC-004).
- Migration sequencial (`1871`), aditiva, com decisão e reverso no cabeçalho. Sem `DROP`.
- Sem `return null` silencioso: desligado, gate fechado, sem permissão, "nenhum contrato pendente"
  e "Cliente sem PMOC" têm frases diferentes.
- CI verde.

## Revisão adversarial — o que foi tentado e o que virou teste

1. *"A RPC pode ser chamada por um job?"* — `service_role` tinha `execute` por herança do padrão;
   foi explicitamente revogado e virou asserção (`has_function_privilege('service_role', …)`).
2. *"Dois cliques simultâneos criam dois Planos?"* — lock por `request_id` **e** por contrato, mais
   `unique` em `contrato_pmoc_id`; asserções de idempotência e de `contrato_pmoc_ja_tem_plano`.
3. *"O indicador pode chegar a zero mentindo?"* — contratos em imóvel sem Cliente somem de qualquer
   recorte por Cliente; viraram coluna própria (`contratos_sem_cliente`) e asserção.
4. *"O recibo pode esconder uma migração de conteúdo?"* — `rotinasCriadas` entrou no recibo, o
   adapter recusa valor diferente de 0 e o pgTAP conta `pcm.rotinas_manutencao` do Plano criado.
5. *"Contrato soft-deleted ressuscita como Plano?"* — recusado com `contrato_pmoc_indisponivel`,
   com asserção própria.
6. *"O vínculo pode ser reescrito para apontar para outro Plano?"* — append-only pelo gatilho de
   `0327`; `update` e `delete` recusados com `conferencia_imutavel`, ambos com asserção.

## Rastreabilidade AC→task (completa)

Lista literal para a auditoria (`eval:spec`), que não expande faixa: AC-1, AC-2, AC-3, AC-4, AC-5,
AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-F1, AC-F2, AC-F3, AC-F4, AC-F5.
