---
name: "docs-adr-0263-tolerancia-identidade-importacao-md"
description: "Documento Sinérgica SO: ADR-0263 — Tolerância e identidade da Rotina importada"
alwaysApply: false
---

# ADR-0263 — Tolerância e identidade da Rotina importada

Status: proposta, não homologada.

As tolerâncias antes/depois podem ser declaradas para um mapeamento específico como registro imutável e revisionado no staging. Na ausência de configuração aplicam-se zero dias antes e depois. Uma mudança posterior do mapeamento não transfere a configuração anterior por inferência. A estrutura de vínculo de identidade declarada a Rotina oficial, por Cliente e Plano, reserva unicidade e referência de origem, mas não fornece comando para gravá-la. Só a futura transação de incorporação poderá criar vínculo e Rotina atomicamente, validando revisão de lote/Plano, propriedade, autorização e conflitos; nenhuma deduplicação automática por nome ou posição.

Identidades em fontes distintas são declarações humanas, não prova independente de equivalência. Preservar histórico e rejeitar conflitos exige revisão adicional do contrato de reprocessamento. Gate e EXECUTE permanecem fechados; não cria nem altera Rotina, Plano ou OS.
