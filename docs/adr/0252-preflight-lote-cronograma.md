# ADR-0252 — Diagnóstico de lote de cronograma

Status: proposta, não homologada.

O staging recebe todas as linhas da matriz, incluindo cabeçalhos; não existe classificação confiável que identifique quais linhas representam Rotinas. Identidade, mapeamento e revisão de uma linha não demonstram que todos os requisitos operacionais foram satisfeitos. A consulta agrega os registros efetivamente declarados, sem interpretar cabeçalhos ou marcar uma linha aprovada, e retorna impedimentos explícitos. Ela não é um comando de aprovação nem de incorporação. A ativação de futura aprovação depende de política de autorização aplicável, classificação de linhas e revisão do contrato de incorporação/idempotência; esta decisão não presume respostas pendentes.

Gate de cronograma e EXECUTE permanecem fechados até testes e revisão. Desativação segura: manter gate fechado; nenhuma alteração de dados oficiais é feita.
