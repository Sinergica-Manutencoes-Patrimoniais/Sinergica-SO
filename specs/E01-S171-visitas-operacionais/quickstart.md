# Quickstart — E01-S171

**Estado:** roteiro para implementação futura; não executado como aceite nesta entrega.

## Prerequisites

Dependências E01-S167, E01-S170, banco local descartável com migrations compatíveis, dois Clientes de teste e usuários com/sem capacidades. Nenhuma credencial real em fixture. Auvo usa double; financeiro não emite documento real.

## Commands (from repository root)

```sh
rtk proxy pnpm --filter @sinergica/web exec vitest run src/features/pcm/domain/visitas-us1.test.ts src/features/pcm/domain/visitas-us2.test.ts src/features/pcm/infrastructure/supabase-visitas-adapter.test.ts
rtk proxy supabase test db
rtk proxy pnpm --filter @sinergica/web exec playwright test e2e/visitas.spec.ts
```

Arquivos de teste serão criados pelas tasks; ausência hoje é esperada. Não interpretar saída verde de eval:spec global como cobertura destas stories se script ainda selecionar só specs antigas. Validador documental do programa deve selecionar este pacote explicitamente.

## Journeys and Expected Results

### US1

Agrupar preventiva, corretiva, PMOC e solicitação do mesmo Cliente em equipe/Visita e testar ciência padrão e obrigatória.

Esperado: AC-1, AC-2, AC-3 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

### US2

Mover OS/Visita já enviada mantendo tarefa remota e histórico, criar extra na mesma semana e cancelar após confirmação.

Esperado: AC-4, AC-5, AC-6 atendidos; demonstrar casos negados, concorrência e retorno ao contexto.

## Evidence

Em 2026-10-27, `supabase/manual-tests/E01-S171_registro_ciencia_confirmacao_concorrencia.sql` passou **11/11** no banco dedicado `supabase_db_sso-comprovantes-isolado` (porta 56322), como `supabase_admin`. O roteiro cobre ciência antes da confirmação e confirmação antes de ciência com revisão obsoleta. Fixtures sintéticas `171a0000-*`, uma ciência, uma confirmação, dois comandos e dois eventos de auditoria permanecem no banco; não repetir no mesmo banco. A extensão dblink temporária foi revertida e a outbox não possui itens dos IDs sintéticos conferidos. O teste não cobre outras disputas ou autorização de envio Auvo.

Registrar em PR/artefato do piloto versão, ambiente, executor, data, comando, resultado, IDs e ressalvas para AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. CT: CT-006, CT-010. CI e db-tests não pulados e revisão adversarial antecedem PASS. Nenhuma evidência é marcada aprovada antecipadamente.
