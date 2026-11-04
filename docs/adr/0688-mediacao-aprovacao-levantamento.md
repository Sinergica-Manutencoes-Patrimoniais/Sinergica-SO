# ADR-0688 — Mediação de aprovação de levantamento

Concluir e reabrir conferência, consultar retrato e aprovar seleção usam mediadores acessíveis apenas a usuários autenticados. Todos exigem o gate de mediação da ADR-0687, identidade e permissão `cadastro.aprovar` para o Cliente real do lote. As funções internas permanecem revogadas; seus gates, travas, validações, idempotência e auditoria continuam obrigatórios na mesma transação.

Não há credencial administrativa no navegador. A ativação exige revisão de privilégios, exposição do schema, testes e revisão de segurança; as outras funções da jornada não são automaticamente liberadas por esta decisão.
