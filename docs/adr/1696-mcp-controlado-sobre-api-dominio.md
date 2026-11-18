---
name: "docs-adr-1696-mcp-controlado-sobre-api-dominio-md"
description: "Documento Sinérgica SO: ADR-1696 — MCP controlado, catálogo fechado sobre a API de domínio (E02-S43)"
alwaysApply: false
---

# ADR-1696 — MCP controlado, catálogo fechado sobre a API de domínio (E02-S43)

**Status:** aceita · **Data:** 2026-11-18 · **Story:** E02-S43 · **Tier:** arquitetural · **P2**
**Depende de:** E01-S198 (API de domínio) — branch stacada em `feat/E01-S198-api-dominio-staging`,
mesmo padrão de empilhamento já usado nesta sessão pras demais dependências entre stories.

## Contexto

Não existe camada conversacional oficial (`E02-S30` parado desde 2026-08-07). A regra do pacote é
restritiva: o MCP expõe ferramentas controladas, usa a API de domínio — nunca acessa o banco
direto — e a primeira entrega é só leitura.

## Decisão

- `pcm-mcp` é uma Edge Function que implementa o subconjunto mínimo de JSON-RPC 2.0 do MCP
  (`initialize`, `tools/list`, `tools/call`). **Não importa nenhum client com acesso a
  `schema("pcm")` pra dado de domínio** — a única forma de efeito é `fetch` pra
  `pcm-api-dominio` (E01-S198), repassando o `Authorization` do usuário real. É isso que garante
  AC-7 ("texto não concede capacidade" — a decisão de autorização roda inteira do lado de lá,
  nunca aqui) e AC-9 (revogação imediata — herdada de `config.sso_autorizar_acao`, que já
  re-verifica `config.usuarios.ativo` a cada chamada, sem cache).
- Catálogo de ferramentas **fechado e estático em código** (`FERRAMENTAS`, um objeto TS) — nunca
  um nome vindo de fora. Nesta etapa, 1 ferramenta: `consultar_levantamento` (mapeia pra
  `levantamento.consultar_previa`). Key Entities da spec permite isso: "ferramenta MCP (catálogo,
  capacidade exigida)" é a entidade nova aceita — um catálogo em código satisfaz, não precisa de
  tabela (o catálogo muda por deploy, não por dado).
- **Registro de uso append-only** (`pcm.sso_mcp_chamadas`, migration `1855`) — a outra entidade
  nova da spec. Grava TODA chamada, sucesso ou recusa (AC-6/AC-8), no contexto do ator real.
- **Guard de CI** (`scripts/check-mcp-ferramentas-controladas.mjs`): falha o build se o arquivo
  ganhar `.schema("pcm").from(` ou `.rpc(` pra qualquer RPC de domínio além da própria auditoria
  (`sso_registrar_uso_mcp`), se aparecer padrão de SQL genérico, ou `service_role` — mesma trava
  estrutural do guard da E01-S198, aplicada à camada de cima.

## SPEC_DEVIATION — registrado, não corrigido nesta etapa

1. **Só leitura (US1)** — exatamente como a spec pede ("a primeira entrega é leitura; escrita
   vem depois"). Escrita exigiria um fluxo de proposta+confirmação que `pcm-api-dominio` ainda
   não tem (hoje `levantamento.criar_lote` é direto, sem passo de confirmação separado) — próxima
   etapa, depois que a etapa de escrita da própria API de domínio também evoluir.
2. **Registro de uso é best-effort, não transacional com a ação de domínio.** O log
   (`sso_registrar_uso_mcp`) e a ação real (chamada HTTP pra `pcm-api-dominio`) são duas
   operações em serviços diferentes — não há como torná-las atômicas sem um protocolo de duas
   fases que esta story não constrói. Se o registro falhar depois da ação ter sucedido, a
   resposta da ferramenta não é bloqueada (log é auditoria, não é a operação principal) — mas
   SC-003 ("logs identificam usuário e ferramenta em 100% das chamadas") não é uma garantia
   matematicamente absoluta, é best-effort com falha silenciosa só do lado do log. Risco aceito:
   a ação em si sempre passa pela autorização/auditoria da RPC de domínio (essa auditoria,
   `audit.events`, é transacional com a ação — é a auditoria MCP-específica, "qual ferramenta",
   que é best-effort).

## Consequências

- Positiva: primeira camada conversacional oficial, com trava estrutural (CI) contra virar
  acesso direto ao banco; substitui o design parado de E02-S30.
- Negativa/aceita: só leitura; log de uso best-effort, não transacional.
- Reversível: nenhuma dependência de infraestrutura externa de MCP (sem SDK), só Deno/HTTP — fácil
  de substituir por uma lib oficial de MCP se/quando adotada, sem mudar o contrato de ferramentas.

## Referências

`supabase/functions/pcm-mcp/index.ts` · `scripts/check-mcp-ferramentas-controladas.mjs` ·
`supabase/migrations/1865_E02-S43_registro_uso_mcp.sql` · ADR-1695 (E01-S198, API de domínio).
