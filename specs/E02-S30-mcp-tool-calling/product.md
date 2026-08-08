---
name: product
description: Escopo de negócio e decisões de produto. Base pro design.md e spec.md.
alwaysApply: false
---

# Product — Comunicação com MCPs (agente executa ferramenta)

> **Status:** rascunho · **Pedido:** Lucas, 2026-08-07 ("Zé/persona ganha acesso a servidor(es)
> MCP como ferramenta")

## Problema
Hoje `PersonaItem.toolUseEnabled` é um toggle na UI (`OperacaoTab.tsx`, "Ferramentas — permite
consultar catálogo, pedidos e especialistas durante a resposta") que **não faz nada** — nenhuma
Edge Function lê esse campo, não existe nenhum mecanismo de tool-calling no `pcm-ze-agent`. O
agente só conversa; nunca age. "Skills" (`EspecialistaItem`) hoje é texto de orientação lido pelo
prompt, não uma ação que o agente executa sozinho.

O Lucas quer que o agente **execute** ações de verdade durante a conversa — consultar dado,
disparar algo — usando MCP (Model Context Protocol) como o mecanismo de acesso a essas
ferramentas.

## Por que MCP e não function-calling direto contra o próprio banco
OpenRouter (o provider de LLM já em uso) já suporta o formato padrão de tool-calling (`tools` no
corpo do `/chat/completions`, idêntico ao da OpenAI) — dava pra implementar sem MCP nenhum,
chamando `pcm.*`/`atendimento.*` direto. MCP entra por decisão explícita do Lucas: servidor MCP
é a peça reaproveitável — o mesmo servidor (ex.: "consultar OS", "consultar cliente") serve o Zé
**e** qualquer outro cliente MCP futuro (Claude Desktop do próprio Lucas, outro agente), sem
reimplementar a integração.

## Quem usa
- Persona `chamados` (Zé) — primeiro caso real: consultar chamado/OS/cliente durante a conversa
  com o síndico.
- Persona `comercial` — mais adiante, fora do MVP desta story.

## Riscos de produto (não técnicos)
- Agente **executando** ação (não só lendo) numa conversa com cliente real é a primeira vez que
  isso acontece no produto — errar aqui tem custo direto com cliente. MVP começa **só leitura**
  (consulta), nunca escrita/ação que muda dado, até haver confiança validada.
- Ferramenta mal configurada (MCP server errado, timeout, resposta gigante) pode travar ou
  encarecer a conversa — precisa de teto de tempo e de custo por chamada.

## Fora de escopo (MVP)
- Ferramenta de escrita (criar/editar/cancelar algo via MCP) — só leitura por enquanto.
- MCP server rodando localmente (stdio) — Edge Functions são HTTP-only; só MCP remoto (HTTP/SSE)
  é alcançável.
- Persona `comercial`.
- UI de "marketplace" de MCP servers — configuração é direta no banco/Vault nesta fase.

## Critério de sucesso do MVP
Zé consegue responder "qual o status da OS 1234?" chamando de verdade um MCP server que consulta
`pcm.ordens_servico`, com o resultado citado na resposta — validado manualmente pelo Lucas contra
uma conversa real, antes de generalizar pra mais ferramentas.
