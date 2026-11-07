# Pesquisa — E01-S175

## Evidências locais

`supabase/functions/_shared/auvo/os-from-task.ts` é compartilhado por webhook e import; resolve Cliente/técnico e cria Chamado automático, hoje sem estado provisório. `pcm-auvo-webhook/index.ts` e `pcm-auvo-tasks-import/index.ts` são entradas existentes. `0016_E01-S15_auvo_task_snapshots.sql` guarda snapshot rico. `0151_E01-S99_chamado_id_unico.sql` e `0171_E01-S129_uma_os_por_chamado.sql` exigem compatibilidade com E01-S167: não manter relação singular ou número como identidade canônica. Reutilizar aplicação/adapters de Chamados, sem duplicar criação em dois caminhos.

## Decisões

**Decisão:** evoluir caminhos existentes em vez de outro fluxo concorrente. **Motivo:** preservar IDs e rastreabilidade. **Alternativa rejeitada:** reconstrução independente e conversão destrutiva.

**Decisão:** Um caso de uso servidor compartilhado por webhook/polling aplica inbox deduplicada e transação de resolução/criação Chamado+OS+evento. Chave de task (integração+taskId) única; concorrência não pode deixar Chamado órfão. Resolver referência documentada explicitamente: externalId válido da OS SSO deve localizar OS existente antes de interpretar referência de Chamado; UUID/CH só é aceito conforme contrato versionado, nunca busca textual livre. Cliente deve coincidir. Referência não resolvida vai provisório ou pendência de Cliente, nunca vínculo por semelhança. Provisório é contêiner auditável, não recusa de execução. Decisões de triagem usam expectedRevision/requestId e locks em ordem UUID para união. Proveniência por campo separa dado externo de correção PCM. Levantamento tem adapter estruturado para staging de E01-S178 e mantém OS de execução quando aplicável; sem catálogo oficial automático.

**Alternativa rejeitada:** retry cego, unicidade presumida do fornecedor e uso do horário de chegada como ordem confiável de execução.

## Provas técnicas futuras

### Revalidação do fluxo existente (2026-10-27)

- Webhook consulta OS por `auvo_task_id`; quando ausente chama `criarOsDaTarefa`, que cria Chamado, OS e vínculo em chamadas separadas. Cliente não sincronizado retorna `null`; a resposta do webhook o classifica como ignorado, não como inbox pendente persistida.
- Importação em lote usa funções e montagem compartilhadas, mas cria Chamados e OS em lotes separados; **não** chama o mesmo caso de uso transacional do webhook. A verificação prévia por `auvo_task_id` não demonstra exclusão mútua entre webhook e importação, nem rollback conjunto. Manter ambos os caminhos existentes até migração compatível e provar concorrência e recuperação antes da troca.
- O webhook atual registra snapshot rico, mas o código informa que o formato da entrega ainda não foi comprovado. Preservar payload e evidências sem inferir referência de Chamado por texto; nenhum teste local comprova contrato externo ou autoriza tráfego real.
- A leitura 1:N de E01-S167 (`0312`) está preparada mas não homologada; o fluxo legado de criação ainda não implementa a cardinalidade nova. Não criar vínculo ou numeração substituta com base apenas na leitura preparada.
- **Matriz de autorização a completar:** ingestão deve ser autenticada como webhook ou job interno; triagem e reconciliação exigem autorização atual no servidor e escopo de Cliente; recepção de levantamento não concede `cadastro.aprovar`. O catálogo de E01-S170 inclui `integracao.reconciliar` e `cadastro.aprovar`, mas não comprova qual capacidade específica autoriza cada decisão de triagem; manter a integração bloqueada até identificar o contrato implementado, sem conceder acesso por aproximação.

Fixture/prova do campo de referência de Chamado no Auvo, taskId estável, timestamp/ordem e questionário padronizado de levantamento. Sem prova de referência, não inferir do texto; usar triagem. Recepção e staging podem ser desenvolvidos com doubles. Nenhuma task real é criada nesta etapa.

Fontes funcionais: SSO-009; §6.4; CT-020, CT-021; definições Fabrício sobre Auvo provisório. Respostas consolidadas do Fabrício prevalecem sobre trechos incompatíveis do Word; não são instruções de executar APIs. Não há pergunta de negócio nova bloqueadora. Não houve homologação real nesta pesquisa. Contrato compartilhado e ADR-0026/0027/0028 definem interfaces entre stories.
