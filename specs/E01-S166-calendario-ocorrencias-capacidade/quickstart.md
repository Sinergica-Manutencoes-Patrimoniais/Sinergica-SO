# Quickstart — E01-S166

**Estado:** implementação de todas as stories do lote concluída; pgTAP integrado e E2E visual isolado (run 42279514855) passaram, incluindo jornada V2 com 501 visitas. T016 segue aberto para medição de capacidade, concorrência real, CI completa, revisão formal e homologação.

## Prerequisites

Dependências E01-S165, E01-S171, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root, in the approved disposable environment)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/calendario-contratual-us1.test.ts src/features/pcm/domain/calendario-contratual-us2.test.ts src/features/pcm/application/calendario-contratual-us1.test.ts src/features/pcm/application/calendario-contratual-us2.test.ts src/features/pcm/infrastructure/supabase-calendario-contratual-adapter.test.ts src/features/pcm/interfaces/calendario-contratual/AlterarDiaComVisitasV2.test.tsx
rtk proxy python3 supabase/manual-tests/E01-S176_recorte_do_zero.py --github-hosted --integracao-candidata --fixture-s166-e2e --ui-s166-e2e
```

O primeiro comando cobre os testes focados de domínio, aplicação e adapter. O segundo prepara e descarta o clone isolado do E2E, incluindo pgTAP; não o execute contra banco compartilhado. Não interpretar saída verde de eval:spec global como cobertura desta story sem conferir a seleção de specs.

## Journeys and Expected Results

### US1

Suprimir sexta feriado, mover dia para terça com vigência e manter Visita extra/reprogramada existente.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Em 01/10 gerar janela 30 dias duas vezes em concorrência; testar 31/jan, tolerância zero e nova versão com mesmo ciclo.

Esperado: AC-4, AC-5, AC-6, AC-7 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US3

Em clone descartável, preparar fotografia sintética com 501 Visitas, conferir todas as páginas, retomar a sessão, ultrapassar o teto configurado e confirmar/repetir um lote dentro do teto medido.

Esperado: estado **Em andamento** e retomada visíveis; nenhuma alteração antes da confirmação; teto excedido, divergência e expiração não produzem efeitos parciais; replay retorna mesmo recibo. Medir locks, WAL, duração e memória antes de propor teto operacional acima de 500. Manter gates de produção fechados.

## Evidence

### Evidência histórica parcial — 2026-10-27

No banco isolado `sso-comprovantes-isolado`, versões anteriores de `E01-S166_calendario_contratual.test.sql` e `E01-S166_calculo_ciclos.test.sql` passaram 41/41 e 14/14 verificações pgTAP; transações foram revertidas. Esses arquivos não são os testes atuais do candidato e essa evidência não valida as migrations 1820/1821. Não cobre integração completa com E01-S165/E01-S171, materialização, sessões concorrentes, CI ou revisão adversarial. Não constitui PASS nem autorização de rollout.

Em 2026-10-27, `0313_E01-S166_origem_visita_contratual.sql` e `E01-S166_origem_visita.test.sql` foram executados juntos em transação revertida no banco isolado: 20 verificações passaram. A tabela de origem foi confirmada ausente após rollback. A prova abrange estrutura, isolamento e imutabilidade básicos, não o comando de criação ou reconciliação, unicidade de ciclo, correção histórica, auditoria transacional ou mudança efetiva de dia.

`supabase/manual-tests/E01-S166_origem_concorrencia.sql` está preparado, **não executado**. Requer banco descartável novo, sem dados reais, com 0313 e extensões instaladas; gera fixtures sintéticas persistentes `16620000-*` e reverte somente as inserções de origem disputadas. Testa apenas disputa pela mesma Visita após rollback, não concorrência do comando futuro, retry após commit ou disputa entre ciclo, confirmação e reprogramação. A pilha isolada atual apresenta divergência de histórico: objeto de 0311 existe sem registro correspondente e função de 0312 não existe. Não aplicar migrations fora de ordem para contornar.

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1 a AC-8. CT: CT-007, CT-008, CT-009, CT-010. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
