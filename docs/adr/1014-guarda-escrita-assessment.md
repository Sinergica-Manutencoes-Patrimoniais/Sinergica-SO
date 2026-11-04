# ADR-1014 — Escrita mediada do vínculo de assessment

Status: preparação privada, não homologada. Complementa ADR-1013.

Preparar guarda para alterações diretas de `assessment_id` em propostas existentes. Com gate habilitado, somente comando mediado poderá fornecer permissão transacional privada correspondente à proposta e ao valor anterior/novo; o registro é removido na mesma transação e rollback desfaz tudo. Inserções e cópia de proposta continuam usando guardas e permissões existentes, não são cobertas por esta mudança.

O gate nasce fechado; funções, token e cliente exigem rollout coordenado. Antes de habilitar, inventariar consumidores legítimos de alteração e importação, validar FORCE RLS do proprietário, concorrência, ordem de triggers, rollback, permissões e revisão adversarial. A guarda não comprova a segurança de inserções ou de outros campos.
