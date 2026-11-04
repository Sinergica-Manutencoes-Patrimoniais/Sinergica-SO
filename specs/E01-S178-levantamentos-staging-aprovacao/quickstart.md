# Quickstart — E01-S178

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S176, E01-S177, E01-S170, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/levantamentos-us1.test.ts src/features/pcm/domain/levantamentos-us2.test.ts src/features/pcm/infrastructure/supabase-levantamentos-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/levantamentos.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

## Journeys and Expected Results

### US1

Importar lote com Área/Local/Sublocal/Sistema/Componentes/Grupo e tarefa Auvo de levantamento com fotos; repetir e corrigir uma linha.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

PCM aprova três de cinco linhas, rejeita pai de uma, corrige classificação e repete comando; outra sessão tenta aprovar versão antiga.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-030. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
