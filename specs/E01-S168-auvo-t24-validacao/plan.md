# Plano técnico — E01-S168

**Status:** especificada, não implementada · **Data:** 2026-10-26 · **Spec:** [spec.md](spec.md)

## Summary

Confirmação grava intenção local, não POST. Alteração de conteúdo/programação invalida revisão confirmada e exige reconfirmação. Política de ciência segue Visita > contrato > Cliente > padrão sem controle, com snapshot efetivo na confirmação. Usar/estender `pcm.auvo_sync_outbox` existente, sem segunda fila concorrente. `externalId=UUID da OS` é identidade estável, não garantia de exactly-once do fornecedor. RequestId único e expectedRevision; transação bloqueia agregados em ordem fixa, grava estado desejado/intenção/auditoria. Worker reserva cabeça por OS com lease e fencing token, revalida versão/elegibilidade antes da rede; não mantém lock DB durante HTTP. Mudança após início remoto gera reconciliação e não pode ser sobrescrita por resposta antiga. Lease expirado após tentativa remota vira incerto. T−24 deriva do início da Visita em instante UTC; converter explicitamente para horário local Auvo, nunca cortar sufixo UTC com slice. Reprogramação espera nova janela; Demanda sem data conserva task atrasada. Cancelamento remoto só com capacidade comprovada, sem DELETE físico automático. Retorno externo grava fato de campo; validação PCM é comando separado. PMOC deve manter fatos/evidências e laudos existentes, adaptando geração/encerramento para efeito idempotente apropriado à validação.

## Technical Context

TypeScript, React 19, TanStack Query e Supabase Postgres/RPC/Edge Functions; Auvo v2 por adapter servidor. Vitest para domínio/aplicação, Deno para integração com doubles e pgTAP para banco/policies. Consulta paginada, lotes limitados e cursor, sem N+1. Nenhuma API real nesta entrega.

## Reuso e mudanças delimitadas

`supabase/functions/pcm-preventivas-confirmar/index.ts` já tem gate `preventiva_auvo_contrato`, reserva condicional e `tarefaPreventivaConfirmada`, mas faz POST imediato. `pcm-auvo-open-task/index.ts` e `pcm-auvo-create-task/index.ts` são caminhos legados a delegar ao executor único. `pcm-auvo-push/index.ts` e migration 0024 fornecem outbox/claim SKIP LOCKED; não serializam comandos da mesma OS. Reutilizar `_shared/auvo/client.ts`, `json-patch.ts`, `task.ts`, `datetime.ts`, `_shared/preventivas/resultado.ts`, `pcm-auvo-webhook/index.ts` e `pcm-auvo-tasks-import/index.ts`. Preservar `application/pmoc.ts`, `infrastructure/supabase-pmoc-adapter.ts`, `pmoc-generate-pdf/index.ts` e registros PMOC.

## Contratos e gates

Provar em ambiente controlado criação/consulta por externalId, PATCH da mesma task, responsável/equipe, timezone, alvo por categoria, questionário aplicável, status, cancelamento quando suportado e HMAC. `pcm-preventivas-validar-auvo/index.ts` realiza POST/PATCH/GET reais: não executar nesta etapa. Divergência taskType/taskTypeId nos caminhos existentes exige fixture e prova, não copiar ambos. Sem contrato de cancelamento, manter pendência externa, sem declarar sincronização concluída.

Ler `docs/planejamento/plano-manutencao/contratos-programa.md` e ADR-0026/0027/0028 antes de codar; contratos locais em [contracts/commands.md](contracts/commands.md). Se caminho de UI previsto não existir, localizar componente vigente, registrar ajuste técnico no plano, sem mudar AC/escopo. Nova migration recebe próximo número disponível na execução, nunca número reservado nesta especificação.

## Constitution Check

Antes/depois do desenho: schema de domínio, RLS FORCE, pgTAP permitido/negado, autorização servidor, audit append-only, secrets Vault; Edge CORS/JWT/rate-limit/Zod e problem+json com reqId; webhook HMAC constant-time. Migrations aditivas sem alterar aplicadas. DDD com domain puro e TanStack Query/invalidação para UI. Nenhuma exceção proposta. Tier arquitetural requer revisão adversarial e CI/db-tests antes do PASS de implementação.

## Project Structure e sequência

Domínio/aplicação/adapters em `apps/web/src/features/pcm/{domain,application,infrastructure}/`; handlers em `supabase/functions/`; testes DB em `supabase/tests/`; migrations futuras em `supabase/migrations/`. Modelos lógicos e comandos detalhados nesta pasta. Dependências E01-S167, E01-S171, E01-S170 precedem integração. Executar US1, US2 e US3 com testes antes de regra; finalização inclui UI, recuperação e revisão adversarial. MVP demonstrável é US1 em ambiente fake; liberação real requer conjunto completo e gate operacional.
