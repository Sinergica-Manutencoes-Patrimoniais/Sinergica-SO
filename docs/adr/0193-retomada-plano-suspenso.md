# ADR-0193 — Retomada local sem geração retroativa

Status: proposta, não homologada.

Retomada exige Plano suspenso por decisão rastreável, autorização individual `plano.gerir`, vigência do dia, motivo, revisão e requestId. Restaura estado anterior à suspensão e registra evento imutável, sem criar ocorrências, Chamados, OS ou envio. Versões, histórico e âncoras permanecem intactos. Mesmo gate de transições fica fechado e função revogada.

É apenas a transição local: consulta e decisão explícita de vencidos devem ser concluídas antes de ativar, assim como reconciliação de geradores legados/PMOC, fuso e vigências futuras, concorrência, testes e revisão adversarial. A transição isolada não cumpre AC-7 e não deve ser oferecida como retomada operacional pronta.
