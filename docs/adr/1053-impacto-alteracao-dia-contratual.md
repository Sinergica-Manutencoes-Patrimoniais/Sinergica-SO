# ADR-1053 — Prévia de Visitas vinculadas à alteração de dia

**Status:** preparação privada, não homologada.

Antes da mudança de dia contratual, listar Visitas com origem comprovada na série, por semana/ID, a partir da vigência. Apresentar data atual, estado, revisão, regra de origem e uma data civil proposta na mesma semana. Visitas não confirmadas ficam como candidatas a revisão humana; demais estados são preservados na prévia. Data proposta anterior à vigência é assinalada. A projeção não representa decisão de alteração, não calcula feriados, horário, fuso ou conflitos e não altera Visitas, regras, OS ou Auvo.

Não inferir origem de Visitas legadas ou extracontratuais. As páginas não são fotografia atômica; é necessário reconciliar origem, exceções, feriados, confirmação e todos os escritores antes de implementar alteração transacional de Visitas futuras. Gate e execução externos permanecem fechados. Validar autorização, revogação, paginação, virada de ano, dados faltantes, reprogramações e revisão adversarial antes da liberação.
