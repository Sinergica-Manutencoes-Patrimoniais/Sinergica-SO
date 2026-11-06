---
name: "docs-adr-0843-obrigatoriedade-resposta-classificada-md"
description: "Documento Sinérgica SO: ADR-0843 — Obrigatoriedade histórica na classificação de retorno"
alwaysApply: false
---

# ADR-0843 — Obrigatoriedade histórica na classificação de retorno

## Contexto

O classificador 0402 atribui `obrigatoria=true` a todas as respostas, inclusive quando a versão aprovada contém contrato explícito de pergunta opcional. A validação legada consulta esse campo e pode bloquear uma resposta opcional não inspecionada.

## Decisão

Na classificação futura, atribuir `false` somente se houver exatamente um contrato de pergunta no snapshot aprovado que coincida com Rotina, Questionário e pergunta, com booleano explícito `false`. Para contrato ausente, ambíguo, divergente ou inválido, manter `true` conservadoramente; os diagnósticos e guardas existentes devem continuar exigindo prova adicional. Não alterar respostas históricas. Preservar ACLs e gates.

## Limites

A mudança não comprova cobertura, executividade do checklist, origem, autenticidade de evidências ou segurança da integração Auvo. O classificador segue privado e a homologação depende de testes integrados e revisão adversarial.
