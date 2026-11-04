# ADR-0717 — Mediação da gestão de Grupo

Movimentação, reclassificação e alteração motivada de quantidade passam por mediadores autenticados, sob gate próprio desligado por padrão. Cada mediador verifica identidade e `cadastro.gerir` no Cliente real do Grupo; inexistente e não autorizado têm a mesma resposta. Os comandos internos continuam privados e mantêm gates próprios, validações de Local/Sistema/categoria, revisão, locks, requestId, histórico e auditoria, inclusive a guarda de motivo.

A mediação não altera sincronização externa. Ativação requer revisão de segurança, privilégios, isolamento entre Clientes e testes de replay e concorrência.
