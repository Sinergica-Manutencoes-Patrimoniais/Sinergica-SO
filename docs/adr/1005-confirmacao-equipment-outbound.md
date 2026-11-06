# ADR-1005 — Confirmação transacional de Equipment outbound

Status: preparação privada, não homologada.

Preparar confirmação interna para create/update com reserva existente, item em processamento e ID remoto informado pelo worker. Sob trava global, a transação verifica identidade e IDs existentes, remove a reserva somente dentro da mesma transação, aplica o vínculo com mecanismo anti-loop, marca a outbox enviada e conserva recibo imutável. Erro ou rollback preserva a reserva; repetição só retorna recibo quando todos os dados coincidirem. Exclusão e resposta desconhecida não são aceitas nesse comando.

O ID informado pelo worker é uma afirmação de uma integração confiável, não prova independente de efeito no Auvo. Não integrar ao worker nem liberar execução até validar resposta real por operação, deduplicação, dois IDs legados, confiança do chamador, trigger anti-loop, locks, rollback e concorrência. Queda após HTTP e antes da confirmação permanece incerta e exige reconciliação auditada, sem retry automático.
