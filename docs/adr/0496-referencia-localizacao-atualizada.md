# ADR-0496 — Referência ao pai atualizado

Comandos de incorporação reconhecem pai incorporado ou localização atualizada na mesma linha do lote. As verificações originais de Cliente, tipo, situação ativa e hierarquia continuam obrigatórias, sob a mesma transação e trava do lote. Não altera cadastros pai nem publica dados. Novas funções seguem sem concessão e gates fechados; revisão de concorrência e testes obrigatórios antes de aplicação.
