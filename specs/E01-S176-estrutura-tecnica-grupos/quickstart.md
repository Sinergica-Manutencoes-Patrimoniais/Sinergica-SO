# Quickstart — E01-S176

**Estado:** validação integrada do lote passou em clone descartável e a suíte web completa passou. T016 continua aberto para CI completa com db-tests, E2E visual, revisão formal e homologação.

## Prerequisites

Dependências E01-S170, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

O build de produção mantém `VITE_SSO_SISTEMAS_DISTRIBUIDOS_ENABLED` e `VITE_SSO_PLANOS_POR_ALVO_ENABLED` em `false`; os gates de leitura também começam fechados. O runner E2E os habilita somente dentro do clone sintético e concede ao usuário de fixture `cadastro.ler`, `cadastro.gerir` e `plano.gerir`. Não habilitar os gates de produção sem rollout e revisão de compatibilidade.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/estrutura-tecnica-us1.test.ts src/features/pcm/domain/estrutura-tecnica-us2.test.ts src/features/pcm/application/estrutura-tecnica-us1.test.ts src/features/pcm/application/estrutura-tecnica-us2.test.ts src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.test.ts src/features/pcm/interfaces/estrutura-tecnica/SistemasDistribuidosMembro.test.tsx
rtk proxy supabase test db
rtk proxy python3 supabase/manual-tests/E01-S176_recorte_do_zero.py --github-hosted --integracao-candidata --ui-s176-e2e
```

O pgTAP local exige `supabase start` em banco descartável. A UI E2E S176 só executa no workflow GitHub-hosted dedicado; ele habilita flags e gates somente no clone sintético e descarta o ambiente ao final. Não interpretar saída verde de eval:spec global como cobertura desta story sem conferir a seleção de specs.

## Journeys and Expected Results

### US1

Montar VRF com condensadora/evaporadoras/componentes e grupo de 20 luminárias no salão; tentar ciclo e vínculo de outro Cliente.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Sistema de Extintores cobre vários halls; mover Componente e consultar Local 360, Sistema 360 e ativo.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-012, CT-013, CT-014. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
