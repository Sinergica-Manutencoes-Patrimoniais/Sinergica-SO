# ADR-0351 — Checagem das respostas obrigatórias congeladas

Status: proposta, não homologada.

A checagem percorre todas as perguntas do snapshot e usa apenas o contrato congelado de obrigatoriedade. Conta perguntas obrigatórias sem resposta ou não inspecionadas e evidencia contratos indeterminados, respostas não OK e decisões PCM como fatos separados. Não torna fotos obrigatórias na ausência de regra tipada, nem interpreta ausência de foto como dispensa: exigência de evidência permanece indeterminada. Uma decisão PCM sobre foto não autentica conteúdo ou execução.

A consulta não aprova retorno, altera cobertura ou encerra OS. Gate e EXECUTE fechados; revalidação transacional, política de evidências, testes e revisão adversarial são necessários para qualquer efeito operacional.
