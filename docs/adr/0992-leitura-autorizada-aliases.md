# ADR-0992 — Leitura mediada de aliases

Status: preparação privada, não homologada.

A listagem de aliases deve usar mediador volátil em READ COMMITTED, com ator esperado igual à sessão, trava compartilhada de autorização e travas dos gates até o fim da transação. O mediador verifica autorização atual por Cliente e delega ao núcleo existente, que valida ativo, tipo, limite e cursor. O núcleo deixa de ser executável pelos papéis externos; o mediador nasce sem concessão operacional e com gate próprio fechado. Interface escolhe o novo contrato somente por flag desligada por padrão.

O rollout deve coordenar banco, concessão e cliente; após a migration clientes antigos não conseguem listar aliases diretamente. A trava só cobre escritores que participem do protocolo de autorização; não prova serialização de todas as fontes, identidade entre páginas ou snapshot. Validar permissões e FORCE RLS dos proprietários, ordem de locks, revogação e gates em duas sessões, paginação, isolamento por Cliente e revisão adversarial antes da liberação. Não altera códigos, aliases ou vínculos Auvo.
