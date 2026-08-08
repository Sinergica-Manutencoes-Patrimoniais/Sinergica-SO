---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Comunicação com MCPs (agente executa ferramenta)

> **Bloqueada até o Lucas responder as questões em aberto do `design.md`** (qual MCP server real)
> — implementar contra um servidor hipotético produz código não-testável de verdade.

## Plano
| #  | Task | Depende de | Gate (comando) | Status |
|----|------|------------|------------------|--------|
| 1  | Migration `atendimento.persona_mcp_servers` (allowlist, `CHECK (somente_leitura = true)`, RLS FORCE) | design aprovado | `pnpm run lint:migrations` | todo |
| 2  | Migration `audit.mcp_tool_calls` (append-only, RLS FORCE) | 1 | `pnpm run lint:migrations` | todo |
| 3  | `_shared/mcp-client.ts` — `toolsList`/`toolsCall` via JSON-RPC 2.0 sobre `fetch` | 1 | teste unidade com MCP mockado | todo |
| 4  | Tradução de schema MCP → formato `tools` do OpenRouter | 3 | teste unidade | todo |
| 5  | Cache em memória de `tools/list` (TTL 5min) | 3, 4 | teste unidade | todo |
| 6  | `chamarFerramentaMcp` — valida allowlist, timeout 10s, trunca resposta, grava audit | 1, 2, 3 | teste unidade (sucesso/timeout/erro/fora-da-allowlist) | todo |
| 7  | Wiring no `pcm-ze-agent`: monta `tools` se `toolUseEnabled` E existe linha em `persona_mcp_servers`; loop tool_call → resultado → segunda chamada | 4, 5, 6 | teste unidade do fluxo com OpenRouter mockado | todo |
| 8  | Validação manual do Lucas contra conversa real (1 ferramenta, 1 persona) | 7 | — (manual, não automatizável) | todo |

## Plano de teste
- Unidade: tradução de schema; allowlist bloqueia ferramenta fora da lista mesmo se o LLM pedir;
  timeout dispara e vira `role=tool` com erro, nunca trava; resposta gigante é truncada antes de
  voltar pro LLM.
- Integração: `chamarFerramentaMcp` contra um MCP server de teste (fixture local, não externo).
- Aceite: **não automatizável nesta fase** — exige LLM real + MCP server real + WhatsApp real.
  Task 8 é o gate humano que substitui o aceite automatizado.

## Divergências (SPEC_DEVIATION)
- [ ] Implementação inteira ainda não começou — este `tasks.md` existe pra a decisão de
      arquitetura não travar o resto, não porque o código já foi escrito.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável (unidade/integração)
- [ ] `CHECK (somente_leitura = true)` confirmado no banco, não só na aplicação
- [ ] `audit.mcp_tool_calls` gravando de verdade (verificado por query, não por inspeção de código)
- [ ] Validação manual do Lucas (task 8) — sem isso, feature não vai pra produção
- [ ] `docs/STATE.md` atualizado
