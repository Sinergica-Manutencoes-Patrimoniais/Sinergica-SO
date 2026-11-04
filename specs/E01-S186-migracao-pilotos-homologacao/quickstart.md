# Quickstart — E01-S186

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S165, E01-S166, E01-S167, E01-S168, E01-S169, E01-S170, E01-S171, E01-S172, E01-S173, E01-S174, E01-S175, E01-S176, E01-S177, E01-S178, E01-S179, E01-S180, E01-S181, E01-S182, E01-S183, E01-S184, E01-S185, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/migracao-programa-us1.test.ts src/features/pcm/domain/migracao-programa-us2.test.ts src/features/pcm/infrastructure/supabase-migracao-programa-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/migracao-programa.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

## Journeys and Expected Results

### US1

Em base de teste, migrar planos para versão1, relações Chamado/OS, agenda e achados; reexecutar lote e reverter logicamente um sem uso posterior.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Executar CT001–030 em ambiente de teste e registrar ressalva; simular saída de onda recusada por evidência faltante.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-001, CT-002, CT-003, CT-004, CT-005, CT-006, CT-007, CT-008, CT-009, CT-010, CT-011, CT-012, CT-013, CT-014, CT-015, CT-016, CT-017, CT-018, CT-019, CT-020, CT-021, CT-022, CT-023, CT-024, CT-025, CT-026, CT-027, CT-028, CT-029, CT-030. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
