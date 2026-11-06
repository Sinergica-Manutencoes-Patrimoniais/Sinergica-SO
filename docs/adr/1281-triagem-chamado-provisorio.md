# ADR-1281 — Confirmação e correção de Chamado provisório

Status: proposta local; não aplicada nem homologada.

Preparar triagem auditável do Chamado provisório originado de tarefa de campo. PCM autorizado pode confirmar os dados atuais ou corrigir título e descrição, informando motivo. O comando confere revisão do Chamado e da triagem, usa request idempotente e preserva OS, identidade da tarefa, execução e histórico da inbox. Confirmar não implica execução nem validação PCM.

Junção, duplicidade e cancelamento com preservação de OS são operações distintas e ainda não estão implementadas por esta decisão. O gate nasce fechado. Antes de uso: validar autorização/revogação, alteração de Cliente, concorrência com escritores legados e triagem, locks, idempotência, RLS/FORCE, auditoria, privacidade e revisão adversarial. Nenhuma tarefa Auvo deve ser alterada pela triagem.
