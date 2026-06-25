---
name: ia-trilha
description: Trilha de qualidade para features de IA/LLM (quando aplicar, OWASP LLM Top 10). Puxe ao construir feature com LLM.
alwaysApply: false
---

# Trilha de IA/LLM — visão geral

> Aplique **somente** quando a feature usa um LLM (geração, sumarização, extração, classificação,
> agente, RAG, chat, LLM-as-judge). Para feature comum, ignore esta trilha.

Feature de IA tem eixos de qualidade que código determinístico não tem: a saída é **não
determinística**, sensível a prompt e atacável por **prompt injection**. Por isso, além da
`spec.md` normal, uma feature de IA exige:
1. **Evals** — conjunto de casos que medem a qualidade da saída (ver `evals.md`). É o "teste" do LLM.
2. **Prompt versionado** — o prompt é artefato versionado, não string solta (ver `prompt-e-injection.md`).
3. **Defesa contra injection** — separar instrução de dado não confiável (ver `prompt-e-injection.md`).

Agentes: `@prompt-engineer` lidera prompt/eval; `@qa`/`@security` aplicam o OWASP LLM Top 10.

> **Provider e modelo:** por padrão, use os modelos Claude mais capazes (Opus/Sonnet atuais).
> Antes de implementar integração com LLM, consulte a skill `claude-api` para ids de modelo,
> pricing, tool use, caching e token counting — não decida de memória.

## OWASP LLM Top 10 — checklist mínimo
- [ ] **LLM01 Prompt Injection:** dado do usuário/terceiro nunca é tratado como instrução; use
      delimitadores e validação. Ver `prompt-e-injection.md`.
- [ ] **LLM02 Insecure Output Handling:** trate a saída do LLM como não confiável — valide/escape
      antes de executar, renderizar HTML ou montar SQL/shell.
- [ ] **LLM03 Data Poisoning:** controle a origem do que entra em RAG/fine-tune.
- [ ] **LLM04 Model DoS:** limite tamanho de input e custo (rate limit, max tokens).
- [ ] **LLM06 Sensitive Disclosure:** não mande PII/secret desnecessário ao modelo; redija logs.
- [ ] **LLM07 Insecure Plugin/Tool:** valide args de tool calls; menor privilégio.
- [ ] **LLM08 Excessive Agency:** ação com efeito colateral (escrever, pagar) exige confirmação/gate.
- [ ] **LLM09 Overreliance:** marque saída como gerada por IA; tenha fallback humano onde dói.

## Definition of Done (adicional para IA)
- [ ] Evals passam no limiar definido (ver `evals.md`)
- [ ] Prompt versionado e linkado na spec
- [ ] Defesa contra injection testada (caso adversarial no eval)
- [ ] OWASP LLM Top 10 revisado por `@security`/`@qa`
