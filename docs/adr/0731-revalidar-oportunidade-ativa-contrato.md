---
name: "docs-adr-0731-revalidar-oportunidade-ativa-contrato-md"
description: "Documento Sinérgica SO: ADR-0731 — Revalidar oportunidade na ativação de contrato"
alwaysApply: false
---

# ADR-0731 — Revalidar oportunidade na ativação de contrato

**Status:** preparado para diagnóstico; sem homologação ou deploy.

Uma oportunidade pode ser excluída logicamente após a criação do rascunho. O comando de ativação deve recusar origem excluída antes de criar plano financeiro ou mudar estado, assim como já recusa Cliente divergente. Isso não estabelece bloqueio geral à edição ou exclusão de oportunidade e não altera o escopo global legado.

A migration aditiva 0956 mantém assinatura, proprietário, `SECURITY DEFINER`, ACL e fluxo da 0952, apenas incluindo `deleted_at is null` na consulta que bloqueia a oportunidade. O bloqueio `FOR UPDATE` continua serializando a atualização da oportunidade durante a ativação. Não modifica dados existentes nem tenta reconciliar contratos antigos.

O teste de origem posterior deve demonstrar que alterações de negócio continuam possíveis, mas a ativação e a criação de plano falham para Cliente divergente ou origem excluída; devem ser executadas regressões de vínculo, revogação e rollback. Testes de concorrência, comportamento de service role, reconciliação de registros antigos, CI e revisão adversarial permanecem necessários. Rollback operacional exige migration compensatória e mantém os dados; restaurar a definição anterior reabre este defeito.
