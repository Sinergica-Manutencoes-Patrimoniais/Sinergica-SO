# ADR-0636 — Consulta de tentativa anterior de atualização

Status: proposta; gate fechado, não homologada.

Uma tentativa 0798 antiga sem retrato 0858 não deve ser reenviada. A consulta identifica somente comando do próprio ator no lote autorizado, retornando situação, revisão e contagem, sem payload ou dados de outros Clientes. Resultado não localizado não comprova falha nem autoriza nova execução: pode haver processamento concorrente ou ausência de acesso ao registro aplicável. A interface não apaga automaticamente a tentativa.

Gate e RPC permanecem fechados; revisão, testes e aplicação pendentes.
