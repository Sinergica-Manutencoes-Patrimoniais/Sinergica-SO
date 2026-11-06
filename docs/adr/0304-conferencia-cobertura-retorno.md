# ADR-0304 — Conferência estruturada de cobertura de retorno

Status: proposta, não homologada.

Uma conferência humana pode ser registrada somente quando vínculo OS–ocorrência–versão aprovada, identidade da tarefa resolvida e snapshot de perguntas forem verificáveis, e todas as perguntas possuírem resposta classificada válida. A conferência exige referência explícita a evidência já declarada e à revisão atual das evidências, além de justificativa. O resultado comprova cobertura estrutural das respostas e registra a declaração do PCM, não autenticidade ou integridade do arquivo externo. Não altera `cobertura_comprovada`, não aprova nem encerra OS; a prova de evidências externas e política de aceite continuam pendentes.

Registro é imutável e idempotente, com gate próprio e EXECUTE fechados. Testes e revisão adversarial precedem qualquer ativação.
