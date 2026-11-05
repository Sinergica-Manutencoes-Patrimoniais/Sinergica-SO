# ADR 1601 — Conflito de comparação sem retry transacional

Status: aceito para implementação; homologação pendente.

A comparação de impacto pode ficar obsoleta quando chega avaliação na ocorrência legada. O PostgREST reexecutou centenas de vezes uma decisão rejeitada com SQLSTATE `40001`, sem responder ao usuário. Esta rejeição de negócio usa `P0010` com mensagem `comparacao_obsoleta`, preservando a transação sem efeitos. As telas reconhecem esse par somente na primeira tentativa e exigem nova conferência; tentativas de resultado incerto continuam recuperáveis por replay. Outros conflitos de revisão permanecem como estavam e requerem avaliação própria. Nenhuma fonte externa ou tarefa Auvo é acionada.
