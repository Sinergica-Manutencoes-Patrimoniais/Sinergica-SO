# ADR-1143 — Tentativas T−24 sem resposta

Status: proposta local, gate fechado; não aplicada nem homologada.

Uma varredura privada poderá marcar como incerta uma tentativa que permaneça iniciada além do limite escolhido, sem presumir falha, sucesso ou ausência da tarefa remota. A varredura é paginada, transacional e idempotente por requestId; mantém fence e histórico, não faz retry e não chama o fornecedor. A escolha de limite não é feita nesta migration.

Uma tentativa iniciada sem timestamp não é considerada expirada por inferência e exige diagnóstico específico. Falta implementar e comprovar a transição de início, todos os escritores, proteção de respostas tardias, reconciliação e política operacional de prazo. Funções seguem privadas, sem job. Testar relógio, paginação, contenção, corrida com conclusão/cancelamento, idempotência e FORCE RLS, com revisão adversarial antes de ativar.
