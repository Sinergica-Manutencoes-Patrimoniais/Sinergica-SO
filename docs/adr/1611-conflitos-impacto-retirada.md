# ADR 1611: conflitos conhecidos de comparação e retirada

A revisão divergente da comparação e a fila alterada durante aplicação da retirada são conflitos de negócio. Retornam códigos específicos para evitar retentativas automáticas de serialização; erros reais do banco conservam 40001. A interface só descarta uma tentativa de retirada após rejeição definitiva da primeira chamada e preserva replay incerto.
