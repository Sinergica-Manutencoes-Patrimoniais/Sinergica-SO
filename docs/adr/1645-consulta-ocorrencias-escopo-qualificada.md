# ADR-1645 — Consulta de ocorrências de escopo qualificada

A consulta privada de ocorrências para declaração de escopo retorna uma coluna chamada `id`. A condição do gate também referenciava `id` sem qualificar a tabela, o que pode causar ambiguidade PL/pgSQL ao executar a leitura mediada.

Qualificar a coluna do gate no núcleo existente elimina a ambiguidade sem ampliar ACLs, modificar os resultados ou habilitar o gate. A migration é aditiva em relação ao histórico existente e aguarda validação em banco antes de homologação.
