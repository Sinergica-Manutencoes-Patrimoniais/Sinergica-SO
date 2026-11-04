# ADR-0343 — Leitura do contrato congelado no retorno

Status: proposta, não homologada.

A prévia por pergunta usa exclusivamente `contratos_perguntas` do snapshot aprovado da versão vinculada ao retorno. Um contrato é reconhecido apenas com identidade única de Rotina/pergunta, questionário correspondente e booleano válido; ausência ou duplicidade significa obrigatoriedade indeterminada. O valor bruto da pergunta ou cadastro Auvo atual jamais serve de fallback. Snapshots históricos anteriores ao gate de congelamento permanecem indeterminados.

A consulta é informativa: não resolve exigência de fotos, não altera cobertura, validação ou OS. Gates e EXECUTE fechados, sujeitos a testes e revisão.
