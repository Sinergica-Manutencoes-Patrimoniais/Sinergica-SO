---
name: "docs-adr-0534-previa-parcela-mesmo-documento-md"
description: "Documento Sinérgica SO: ADR-0534 — prévia de parcela no mesmo documento"
alwaysApply: false
---

# ADR-0534 — prévia de parcela no mesmo documento

Status: proposto; não aplicado nem homologado. A prévia autorizada mostra se há documento canônico já vinculado ao lançamento, valor líquido do item e documento e situação do gate de parcelas adicionais. É somente leitura e não reserva saldo, nem promete disponibilidade futura. A alocação continua pelo comando canônico com requestId, revisão e verificações transacionais; a interface não cria lançamento, emissão fiscal ou cobrança externa. A migração 0757 e seus efeitos de DDL/concorrência permanecem sujeitos a testes e revisão antes de ativação.
