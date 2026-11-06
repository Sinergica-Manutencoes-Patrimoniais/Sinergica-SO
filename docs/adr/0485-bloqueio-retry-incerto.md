# ADR-0485 — guarda de retorno incerto da fila

Status: proposto; não aplicado nem homologado. A migration 0024 reivindica apenas `pending` e `pcm-auvo-push` registra falhas como `error`; 0051 descreve drenagem automática, enquanto 0210 contém manutenção histórica de estados. É preciso verificar o estado real do ambiente e outros escritores antes de afirmar a existência ou ausência de retry ativo.

Uma guarda desligada por padrão rejeita transição direta de `error` ou `processing` para `pending`, inclusive quando não há mensagem de erro; a ausência de mensagem não é evidência de ausência de efeito remoto. A guarda não bloqueia inserção de outro item, escrita remota fora da outbox, DELETE/TRUNCATE, manipulação de triggers por privilegiados ou outros estados; não é proteção completa contra duplicatas. Sua ativação pode interromper fluxos legados e exige protocolo do proprietário, inventário, testes e revisão. Não altera a fila nesta etapa nem autoriza retry.
