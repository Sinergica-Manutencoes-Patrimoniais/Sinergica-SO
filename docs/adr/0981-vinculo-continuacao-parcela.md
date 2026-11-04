# ADR-0981 — Vínculo declarado entre continuidade e parcela

Status: preparação privada, não homologada.

Uma proposta de continuidade existente descreve trabalho e tempo restantes de uma OS, mas não identifica a parcela de Backlog correspondente. Preparar registro auditável e imutável do vínculo declarado pelo PCM entre proposta, parcela, ciclo e OS atribuída. Guardar revisão do Chamado e resumo da proposta, sem transformar a declaração em prova do trabalho executado ou autorização para devolver escopo. A proposta e a parcela originais não são alteradas; mais de uma relação pode existir, pois a cardinalidade funcional deve ser verificada no fluxo de revisão.

O registro exige OS anterior finalizada, proposta pendente, ciclo em tratamento, parcela pendente, atribuição consistente e permissões atuais. Não permite por si só executar, cancelar, dividir ou devolver trabalho. Gates e EXECUTE fechados. Antes da integração, definir validação de cobertura e exclusividade do restante, acompanhar edições e revogações da proposta, reconciliar execução remota e consumidores legados; testar isolamento, locks, concorrência, RLS e revisão adversarial. Não aplicar em produção.
