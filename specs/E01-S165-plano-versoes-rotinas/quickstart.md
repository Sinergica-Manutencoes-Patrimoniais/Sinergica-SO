# Quickstart — E01-S165

**Estado:** validação integrada do lote passou em clone descartável; suíte web completa e E2E visual isolado (run 42279514625) também passaram. T016 continua aberto para CI completa com db-tests, revisão formal e homologação.

## Prerequisites

Dependências E01-S170, E01-S176, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/plano-manutencao-us1.test.ts src/features/pcm/domain/plano-manutencao-us2.test.ts src/features/pcm/application/plano-manutencao-us1.test.ts src/features/pcm/application/plano-manutencao-us2.test.ts src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.test.ts src/features/pcm/interfaces/plano-manutencao/ReciboReconciliacaoRevisao.test.tsx src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoRecibo.test.tsx src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoConcorrencia.test.tsx src/features/pcm/interfaces/plano-manutencao/AvaliacaoImpactoRevisao.test.tsx src/features/pcm/interfaces/plano-manutencao/PreflightAprovacaoRevisao.test.tsx
rtk proxy supabase test db
rtk proxy python3 supabase/manual-tests/E01-S176_recorte_do_zero.py --github-hosted --integracao-candidata --fixture-s165-e2e --ui-s165-e2e
```

O pgTAP local exige `supabase start` em banco descartável. A UI E2E S165 só executa no workflow GitHub-hosted dedicado, que aplica o overlay 1822/1823, cria fixtures sintéticas e descarta o clone. Não interpretar saída verde de eval:spec global como cobertura desta story sem conferir a seleção de specs.

## Journeys and Expected Results

### US1

Criar Plano Guainumbí com Extintores, QGBT, VRF e Grupo Quantitativo; reabrir rascunho com três Rotinas distintas e nenhum registro de execução criado.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Aprovar, copiar modelo, alterar data-base e retirar escopo com efeito futuro; comparar versão e questionário usados por execução antiga.

Esperado: AC-4, AC-5, AC-6, AC-7 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

### Verificação local parcial — 2026-10-27

No banco isolado `sso-comprovantes-isolado`, `E01-S165_plano_manutencao.test.sql` passou 160/160 verificações pgTAP, em transação revertida. A verificação incluiu permissões positivas/negativas, retry e ausência de criação de OS/intenção Auvo. Não cobre duas sessões concorrentes, CI completa, revisão adversarial, dependências homologadas ou segunda aprovação de versão; não constitui PASS nem autorização de rollout.

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7. CT: regressões próprias da story. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
