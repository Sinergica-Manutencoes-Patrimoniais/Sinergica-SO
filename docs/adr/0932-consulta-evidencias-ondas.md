# ADR-0932 — Consulta privada de evidências por onda

Status: preparação local, não aplicada nem homologada. Complementa ADR-0931.

## Decisão

Preparar leitura paginada por Cliente e onda, ordenada por revisão, com até 50 registros por página. A primeira página informa a revisão atual; páginas seguintes exigem a mesma revisão e falham se houve nova declaração, evitando combinar fotografias diferentes. Gate e autorização conservadora são conferidos no servidor. A consulta e os objetos continuam privados, sem concessão de execução; a interface é experimental e desligada por padrão.

A consulta não prova conteúdo ou autenticidade dos artefatos, aceite, CI ou autorização de produção. O desenho exige teste de RLS/HTTP, concorrência com escrita e revogação de acesso, privacidade de campos livres e revisão adversarial antes de conceder execução. Desligar o gate mantém o histórico, sem excluir registros ou dados preexistentes.
