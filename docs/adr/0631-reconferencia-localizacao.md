# ADR-0631 — Reconferência após rejeição e reabertura

Status: proposta; não homologada.

A guarda de aprovação exige, para cada linha de localização não rejeitada, retrato de atributos da linha e retrato mais recente de campos conferidos no ciclo atual. Uma linha formalmente rejeitada não deve impedir a conclusão do lote por possuir declarações históricas; essas declarações não são apagadas nem aplicadas. Reabrir a rejeição remove a decisão ativa e inicia novo ciclo, exigindo nova conferência antes de uma aprovação futura.

O gate de integração continua fechado. Validar concorrência, reabertura, histórico e rollback antes de aplicar e habilitar.
