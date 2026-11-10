# Plano técnico — E01-S175

**Status:** especificada, não implementada · **Data:** 2026-10-26 · **Spec:** [spec.md](spec.md)

## Summary

Um caso de uso servidor compartilhado por webhook/polling aplica inbox deduplicada e transação de resolução/criação Chamado+OS+evento. Chave de task (integração+taskId) única; concorrência não pode deixar Chamado órfão. Resolver referência documentada explicitamente: externalId válido da OS SSO deve localizar OS existente antes de interpretar referência de Chamado; UUID/CH só é aceito conforme contrato versionado, nunca busca textual livre. Cliente deve coincidir. Referência não resolvida vai provisório ou pendência de Cliente, nunca vínculo por semelhança. Provisório é contêiner auditável, não recusa de execução. Decisões de triagem usam expectedRevision/requestId e locks em ordem UUID para união. Proveniência por campo separa dado externo de correção PCM. Levantamento tem adapter estruturado para staging de E01-S178 e mantém OS de execução quando aplicável; sem catálogo oficial automático.

## Technical Context

TypeScript, React 19, TanStack Query e Supabase Postgres/RPC/Edge Functions; Auvo v2 por adapter servidor. Vitest para domínio/aplicação, Deno para integração com doubles e pgTAP para banco/policies. Consulta paginada, lotes limitados e cursor, sem N+1. Nenhuma API real nesta entrega.

## Reuso e mudanças delimitadas

`supabase/functions/_shared/auvo/os-from-task.ts` é compartilhado por webhook e import; resolve Cliente/técnico e cria Chamado automático, hoje sem estado provisório. `pcm-auvo-webhook/index.ts` e `pcm-auvo-tasks-import/index.ts` são entradas existentes. `0016_E01-S15_auvo_task_snapshots.sql` guarda snapshot rico. `0151_E01-S99_chamado_id_unico.sql` e `0171_E01-S129_uma_os_por_chamado.sql` exigem compatibilidade com E01-S167: não manter relação singular ou número como identidade canônica. Reutilizar aplicação/adapters de Chamados, sem duplicar criação em dois caminhos.

## Contratos e gates

Fixture/prova do campo de referência de Chamado no Auvo, taskId estável, timestamp/ordem e questionário padronizado de levantamento. Sem prova de referência, não inferir do texto; usar triagem. Recepção e staging podem ser desenvolvidos com doubles. Nenhuma task real é criada nesta etapa.

Ler `docs/planejamento/plano-manutencao/contratos-programa.md` e ADR-0026/0027/0028 antes de codar; contratos locais em [contracts/commands.md](contracts/commands.md). Se caminho de UI previsto não existir, localizar componente vigente, registrar ajuste técnico no plano, sem mudar AC/escopo. Nova migration recebe próximo número disponível na execução, nunca número reservado nesta especificação.

## Constitution Check

Antes/depois do desenho: schema de domínio, RLS FORCE, pgTAP permitido/negado, autorização servidor, audit append-only, secrets Vault; Edge CORS/JWT/rate-limit/Zod e problem+json com reqId; webhook HMAC constant-time. Migrations aditivas sem alterar aplicadas. DDD com domain puro e TanStack Query/invalidação para UI. Nenhuma exceção proposta. Tier arquitetural requer revisão adversarial e CI/db-tests antes do PASS de implementação.

## Project Structure e sequência

Domínio/aplicação/adapters em `apps/web/src/features/pcm/{domain,application,infrastructure}/`; handlers em `supabase/functions/`; testes DB em `supabase/tests/`; migrations futuras em `supabase/migrations/`. Modelos lógicos e comandos detalhados nesta pasta. Dependências E01-S167, E01-S170 precedem integração. Executar US1, US2 e US3 com testes antes de regra; finalização inclui UI, recuperação e revisão adversarial. MVP demonstrável é US1 em ambiente fake; liberação real requer conjunto completo e gate operacional.

Recepção de OS não fica bloqueada pela implementação do levantamento: envelope estruturado permanece pendente até contrato de staging E01-S178 estar disponível; somente despacho ao staging depende dessa capacidade.
