# ADR-0078 — Leitura mínima de questionário aprovado

## Decisão

Consulta de Rotina aprovada lê questionário exclusivamente do snapshot de sua versão, mediante autorização atual `plano.gerir` no Cliente e confirmação de que a versão pertence ao Plano. Retorna somente UUID, nome, cabeçalho, rodapé e perguntas congelados; o payload bruto Auvo e outros campos não fazem parte do contrato. Rotina sem questionário retorna ausência explícita; snapshot ausente, inconsistente ou Rotina inexistente é recusado. Nenhum dado vivo é usado como substituto.

## Limites e reversão

Esta consulta é somente para gestor; não concede acesso a técnicos ou Portal e não prova contrato de execução Auvo. O consumidor de execução precisará de autorização própria, paginação/limites de conteúdo e testes com evidências antes da liberação. A função é aditiva e pode ser removida após migrar seus consumidores; não altera snapshots nem cadastros.
