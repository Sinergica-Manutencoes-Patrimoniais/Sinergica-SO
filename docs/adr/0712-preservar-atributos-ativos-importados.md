---
name: "docs-adr-0712-preservar-atributos-ativos-importados-md"
description: "Documento Sinérgica SO: ADR-0712 — Preservação de atributos de ativos incorporados"
alwaysApply: false
---

# ADR-0712 — Preservação de atributos de ativos incorporados

Uma guarda aditiva, desligada por padrão, bloqueia novos fatos de incorporação de Sistema, Equipamento e Componente enquanto a validação de atributos não estiver habilitada. Quando habilitada, rejeita atributos preenchidos de staging além dos que a criação individual valida ou transporta: nome, referência de pai e código informado. O staging permanece intacto para correção e reconferência.

A validação é conservadora e também poderá bloquear uma atualização que transporte algum atributo adicional; não supõe que cada caminho mapeie esses dados. O erro reverte toda a transação, inclusive a alteração oficial. Repetições já registradas continuam idempotentes, sujeitas a autorização e outros gates. Ativação exige revisão de segurança e testes de preservação, atualização, concorrência e replay.
