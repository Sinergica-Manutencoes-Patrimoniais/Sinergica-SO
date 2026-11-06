# ADR-0267 — Projeção dos motivos no histórico de Grupo

A consulta histórica atual projeta apenas antes/depois. Prepara-se consulta complementar, paginada pelo conjunto de eventos já exibidos, limitada a Grupo e às operações explícitas de movimentação e reclassificação. A autorização atual de leitura ou gestão é reavaliada no servidor; o payload completo de auditoria não é exposto. Eventos anteriores ou sem motivo permanecem sem informação inferida.

O gate e a execução permanecem fechados; a consulta não altera registros. Testes e revisão de autorização são necessários antes da ativação.
