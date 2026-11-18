---
name: tasks
description: Decomposição e gates de E02-S35. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S35 · Canal Evolution confiável

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | ADR `1686-evolution-configurada-pela-ui.md` | — | — | revisão humana | done |
| 2  | `domain/evolution-compatibilidade.ts` + matriz inicial | AC-2 | 1 | `pnpm vitest run apps/web/src/features/atendimento/domain/evolution-compatibilidade.test.ts` | done |
| 3  | `domain/canal-evolution.ts` (estados, saúde, transições) | AC-6, AC-7, AC-8 | 1 | `pnpm vitest run apps/web/src/features/atendimento/domain/canal-evolution.test.ts` | done |
| 4  | `_shared/evolution-url.ts` anti-SSRF `[P]` | AC-1 | 1 | `deno test supabase/functions/_shared/evolution-url.test.ts` | done |
| 5  | `_shared/evolution-matriz.ts` (espelho) + teste de paridade com a task 2 | AC-2 | 2 | `deno test supabase/functions/_shared/evolution-matriz.test.ts` | done |
| 6  | Migration `1845` — provedor, estado, saúde + backfill + trigger de compat (**renumerada de 1829** por colisão com main) | AC-10 | 1 | `supabase test db` — `evolution_canal_estado.test.sql` (verde no CI) | done |
| 7  | Migration `1846` — `evolution_servidor`, `evolution_instancia`, RLS force + policies (**renumerada de 1830**) | AC-9 | 6 | `evolution_servidor_instancia_rls.test.sql` (verde no CI) | done |
| 8  | Migration `1847` — cofre por referência opaca (**renumerada de 1831**) | AC-3 | 1 | `cofre_referencia_opaca.test.sql` (verde no CI) | done |
| 9  | **`evolution-configurar`** (função NOVA, não `atendimento-evolution` — SPEC_DEVIATION abaixo): ação `salvar_servidor` | AC-1, AC-2, AC-3 | 4, 5, 7, 8 | `deno test supabase/functions/evolution-configurar/evolution-configurar.test.ts` | done |
| 10 | `evolution-configurar`: ação `criar_instancia` idempotente, nome derivado, token no cofre | AC-4 | 9 | idem (16 testes, mesmo arquivo) | done |
| 11 | `evolution-configurar`: ação `instalar_webhook` + estado `configuracao_incompleta` na falha | AC-5 | 10 | idem | done |
| 12 | `application/configurar-evolution.ts` (sequência atômica) + `verificar-canal.ts` | AC-5, AC-7 | 3 | `pnpm vitest run apps/web/src/features/atendimento/application/configurar-evolution.test.ts apps/web/src/features/atendimento/application/verificar-canal.test.ts` | done |
| 13 | Adapter **novo** `supabase-configuracao-evolution-adapter.ts` (não estende o legado — SPEC_DEVIATION abaixo) | AC-3 | 11, 12 | típado + consumido pelos testes de componente (task 14/15) | done |
| 14 | `components/ConfiguracaoEvolutionCanal.tsx` (SPEC_DEVIATION abaixo — nome trocado) | AC-1, AC-2, AC-5, AC-8 | 13 | `pnpm vitest run apps/web/src/features/atendimento/components/ConfiguracaoEvolutionCanal.test.tsx` | done |
| 15 | `EvolutionTab.tsx` consome a nova máquina, mantendo a lista atual `[P]` | AC-8 | 14 | `pnpm vitest run apps/web/src/features/atendimento/components/ConfiguracaoEvolutionCanal.test.tsx` (sem teste próprio pra `EvolutionTab.tsx` — só import/render, cobertura real é do componente filho) | done |
| 16 | Registrar débito em `docs/SECURITY_DEBT.md` (token global do webhook; exclusão a pedido) | — | 1 | revisão humana | todo |
| 17 | Glossário: canal, provedor, instância, servidor Evolution, saúde do canal | — | 1 | `grep` dos termos em `docs/glossary.md` | todo |
| 18 | `/revisao-adversarial` (tier arquitetural) | todos | 15 | achado reproduzido vira teste | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste

- **Unidade:** `avaliarCompatibilidade` (versão ausente, capacidade faltando, caminho feliz);
  transições de estado e saúde; `precisaReescanear`; sanitização da resposta (nenhum segredo).
- **Integração:** anti-SSRF com fakes de DNS (loopback, link-local, metadata, privado, público,
  redirect que muda origem); `criar_instancia` chamado duas vezes gera uma instância;
  `instalar_webhook` falhando deixa `configuracao_incompleta`.
- **DB (pgTAP, `db-tests` não pulado):** RLS permitido (superadmin) e negado (colaborador) nas duas
  tabelas novas; cofre negado para `anon`/`authenticated`; formato de referência recusado; backfill de
  provedor sem palpite; trigger de sincronia nas 6 transições.
- **Aceite:** um teste por AC-1..AC-10.

## Divergências (SPEC_DEVIATION)

- [x] Task 9-11 · `plan.md` nomeava a função `atendimento-evolution` (legada, E02-S19) para as
      ações novas. Criada função **nova** `evolution-configurar` em vez disso — a legada
      continua servindo o `EvolutionTab` atual sem mudança, e a nova tem seu próprio schema de
      entrada (`salvar_servidor`/`criar_instancia`/`instalar_webhook`), sem risco de regressão
      na tela em produção. Resolução: `plan.md` atualizado para refletir o nome real.
- [x] Task 13 · `plan.md` dizia "estende `supabase-evolution-adapter.ts`". Esse arquivo é o
      adapter LEGADO (`EvolutionGateway`, função `atendimento-evolution`), ainda em uso real pelo
      `EvolutionTab`. Criado adapter **novo** `supabase-configuracao-evolution-adapter.ts` em vez
      de estender — mesmo raciocínio da task 9-11 (zero risco de regressão na tela em produção).
      Resolução: nome mantido nesta tasks.md.
- [x] Task 14 · `plan.md` chamava o componente de `ConfiguracaoEvolution.tsx`, mas esse nome já
      existe como componente interno (não exportado) dentro de `EvolutionTab.tsx` (formulário
      simples de URL/chave do fluxo legado). Renomeado para `ConfiguracaoEvolutionCanal.tsx`
      pra não colidir. Resolução: nome mantido nesta tasks.md.
- [x] Tasks 12-15 (achado em produção, fora do plan.md original) · o fluxo original de
      `criar_instancia` deriva um nome de instância NOVO (`sinergica-<canalId>`) e chama
      `/instance/create` na Evolution — rodar isso contra um canal que JÁ TEM uma instância
      conectada pelo fluxo legado criaria uma SEGUNDA instância, exigindo novo pareamento por QR
      e derrubando a sessão real em produção. Adicionado em `evolution-configurar/index.ts`: se
      `canais_externos.identificador_externo` já está preenchido, `criar_instancia` ADOTA esse
      nome remoto sem nenhuma chamada à Evolution (zero risco à conexão), e `instalar_webhook`
      usa a apikey GLOBAL do servidor (não um token por instância) pra instalar o webhook dessa
      instância adotada, mantendo o estado `conectado_verificado` (nunca regride pra
      `aguardando_pareamento`). Testado em `evolution-configurar.test.ts` (2 testes novos).
      Resolução: código ajustado; `plan.md` não alterado (achado de produção, não de design).
- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`gh pr checks`, incluindo `db-tests` **não pulado**)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR `1686` registrado antes da implementação
- [ ] `/revisao-adversarial` rodada, achados viraram teste
- [ ] Glossário atualizado
- [ ] Débito registrado em `docs/SECURITY_DEBT.md`
- [ ] `docs/STATE.md` atualizado via `/handoff`
