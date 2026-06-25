---
name: adr-0002-deteccao-deterministica-ze
description: Decisão de usar detecção determinística de menção ao Zé antes de chamar o LLM. Puxe ao tocar qualquer lógica de roteamento de mensagens.
alwaysApply: false
---

# ADR-0002 — Detecção determinística de menção ao Zé antes do LLM

**Status:** Aceito
**Data:** 2026-06-25
**Decisores:** @architect, @pm
**Relacionados:** spec `0002-abertura-chamado-ze`, ADR-0001, blueprint integracoes/whatsapp-evolution.md

## Contexto
O Agente Zé está em grupos WhatsApp com dezenas de membros. A maioria das mensagens do dia não é
direcionada a ele. Se chamarmos o LLM para cada mensagem recebida:
- **Custo**: Gemini 2.5 Flash custa ~0,003 USD por 1k tokens; grupos ativos geram centenas de
  mensagens por dia — custo desnecessário para mensagens off-topic.
- **Latência**: a chamada ao LLM adiciona 2–5s a cada mensagem. Para mensagens que deveriam ser
  ignoradas, isso é desperdício puro.
- **Confiabilidade**: o LLM pode alucinatoriamente decidir responder a mensagens não direcionadas
  ao Zé, criando chamados fantasmas (falso positivo com consequência real).

Precisamos de um guardião barato, rápido e determinístico que decida: "esta mensagem merece
atenção do LLM?" antes de qualquer chamada externa.

## Decisão
Toda mensagem WhatsApp recebida passa primeiro por **detecção determinística de menção** antes de
chegar ao LLM:

1. **Regex de menção**: `\bz[eé]\b` (case-insensitive) OU `@<bot_id>` (JID da instância Evolution).
   Se detectado → `mentioned = true`.
2. **Regra de roteamento por modo**:
   - `mentioned = true` → sempre aciona o LLM (qualquer modo).
   - `mentioned = false` + modo `active` → aciona o LLM (Zé responde proativamente).
   - `mentioned = false` + modo `monitor` ou `off` → SKIP (sem chamada ao LLM).
3. A detecção é **função pura testável** no domínio TypeScript — sem rede, sem banco, sem tokens.

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| **Detecção determinística primeiro** (A) | Custo zero; < 1ms; 100% determinístico | Regex pode ter falso negativo em dialetos muito criativos | **Escolhida** — os casos cobertos são os que importam |
| LLM decide se deve responder | Compreensão de linguagem natural completa | Custoso; 2-5s extra; risco de falso positivo com consequência | Rejeitada — trade-off desfavorável |
| Keyword hardcoded simples (`.includes`) | Muito rápido | Frágil (acentos, espaços, substrings erradas) | Rejeitada — regex `\bz[eé]\b` já resolve sem fragilidade |
| Só responder quando @mencionado | Mais restritivo; custo mínimo | Modo `active` perde valor — Zé não atua proativamente | Rejeitada — modo `active` é requisito de negócio |

## Consequências
**Positivas:**
- ~90% das mensagens (off-topic/sem menção em modo monitor) → SKIP, custo zero.
- Latência média do Zé cai: mensagens que não chegam ao LLM = resposta imediata de SKIP.
- Falso positivo (chamado criado sem intenção) praticamente zero no modo `monitor`.
- Função de detecção totalmente testável em unidade, sem mock de LLM.

**Negativas / trade-offs aceitos:**
- Em modo `active`, o Zé ainda chama o LLM para qualquer mensagem não-off-topic no grupo — se o
  grupo for muito ativo com mensagens fora de manutenção, o custo pode subir. Mitigação: modo
  `active` só habilitado em grupos dedicados à gestão do condomínio.
- Regex `\bz[eé]\b` não captura "ze" dentro de palavras ("zelar", "zelador") — testado e aceitável;
  "zelador" não é o nome do agente.
