# ADR 1462 — Entrada de processamento da origem de campo

A composição existente recebe uma entrada HTTP interna desativada por padrão. Ela exige a credencial de serviço pela composição e uma impressão digital configurada para a definição exata do contrato. A impressão digital limita o contrato usado; sua configuração não substitui a revisão independente da integração. Não há agendamento automático nesta mudança.

Antes de declarar, implantar ou habilitar a função, validar autenticação, escopo de credenciais, integridade e processo de aprovação do contrato, dados sensíveis, tratamento de erros e prazo, paginação, idempotência, concorrência, runtime, coordenação com o caminho legado e revisão adversarial. Não acionar tarefas Auvo durante validação isolada.
