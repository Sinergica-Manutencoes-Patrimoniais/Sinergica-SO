---
name: blueprint-integracao-llm-openrouter
description: Blueprint das integrações LLM via OpenRouter (Zé, inspeções, laudos, propostas). Puxe ao planejar specs de features com IA.
alwaysApply: false
---

# Blueprint — OpenRouter / LLM

## Modelos por caso de uso
| Caso de uso | Modelo | Justificativa |
|-------------|--------|---------------|
| Agente Zé (WhatsApp) | `google/gemini-2.5-flash` | Latência < 10s; custo baixo para volume alto |
| Análise de fotos (inspeção) | `claude-opus-4-8` ou `claude-sonnet-4-6` | Visão + raciocínio técnico |
| Geração de laudo SPDA | `claude-sonnet-4-6` | Raciocínio técnico + precisão normativa |
| Geração de proposta | `claude-sonnet-4-6` | Qualidade textual + cálculos |
| Repriorização de backlog | `google/gemini-2.5-flash` | Custo baixo, sem visão |

## Padrões de uso
- Toda chamada LLM é feita em Edge Functions (servidor) — nunca no frontend.
- Prompt versionado em `ia/` (ver `ia/prompt-e-injection.md`).
- Custo e tokens por chamada registrados em tabela de análise (`_analises`).
- Loop de tool-calling: máx 5 iterações para o Zé; 1 para análise de item.

## Segurança
- `OPENROUTER_API_KEY` em `supabase secrets` (nunca no cliente).
- Validação de input com Zod antes do prompt.
- Nunca incluir PII sensível no prompt (CPF, senha, token).
- Defesa contra prompt injection (ver `ia/prompt-e-injection.md`).

## Evals (futuro)
- Casos adversariais para o Zé: mensagens ambíguas, off-topic, tentativas de injection.
- Evals de laudo: comparar saída com laudos validados por engenheiro.
- Ver `ia/evals.md`.

## OWASP LLM Top 10 (aplicável)
- LLM01: Prompt Injection (Zé recebe input não confiável de grupos WhatsApp públicos).
- LLM06: Excessive Agency (Zé tem tool `criar_chamado` — limitar ao contexto do condomínio).
- LLM09: Overreliance (laudos gerados por IA precisam de revisão humana antes de assinar).
Ver `ia/README.md` para o checklist completo.
