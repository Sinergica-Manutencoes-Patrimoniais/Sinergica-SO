# ADR-0063 — Configuração auditada de ciência

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

O comando de configuração cria ou altera política de Cliente, contrato ou Visita com autorização atual `visita.confirmar`, identidade explícita, revisão esperada e requestId. O servidor valida os relacionamentos no mesmo Cliente. Bloqueio por escopo serializa criação simultânea e atualização; cada alteração e resultado idempotente são auditados em uma transação. Escrita direta continua fechada e não há confirmação nem envio como efeito do comando.

Como alteração de configuração pode afetar futuras confirmações e envio, os comandos posteriores devem capturar versão efetiva e serializar a resolução com os mesmos escopos, além de revalidar política no instante do envio. A interface e a política completa de delegação permanecem pendentes; nenhuma concessão é criada automaticamente.
