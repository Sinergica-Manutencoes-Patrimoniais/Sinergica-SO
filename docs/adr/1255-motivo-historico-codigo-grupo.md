# ADR-1255 — Motivo de correção de código de Grupo

**Status:** proposta local, não homologada. Complementa ADR-1250.

Preparar consulta restrita ao administrador com capacidade de substituição para obter motivo, autor e data de uma correção registrada na auditoria. A busca exige Cliente, Grupo e código histórico exato; inconsistência ou multiplicidade de eventos falha sem escolher arbitrariamente. Não expõe outros eventos de auditoria nem altera identidade.

Gate fechado. Validar privacidade, revogação, conflitos, auditoria legada, concorrência, RLS/FORCE e revisão adversarial antes de disponibilizar. A ausência de evento não comprova inexistência de correção histórica.
