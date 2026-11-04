# Quickstart — E01-S166

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S165, E01-S171, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/calendario-contratual-us1.test.ts src/features/pcm/domain/calendario-contratual-us2.test.ts src/features/pcm/infrastructure/supabase-calendario-contratual-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/calendario-contratual.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

## Journeys and Expected Results

### US1

Suprimir sexta feriado, mover dia para terça com vigência e manter Visita extra/reprogramada existente.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Em 01/10 gerar janela 30 dias duas vezes em concorrência; testar 31/jan, tolerância zero e nova versão com mesmo ciclo.

Esperado: AC-4, AC-5, AC-6, AC-7 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

### Verificação local parcial — 2026-10-27

No banco isolado `sso-comprovantes-isolado`, `E01-S166_calendario_contratual.test.sql` passou 41/41 verificações pgTAP e `E01-S166_calculo_ciclos.test.sql` passou 14/14; transações foram revertidas. Não cobre integração completa com E01-S165/E01-S171, materialização, sessões concorrentes, CI ou revisão adversarial. Não constitui PASS nem autorização de rollout.

Em 2026-10-27, `0313_E01-S166_origem_visita_contratual.sql` e `E01-S166_origem_visita.test.sql` foram executados juntos em transação revertida no banco isolado: 20 verificações passaram. A tabela de origem foi confirmada ausente após rollback. A prova abrange estrutura, isolamento e imutabilidade básicos, não o comando de criação ou reconciliação, unicidade de ciclo, correção histórica, auditoria transacional ou mudança efetiva de dia.

`supabase/manual-tests/E01-S166_origem_concorrencia.sql` está preparado, **não executado**. Requer banco descartável novo, sem dados reais, com 0313 e extensões instaladas; gera fixtures sintéticas persistentes `16620000-*` e reverte somente as inserções de origem disputadas. Testa apenas disputa pela mesma Visita após rollback, não concorrência do comando futuro, retry após commit ou disputa entre ciclo, confirmação e reprogramação. A pilha isolada atual apresenta divergência de histórico: objeto de 0311 existe sem registro correspondente e função de 0312 não existe. Não aplicar migrations fora de ordem para contornar.

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7. CT: CT-007, CT-008, CT-009, CT-010. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
