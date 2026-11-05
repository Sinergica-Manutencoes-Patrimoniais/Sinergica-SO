# ADR 1607: conflitos definitivos do inventário PMOC

Revisão, fotografia e decisão obsoletas são conflitos de negócio e recebem códigos específicos, sem substituir erros reais de serialização. A interface só descarta o pedido na primeira tentativa que recebeu resposta definitiva; pedidos restaurados ou anteriormente incertos permanecem disponíveis para replay idempotente.
