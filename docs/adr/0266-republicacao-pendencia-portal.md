# ADR-0266 — Nova publicação após revogação

Status: proposta; gates fechados, testes e revisão pendentes.

Uma pendência pode ter várias publicações históricas na mesma revisão, mas somente uma não revogada por revisão. Uma republicação cria novo identificador e texto; não altera a publicação anterior. O pedido possui UUID idempotente e armazena ator e conteúdo: repetição retorna o resultado anterior mesmo se revogado, evitando restauração acidental. A pendência é bloqueada durante a operação para serializar publicação, e o índice parcial protege concorrência. A função anterior não tem concessões e não deve ser liberada. A ativação depende de testes de concorrência, revogação e autorização.
