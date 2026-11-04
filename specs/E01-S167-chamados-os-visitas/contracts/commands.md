# Commands and UI Contract — E01-S167

## Operations

`originar_chamado_ocorrencia` garante vínculo único Ocorrência → Chamado preventivo. A passagem da fila Preventivas Aguardando ao fluxo comum usa esse comando antes de planejar OS; retry não cria outro contêiner. Categoria Preventiva e origem/checklist/versão/vencimento/estimativa/alvo são transferidos, sem criticidade corretiva nem tarefa Auvo nessa transição.

criar_os_chamado, criar_continuacao_os, validar_os, indicar_aptidao_chamado, encerrar_chamado, suspender_chamado; todos com revision e requestId. Fechar OS jamais executa encerrar_chamado implicitamente.

Nomes acima são comandos lógicos e nomes base de RPCs propostas desta story. Implementar em gateway/RPC transacional, sem duplicar variantes de regra na UI. Read models são paginados e incluem Cliente/versão/período.

## Envelope

Entrada de escrita: `{ requestId: UUID, expectedRevision: inteiro >= 0, aggregateId?: UUID, payload }`. Cliente/ator são obtidos da sessão e da entidade. Payload contém os campos de [data-model.md](../data-model.md); campos desconhecidos, vínculo de outro Cliente ou estado incompatível são rejeitados. Aprovação e emissão usam o snapshot/revisão conferidos, não a prévia desatualizada.

Sucesso: `{ aggregateId, revision, state, created, linkedIds, warnings, requestId }`; retry idêntico retorna o mesmo resultado. Uso da mesma requestId com outro payload ou revisão obsoleta retorna 409. Erros de autorização/escopo 403/404; integridade 422; erro externo recuperável 502/503 com estado pendente/incerto explícito. `problem+json` com reqId sem stack/PII/segredo.

## Atomicity and events

Salvar agregado, relação de origem, resultado requestId, evento auditável e intenção de integração juntos. Evento tem eventId, tipo, aggregateId/revision, occurredAt, correlationId/requestId. Consumer rejeita regressão/duplicação e aplica correção/reabertura apenas por transição explícita. Regras compartilhadas estão em [contratos-programa.md](../../../docs/planejamento/plano-manutencao/contratos-programa.md).

## UI actions

- US1: Dividir necessidade em várias OS rastreáveis; botão habilitado por capacidade efetiva, confirmação de impacto quando houver, preservação da edição em falha e retorno ao acionador.
- US2: Continuar, suspender e encerrar sem perder escopo; botão habilitado por capacidade efetiva, confirmação de impacto quando houver, preservação da edição em falha e retorno ao acionador.
Trocar Cliente cancela consulta antiga/fecha detalhe anterior; filtro sem resultado difere de Cliente sem dados. Mesmo comando nas superfícies global/360/Portal quando autorizado. Sem chamada Auvo no navegador.
