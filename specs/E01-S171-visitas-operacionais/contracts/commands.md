# Commands and UI Contract — E01-S171

## Operations

salvar_visita, associar_os_visita, confirmar_visita, reprogramar_visita, cancelar_visita; política ciência Visita > contrato > Cliente > padrão; retorno revisões e alertas, sem POST Auvo direto.

Nomes acima são comandos lógicos e nomes base de RPCs propostas desta story. Implementar em gateway/RPC transacional, sem duplicar variantes de regra na UI. Read models são paginados e incluem Cliente/versão/período.

## Envelope

Entrada de escrita: `{ requestId: UUID, expectedRevision: inteiro >= 0, aggregateId?: UUID, payload }`. Cliente/ator são obtidos da sessão e da entidade. Payload contém os campos de [data-model.md](../data-model.md); campos desconhecidos, vínculo de outro Cliente ou estado incompatível são rejeitados. Aprovação e emissão usam o snapshot/revisão conferidos, não a prévia desatualizada.

Sucesso: `{ aggregateId, revision, state, created, linkedIds, warnings, requestId }`; retry idêntico retorna o mesmo resultado. Uso da mesma requestId com outro payload ou revisão obsoleta retorna 409. Erros de autorização/escopo 403/404; integridade 422; erro externo recuperável 502/503 com estado pendente/incerto explícito. `problem+json` com reqId sem stack/PII/segredo.

## Atomicity and events

Salvar agregado, relação de origem, resultado requestId, evento auditável e intenção de integração juntos. Evento tem eventId, tipo, aggregateId/revision, occurredAt, correlationId/requestId. Consumer rejeita regressão/duplicação e aplica correção/reabertura apenas por transição explícita. Regras compartilhadas estão em [contratos-programa.md](../../../docs/planejamento/plano-manutencao/contratos-programa.md).

## UI actions

- US1: Agrupar e confirmar várias OS na Visita; botão habilitado por capacidade efetiva, confirmação de impacto quando houver, preservação da edição em falha e retorno ao acionador.
- US2: Reprogramar e cancelar com rastro; botão habilitado por capacidade efetiva, confirmação de impacto quando houver, preservação da edição em falha e retorno ao acionador.
Trocar Cliente cancela consulta antiga/fecha detalhe anterior; filtro sem resultado difere de Cliente sem dados. Mesmo comando nas superfícies global/360/Portal quando autorizado. Sem chamada Auvo no navegador.
