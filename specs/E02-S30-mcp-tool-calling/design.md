---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — Comunicação com MCPs (agente executa ferramenta)

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** sessão Claude · **Data:** 2026-08-07
> **Implementação NÃO iniciada nesta sessão** — sem ambiente pra validar tool-calling contra LLM/
> WhatsApp reais (mesma ressalva registrada em E02-S23/S25/S26). Este documento existe pra
> destravar a decisão de arquitetura; codar o motor é sessão própria, com o Lucas testando cada
> passo contra uma conversa real.

## Contexto da funcionalidade
`PersonaItem.toolUseEnabled` existe desde E02-S14, nunca foi lido por nenhuma Edge Function —
achado desta sessão (`grep -rl toolUseEnabled supabase/functions/` = vazio). O `pcm-ze-agent`
chama OpenRouter via `fetch()` cru contra `/chat/completions`, formato compatível com o
tool-calling padrão da OpenAI (`tools`, `tool_choice`, mensagens de papel `tool`). MCP
(Model Context Protocol) é o mecanismo escolhido pelo Lucas — servidor MCP remoto (HTTP/SSE, já
que Edge Functions não sustentam processo `stdio` local) expõe ferramentas que o agente descobre
e chama em runtime.

## Goals / Non-goals

**Goals**
- Zé consegue chamar **uma** ferramenta MCP de leitura (ex.: consultar OS) durante uma conversa
  real e citar o resultado na resposta.
- A superfície de ferramentas disponíveis é **configurável por persona**, não hardcoded — reusa
  o toggle `toolUseEnabled` já existente (que passa a significar algo de verdade).
- Nenhuma ferramenta de escrita é alcançável nesta fase — bloqueado por design, não por acordo
  de cavalheiros.

**Non-goals**
- Múltiplos MCP servers simultâneos — um só, validado, antes de generalizar.
- Ferramenta de escrita/ação que muda dado.
- MCP local (stdio).
- UI de configuração visual do MCP server — configuração via Vault/config direto nesta fase (a UI
  vem depois de validado, mesma sequência de E00-S12/E00-S13).

## Design proposto

### Visão geral do fluxo
```
Cliente (WhatsApp) → Evolution webhook → atendimento.mensagens
                                              │
                                              ▼
                                     pcm-ze-agent (Edge Function)
                                              │
                            1. monta mensagens + tools (se toolUseEnabled)
                                              │
                                              ▼
                              OpenRouter /chat/completions (tools=[...])
                                              │
                         2. LLM decide: responde direto OU pede tool_call
                                              │
                              ┌───────────────┴────────────────┐
                              │ sem tool_call                  │ com tool_call
                              ▼                                ▼
                       resposta final                  3. chamarFerramentaMcp(nome, args)
                                                                │
                                                    valida contra allowlist da persona
                                                                │
                                                                ▼
                                                  MCP server remoto (JSON-RPC/HTTP)
                                                     tools/call { name, arguments }
                                                                │
                                                  4. resultado volta como mensagem role=tool
                                                                │
                                                  5. segunda chamada ao OpenRouter (com o
                                                     resultado) → resposta final citando o dado
```

### Descoberta de ferramentas (`tools/list`)
No boot da conversa (ou em cache curto — TTL 5min, evita round-trip MCP em toda mensagem), o
`pcm-ze-agent` chama `tools/list` do MCP server configurado pra persona e traduz o schema MCP
(JSON Schema por ferramenta) pro formato `tools` do OpenRouter — são compatíveis por construção
(ambos usam JSON Schema pros parâmetros).

### Allowlist por persona — a peça de segurança central
`toolUseEnabled=true` sozinho **não basta**. Nova tabela `atendimento.persona_mcp_servers`:

| Coluna | Tipo | Nota |
|---|---|---|
| `persona_id` | uuid, FK `atendimento.personas` | |
| `mcp_server_url` | text | endpoint HTTP/SSE do servidor |
| `mcp_server_token_vault_key` | text | chave no Vault (padrão E00-S12, nunca em `Deno.env`) |
| `ferramentas_permitidas` | text[] | allowlist explícita — mesmo que o server exponha 10 tools, só as listadas aqui são chamáveis. **Nunca all-by-default.** |
| `somente_leitura` | boolean, default `true`, `CHECK (somente_leitura = true)` nesta fase | trava de banco, não só de aplicação — impede escrita mesmo com bug de código |

Sem linha em `persona_mcp_servers` pra uma persona → `toolUseEnabled=true` não tem efeito nenhum
(fail-closed).

### Execução da chamada
- Timeout duro por chamada (`AbortController`, 10s — mesmo padrão já usado em
  `pcm-auvo-sync-all`, ver STATE.md).
- Resultado truncado a um teto de tamanho antes de voltar pro LLM (custo de token).
- Toda chamada grava em `audit.mcp_tool_calls` (append-only, padrão `audit.*` do projeto):
  persona, conversa, ferramenta, argumentos, resultado (ou erro), duração. É o que permite
  auditar "o agente executou o quê, quando" — requisito de segurança, não telemetria opcional.
- Erro da ferramenta (timeout, MCP server fora do ar, schema inválido) vira mensagem `role=tool`
  com o erro — o LLM decide como comunicar isso ao cliente, nunca trava a conversa.

## Cobertura dos 5 eixos

### 1. Tech stack
Nenhuma lib de cliente MCP — o protocolo é JSON-RPC 2.0 sobre HTTP simples o suficiente pra
implementar com `fetch()` cru (mesmo padrão já usado pra OpenRouter/Auvo/Evolution neste
projeto — o projeto não usa SDK de terceiro pra nenhuma integração externa até agora).

### 2. Arquitetura base
Novo agregado `atendimento.persona_mcp_servers` (bounded context Atendimento, já existente).
`audit.mcp_tool_calls` seguindo o padrão `audit.*` já estabelecido (RLS FORCE, append-only,
nunca editável). Não cria bounded context novo.

### 3. Infra
Token do MCP server no Vault (padrão E00-S12/E00-S13 — nunca `Deno.env`, nunca client-side).
Nenhum recurso de infra novo (fila, cache) — o cache de `tools/list` é em memória do próprio
Edge Function, TTL curto, sem necessidade de Redis/KV.

### 4. Qualidade
- Unidade: tradução de schema MCP → formato `tools` do OpenRouter; validação de allowlist
  (ferramenta fora de `ferramentas_permitidas` nunca é chamada, mesmo que o LLM peça).
- Integração: `chamarFerramentaMcp` com MCP server mockado (sucesso, timeout, erro, resposta
  gigante truncada).
- **Não há teste de aceite fim-a-fim nesta fase** — exige LLM real + MCP server real + WhatsApp
  real, nenhum dos três disponível nesta sessão. Fica para quando o Lucas validar manualmente.

### 5. Observabilidade
`audit.mcp_tool_calls` é a peça central — sem log estruturado de toda chamada (ferramenta,
duração, sucesso/erro), não dá pra saber se o agente está agindo certo. Sem isso, não libera a
persona `comercial` nem ferramenta de escrita depois.

## Mapa de dependências
| Dependência | Tipo | Descrição | Métodos |
|---|---|---|---|
| MCP server (a definir qual) | serviço externo/interno | expõe `tools/list` e `tools/call` via JSON-RPC/HTTP | `tools/list`, `tools/call` |
| OpenRouter | já em uso | tool-calling padrão OpenAI-compatible | `POST /chat/completions` com `tools` |
| Vault (`config.integracoes`) | já em uso (E00-S12) | token do MCP server | `fn_obter_segredo_integracao_interno` |

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| **A (escolhida)** — MCP remoto, allowlist por persona, só leitura | Servidor reaproveitável fora do Zé; trava de segurança em 2 camadas (config + CHECK de banco) | Mais peças que function-calling direto | Decisão explícita do Lucas — MCP é o mecanismo pedido |
| B — function-calling direto contra `pcm.*`/`atendimento.*`, sem MCP | Mais simples, menos rede | Não reusa fora do Zé; refaz o que MCP já padroniza | Contraria o pedido — o ponto era MCP |
| C — MCP local (stdio) | Sem round-trip de rede | Impossível em Edge Function (sem processo persistente) | Estruturalmente inviável na plataforma atual |

## Trade-offs e consequências
**Ganha:** primeira vez que o agente age (não só fala) — abre caminho pra especialistas/skills
virarem execução real, não só orientação de texto.
**Aceita:** MVP deliberadamente pequeno (1 ferramenta, só leitura, 1 persona) — é a superfície
mínima pra validar o padrão de segurança (allowlist + audit) antes de generalizar. Resistir à
tentação de já entregar múltiplas ferramentas/escrita no mesmo PR.

## Riscos
| Risco | Descrição | Prob. × Impacto | Mitigação |
|---|---|---|---|
| Agente chama ferramenta errada/com argumento errado | LLM alucina parâmetro | média × médio | Schema JSON valida antes de chamar; erro de validação vira `role=tool` com erro, LLM tenta de novo ou desiste |
| MCP server lento/fora do ar trava a conversa | Timeout do `fetch` nunca disparado | baixa × alto | `AbortController` com teto duro (10s), sempre |
| Ferramenta de escrita entra "por engano" depois | Alguém marca `somente_leitura=false` sem revisão | baixa × alto | `CHECK` de banco, não só validação de aplicação — mudar exige migration explícita, revisão de código |
| Custo de token dispara (schema grande, resposta grande) | Muitas ferramentas ou payload gigante no `tools/list` | média × médio | Teto de tamanho de resposta truncado antes de voltar pro LLM; `orcamentoMensalUsd` (já existe no domínio) seria o limite final |

## Roadmap da feature
| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Migration `persona_mcp_servers` + `audit.mcp_tool_calls`, ambas com RLS FORCE | — |
| 2 | `tools/list` + tradução de schema + cache em memória | 1 |
| 3 | `chamarFerramentaMcp` com timeout/truncamento/audit | 1, 2 |
| 4 | Wiring no `pcm-ze-agent`: 1 ferramenta real, 1 persona (Zé), validado manualmente pelo Lucas contra conversa real | 1, 2, 3 |
| 5 (fora desta story) | Generalizar pra mais ferramentas/personas; avaliar escrita | 4, validado |

## Questões em aberto
- [ ] Qual é o primeiro MCP server real? (interno, construído pra este fim, ou um já existente?)
      Decide o Lucas — não adivinhado aqui.
- [ ] `ferramentas_permitidas` fica só no banco ou ganha UI de configuração já na fase 1? (produto
      já decidiu: banco/Vault direto nesta fase, UI depois de validado)
