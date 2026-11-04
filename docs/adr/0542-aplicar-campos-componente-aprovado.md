# ADR-0542 — Aplicação de campos de Equipamento/Componente

Comando transacional aplica campos explícitos conferidos de Equipamento ou Componente existente após aprovação do lote, com snapshot otimista, revisão, conferência de Cliente, categoria e posição/pai. Identidade de tipo e código permanecem; omissões preservam valores. Validação estrutural existente continua ativa; sem enqueue Auvo por proteção transacional. Trava interna libera somente linha e transação autorizadas. Gates desligados; revisão adversarial, concorrência, migrações e testes obrigatórios antes de habilitar.
