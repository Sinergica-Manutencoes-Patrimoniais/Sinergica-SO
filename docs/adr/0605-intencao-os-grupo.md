# ADR-0605 — Intenção de OS para Grupo em staging

Comando autorizado e fechado por gate registra intenção imutável por ocorrência de Grupo, preservando Rotina aprovada, quantidade e revisão fotografadas anteriormente, título, motivo e auditoria. Repetição da mesma requisição é idempotente; ocorrência já associada a OS declarada é recusada.

Intenção não é OS, aprovação, fila nem autorização de execução; não altera dados oficiais ou Auvo. Não há conversão para OS. Serialização com outros escritores, adaptação de consumidores, testes e homologação continuam pendentes; nenhum gate ou permissão é ativado.
