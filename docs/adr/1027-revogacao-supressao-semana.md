# ADR-1027 — Revogação auditada de supressão

Status: preparação privada, não homologada.

Preparar comando explícito para revogar uma supressão depois da retirada da declaração de feriado que a originou. Exigir ator, Cliente, permissões, motivo e requestId; serializar com alterações de feriado e origem da semana. Registrar evento imutável e auditoria sem criar Visita ou alterar ocorrências. A repetição idêntica retorna o mesmo resultado; conflito é recusado.

A revogação não comprova que a semana passou a ser dia útil ou que outro feriado não se aplica. A eventual geração posterior continua exigindo todas as verificações do fluxo proprietário; não ativar geração automática por esta ação. Função privada e gates fechados. Validar feriados concorrentes, compatibilidade legada, RLS/FORCE, replay, locks e revisão adversarial antes de ativar.
