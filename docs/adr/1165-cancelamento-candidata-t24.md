---
name: "docs-adr-1165-cancelamento-candidata-t24-md"
description: "Documento Sinérgica SO: ADR-1165 — Cancelamento local da candidata T−24"
alwaysApply: false
---

# ADR-1165 — Cancelamento local da candidata T−24

Status: proposta local, não aplicada nem homologada.

Permitir ao PCM cancelar candidata ainda não iniciada, com motivo e auditoria, mantendo intacta eventual tarefa Auvo. Outbox e livro são atualizados juntos; fence aumenta para invalidar concessão anterior. Se o efeito já começou, registrar resultado incerto e exigir reconciliação; não afirmar cancelamento externo. Para estado incerto ou em reconciliação não inventar resultado e não reenviar. Comando idempotente por requestId, ator e payload.

Trava de autorização e gates precedem outbox e livro; um produtor e um executor devem respeitar a mesma ordem. Esta ação não cancela a OS nem substitui transições de Visita e não prova que requisição anterior ao Auvo parou. Gate nasce fechado. Validar expiração de lease, cancelamento concorrente, callbacks tardios, autorização, FORCE RLS, todos os escritores, rollback e revisão adversarial antes de ativar.
