---
name: "docs-adr-0968-escopo-conversao-integral-md"
description: "Documento Sinérgica SO: ADR-0968 — Comparação do escopo na conversão integral"
alwaysApply: false
---

# ADR-0968 — Comparação do escopo na conversão integral

Status: preparação privada; não homologada. Complementa ADR-0870/0872.

O controle de revisões concorrentes compara alterações de Chamado e OS, mas não recebe a fotografia de escopo observada pelo operador. Preparar leitura de resumo SHA-256 do escopo e wrapper de criação que exige esse resumo sob trava de Chamado antes da primeira execução. O wrapper também exige que o ator esperado do formulário coincida com a sessão. O resumo abrange composição, parcelas e continuações; não inclui conteúdo em resposta. Um recibo privado vincula requestId, ator, Cliente, Chamado e resumo; replay idêntico usa o núcleo idempotente, mesmo após alteração posterior de escopo, e outro resumo é conflito.

A comparação só protege escritores que respeitem a mesma trava de Chamado; não cobre todas as fontes externas, eventos revertidos entre leituras ou tabelas adicionais. Limite de 1.000 registros por categoria falha fechado. UI, núcleo e grants existentes permanecem inalterados até rollout coordenado; wrapper e consulta sem EXECUTE, gate próprio fechado. A exceção de revisões concorrentes e seu SPEC_DEVIATION seguem abertas. Validar locks, escopo, privacidade do hash, fontes legadas, replay, concorrência e revisão adversarial antes de usar.
