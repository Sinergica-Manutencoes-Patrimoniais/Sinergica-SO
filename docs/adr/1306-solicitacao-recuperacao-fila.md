# ADR-1306 — Solicitação de recuperação de integração

## Decisão

Permitir ao usuário autorizado registrar solicitação de recuperação de um
item da fila, vinculada ao Cliente, ator, revisão e época observadas. O
registro é imutável, auditado e idempotente por requestId; não altera a fila,
não envia à integração e não declara ausência de efeito remoto. A revisão
lateral deve estar ativa e ser reconferida sob lock da fila.

Pedidos distintos podem referir-se à mesma revisão; a repetição do mesmo
requestId não cria outro registro. Essa escolha evita que um conflito com
pedido de outro ator deixe a tentativa local sem recibo. O proprietário deve
consolidar pedidos equivalentes antes de qualquer efeito externo: vários
pedidos não autorizam várias execuções.

A solicitação é uma entrada para o fluxo proprietário, não autorização para
repetição automática. A efetivação depende de provar identidade, efeito remoto,
contrato e idempotência no próprio proprietário. Não abrir gates ou conectar
dispatcher antes dessas condições.

## Limites

Implantação coordenada e validação de autenticação, RLS/FORCE, revogação,
transferência de Cliente, exclusão, concorrência, replay, época, retenção e
revisão adversarial obrigatórias. A revisão lateral não cobre alterações com
captura desativada nem prova estado externo.
