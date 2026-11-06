# ADR 1604: revisão divergente na aprovação é conflito definitivo

Revisão divergente não é falha transitória de serialização. O núcleo da aprovação retorna P0011 para esse conflito, evitando retentativas automáticas do transporte. Falhas reais de serialização continuam 40001; o replay de pedidos concluídos continua retornando recibo após checar autorização.
