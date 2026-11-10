# Pesquisa — E01-S168

## Evidências locais

`supabase/functions/pcm-preventivas-confirmar/index.ts` já tem gate `preventiva_auvo_contrato`, reserva condicional e `tarefaPreventivaConfirmada`, mas faz POST imediato. `pcm-auvo-open-task/index.ts` e `pcm-auvo-create-task/index.ts` são caminhos legados a delegar ao executor único. `pcm-auvo-push/index.ts` e migration 0024 fornecem outbox/claim SKIP LOCKED; não serializam comandos da mesma OS. Reutilizar `_shared/auvo/client.ts`, `json-patch.ts`, `task.ts`, `datetime.ts`, `_shared/preventivas/resultado.ts`, `pcm-auvo-webhook/index.ts` e `pcm-auvo-tasks-import/index.ts`. Preservar `application/pmoc.ts`, `infrastructure/supabase-pmoc-adapter.ts`, `pmoc-generate-pdf/index.ts` e registros PMOC.

## Decisões

**Decisão:** evoluir caminhos existentes em vez de outro fluxo concorrente. **Motivo:** preservar IDs e rastreabilidade. **Alternativa rejeitada:** reconstrução independente e conversão destrutiva.

**Decisão:** Confirmação grava intenção local, não POST. `externalId=UUID da OS` é identidade estável, não garantia de exactly-once do fornecedor. RequestId único e expectedRevision; transação bloqueia agregados em ordem fixa, grava estado desejado/intenção/auditoria. Worker reserva cabeça por OS com lease e fencing token, revalida versão/elegibilidade antes da rede; não mantém lock DB durante HTTP. Mudança após início remoto gera reconciliação e não pode ser sobrescrita por resposta antiga. Lease expirado após tentativa remota vira incerto. T−24 deriva do início da Visita em instante UTC; converter explicitamente para horário local Auvo, nunca cortar sufixo UTC com slice. Reprogramação espera nova janela; Demanda sem data conserva task atrasada. Cancelamento remoto só com capacidade comprovada, sem DELETE físico automático. Retorno externo grava fato de campo; validação PCM é comando separado. PMOC deve manter fatos/evidências e laudos existentes, adaptando geração/encerramento para efeito idempotente apropriado à validação.

**Alternativa rejeitada:** retry cego, unicidade presumida do fornecedor e uso do horário de chegada como ordem confiável de execução.

## Provas técnicas futuras

Provar em ambiente controlado criação/consulta por externalId, PATCH da mesma task, responsável/equipe, timezone, alvo por categoria, questionário aplicável, status, cancelamento quando suportado e HMAC. `pcm-preventivas-validar-auvo/index.ts` realiza POST/PATCH/GET reais: não executar nesta etapa. Divergência taskType/taskTypeId nos caminhos existentes exige fixture e prova, não copiar ambos. Sem contrato de cancelamento, manter pendência externa, sem declarar sincronização concluída.

Fontes funcionais: SSO-003; §§5.3, 6.5, 7 e 11; CT-003, CT-004, CT-005, CT-006, CT-028, CT-029. Respostas consolidadas do Fabrício prevalecem sobre trechos incompatíveis do Word; não são instruções de executar APIs. Não há pergunta de negócio nova bloqueadora. Não houve homologação real nesta pesquisa. Contrato compartilhado e ADR-0026/0027/0028 definem interfaces entre stories.
