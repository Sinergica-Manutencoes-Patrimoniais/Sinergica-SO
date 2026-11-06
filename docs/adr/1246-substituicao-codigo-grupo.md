# ADR-1246 — Substituição privada de código de Grupo

**Status:** proposta local, não homologada. Complementa ADR-1244/1245.

Preparar comando privado, sem grant, que exige capacidade `codigo.substituir`, superadmin ativo, motivo e código atual conferido. O antigo permanece no registro como histórico reservado; o novo é associado ao mesmo Grupo e a transação registra comando idempotente e auditoria. Repetição confere ator, permissão e conteúdo.

Não disponibilizar até implementar consulta autorizada por código atual e histórico, incorporação de staging, tratamento de reservas e revisão de todos os escritores. Testar concorrência, ordem de travas, permissões, replay, rollback, colisões e RLS/FORCE. A função não atualiza etiquetas nem sincroniza Auvo.
