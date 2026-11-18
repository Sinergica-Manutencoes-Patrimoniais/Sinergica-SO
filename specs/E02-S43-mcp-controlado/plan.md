# Plano técnico — E02-S43

Ver ADR-1696 pra decisão completa. Branch empilhada em `feat/E01-S198-api-dominio-staging`
(mesmo padrão de dependência-entre-stories já usado nesta sessão) — a spec marca a story como
"bloqueada" até E01-S198 "concluída e homologada", mas isso é sobre ORDEM DE MERGE (homologação
em produção), não sobre quando dá pra desenvolver: o código de E01-S198 já existe, testado, só
não mergeado ainda. Desenvolver E02-S43 em cima dele, igual já feito com E01-S194/195/196/197
em cima de E01-S193, não viola a trava — viola seria mergear E02-S43 antes de E01-S198.

## Caminho de navegação (AC-F1)

Não há tela — é uma API pra consumidor externo (ChatGPT, Claude Desktop, outro MCP client) via
`POST /functions/v1/pcm-mcp` com JSON-RPC 2.0 (`initialize`/`tools/list`/`tools/call`).

## Flags (AC-F2)

Nenhuma `VITE_SSO_*` — Edge Function, não recurso de frontend.

## "Disponível, não ativado" (AC-F3)

Chamar uma ferramenta fora do catálogo fechado devolve erro JSON-RPC nomeado (`-32404`, "não
existe no catálogo controlado"), nunca silêncio nem 500 genérico.

## Gate novo (AC-F4)

Nenhum gate de banco novo — a tabela `sso_mcp_chamadas` não tem gate (é só log, sempre ativo
quando a função roda); a ferramenta exposta herda os gates/capacidades de `pcm-api-dominio`
(que por sua vez herda de `0315`/`0318`, já abertos).

## Linha de ativação (AC-F5)

Função pronta, tipada, testada; falta: (1) `pcm-api-dominio` (E01-S198) mergeado e homologado —
dependência real de produção, não de código; (2) nenhum cliente MCP real (ChatGPT/Claude
Desktop) está configurado pra apontar pra esta função ainda — isso é configuração do lado do
consumidor, fora do que este repositório controla.

## SPEC_DEVIATION

Ver ADR-1696: só leitura (US1) nesta etapa; registro de uso é best-effort (não transacional com
a ação de domínio, que mora em outro serviço via HTTP).
