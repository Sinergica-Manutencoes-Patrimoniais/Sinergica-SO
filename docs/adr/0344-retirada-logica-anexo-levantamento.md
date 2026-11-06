# ADR-0344 — Retirada lógica de anexo de levantamento

Prepara-se retirada explícita e auditada de foto ou documento ainda não incorporado por sua linha e sem vínculo a destino de ativo. Registro é imutável, exige motivo e capacidade de aprovação; arquivo e histórico não são apagados. A retirada bloqueia novas vinculações e resolução de leitura no staging. A sinalização e os comandos da interface dependem de flag própria.

Gate de comando nasce desligado; proteções de retiradas existentes não dependem do gate. Não se retira anexo cuja linha já foi incorporada, independentemente de publicação. Testes de concorrência e revisão de autorização/retenção são obrigatórios antes de ativar.
