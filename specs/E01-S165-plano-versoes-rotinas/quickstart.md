# Quickstart — E01-S165

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S170, E01-S176, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/plano-manutencao-us1.test.ts src/features/pcm/domain/plano-manutencao-us2.test.ts src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/plano-manutencao.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

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
