# ADR-1262 — Reserva de código de Grupo aprovado

**Status:** proposta local, não homologada. Complementa ADR-1252, ADR-1253 e ADR-1261.

Preparar extensão da reserva já usada por Sistemas e Componentes para linhas de Grupo com código. A reserva usa o mesmo espaço e trava global; incorporação individual ou por lote deve consumi-la na mesma transação. Grupo sem código mantém o caminho anterior. Código de Grupo já existente ou alias não pode ser assumido como novo Grupo; requer tratamento explícito de correspondência.

Manter gates de reserva e incorporação fechados até provar aprovação, revisão, código corrigido em staging, colisões históricas, repetição, concorrência, liberação, rollback integral, todos os escritores e RLS/FORCE, além de revisão adversarial. Nenhuma renumeração ou envio Auvo.
