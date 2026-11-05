# ADR 1627: conflitos de revisão ao incluir e retirar Rotina

Revisão divergente na inclusão e retirada é conflito definitivo, não serialização transitória. O núcleo retorna P0011 apenas nessa condição, preservando autorização e replay. As interfaces só descartam tentativa nova após resposta definitiva e sessão confirmada; preservam pedidos incertos e erros reais de serialização.
