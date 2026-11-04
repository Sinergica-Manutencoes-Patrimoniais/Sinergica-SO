# Quickstart — E01-S176

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S170, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/estrutura-tecnica-us1.test.ts src/features/pcm/domain/estrutura-tecnica-us2.test.ts src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/estrutura-tecnica.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

## Journeys and Expected Results

### US1

Montar VRF com condensadora/evaporadoras/componentes e grupo de 20 luminárias no salão; tentar ciclo e vínculo de outro Cliente.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Sistema de Extintores cobre vários halls; mover Componente e consultar Local 360, Sistema 360 e ativo.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-012, CT-013, CT-014. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
