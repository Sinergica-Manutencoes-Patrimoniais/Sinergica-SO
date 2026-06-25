---
name: ia-prompt-injection
description: Versionamento de prompt e defesa contra prompt injection. Puxe ao escrever prompt de feature LLM.
alwaysApply: false
---

# Prompt versionado + defesa contra injection

## Prompt é artefato, não string solta
- O prompt do sistema mora em arquivo versionado (`ia/prompts/<feature>.md` ou similar), não
  hardcoded espalhado. Mudou o prompt → é uma mudança rastreável (diff no PR).
- Cada prompt tem: **objetivo**, **formato de saída esperado**, **versão** e link para a `spec.md`.
- Ao alterar o prompt, **rode os evals** (ver `evals.md`) — prompt é a maior fonte de regressão.

## Defesa contra prompt injection (LLM01)
A regra central: **instrução do sistema e dado não confiável são coisas diferentes** — nunca
concatene cru.
- **Separe instrução de dado:** coloque o conteúdo do usuário/terceiro em uma seção delimitada e
  diga explicitamente ao modelo para tratá-lo como dado, não como ordem.
- **Não dê mais poder que o necessário:** o LLM não decide sozinho ação com efeito colateral
  (escrever no banco, enviar mensagem, pagar). Isso passa por validação/confirmação (LLM08).
- **Trate a saída como não confiável** (LLM02): valide contra schema (Zod), escape antes de
  renderizar HTML, nunca interpole saída de LLM direto em SQL/shell.
- **Tool calls:** valide os argumentos de toda tool antes de executar; menor privilégio (LLM07).
- **Não vaze contexto sensível** (LLM06): mande ao modelo só o necessário; redija PII/secret de logs.

## Teste
Inclua **casos adversariais** no eval: tentativas de "ignore as instruções acima", payloads que
tentam exfiltrar o system prompt, e dados maliciosos em campos livres. O gate da feature exige
**zero falha** nesses casos.
