---
name: design
description: Design — auditoria de contrato Auvo por entidade e decisão sobre habilitar writeEnabled.
alwaysApply: true
---

# Design — Verificar contrato Auvo real e habilitar escrita (funcionário/ferramenta/categoria/cliente)

> Tier: arquitetural (escreveria na conta Auvo de produção real, atualiza ADR-0005). Decisão do Lucas
> (AskUserQuestion, 2026-07-09): tentar destravar agora, já que sessões recentes validaram acesso real à
> API Auvo.

## O que mudou entre a pergunta e a execução

Reconferi antes de agir: as sessões recentes desta épica validaram a API real **através das Edge
Functions já deployadas** (curl/Playwright contra `pcm-auvo-*` no Supabase, que carregam
`AUVO_API_KEY`/`AUVO_USER_TOKEN` como secret do lado do servidor) — nunca com uma chave Auvo direto no
shell desta sessão. **Esta sessão não tem `AUVO_API_KEY`/`AUVO_USER_TOKEN` no ambiente local** (confirmado
por `env | grep -i auvo`, vazio) e não tenho acesso interativo ao dashboard Supabase pra invocar as
functions com um payload de teste isolado sem que ele reflita de verdade na conta Auvo do cliente.

Isso muda o que é seguro fazer nesta rodada:
- **Auditoria de contrato por leitura de código** (comparar `toAuvo()`/`toAuvoUpdate()` de cada registry
  contra os campos já confirmados nesta épica via teste real, tanto no lado de leitura — `fromAuvo()`,
  todos verificados contra `GET` real — quanto em qualquer endpoint de escrita que já roda em produção
  hoje, como `pcm-auvo-users-create`): **seguro, feito**.
- **Flipar `writeEnabled:true` sem um teste de escrita real observado**: **não é seguro fazer sozinho
  nesta sessão** — arriscaria gravar campo errado na conta Auvo real do cliente sem ter como confirmar
  antes. Mantido como estava (`false`) pra todas as 4 entidades.

## Achado concreto (auditoria, não especulação)

`_shared/auvo/registry/funcionarios.ts` `toAuvo()` enviava `phoneNumber` pro Auvo — mas
`pcm-auvo-users-create/index.ts:57` (endpoint de CREATE, que **já roda em produção hoje**, fora do outbox
genérico) usa `smartPhoneNumber`, confirmado contra a doc oficial (2026-07-08) e é o mesmo campo que o
`GET /users` real devolve (confirmado 2026-07-09). O outbox genérico (usado em EDIT, ainda desabilitado)
tinha o campo errado — se fosse habilitado assim, editar telefone de funcionário via PATCH teria
silenciosamente feito nada (Auvo ignora campo desconhecido) ou falhado. **Corrigido**: `toAuvo()` agora
usa `smartPhoneNumber`, mesmo campo do endpoint que já funciona de verdade.

## Avaliação por entidade (por que nenhuma foi flipada)

- **funcionários**: mapeamento de leitura 100% confirmado; mapeamento de escrita tinha 1 bug agora
  corrigido (acima); os demais campos (`name`, `jobPosition`, `userType`, `culture`,
  `unavailableForTasks`) batem com o que `pcm-auvo-users-create` já usa de verdade em produção — é a
  entidade de **menor risco residual**, mas ainda não tem um PATCH real observado (só o POST de criação
  foi confirmado). Recomendo esta ser a primeira a testar ao vivo quando houver uma sessão com acesso à
  API real ou com o Lucas presente pra validar no Auvo.
- **ferramentas**: `unitaryValue`/`unitaryCost` são lidos como STRING formatada em moeda (`"$0.00"`) no
  `GET`, mas o `toAuvo()` de escrita envia NÚMERO puro (`row.valor_unitario`) — não há confirmação de que
  o `POST`/`PATCH /products` aceite número puro ou exija o mesmo formato string do `GET`. Risco real e
  não resolvível por leitura de código.
- **categorias**: `produto_categorias` tem endpoint confirmado 404 (módulo não habilitado no plano Auvo)
  — flipar não teria efeito, só erro permanente. `equipamento_categorias` tem payload de escrita simples
  (`{ description }`, só 1 campo, mesmo nome do `GET`) — menor risco entre as 4, mas ainda sem teste de
  escrita real observado.
- **clientes**: maior superfície de dado sensível de negócio real (cadastro de clientes reais da
  Sinérgica). Mapeamento de leitura confirmado; mapeamento de escrita (`legalName`, `cpfCnpj`, `contacts`,
  etc.) nunca testado contra um `PATCH /customers` real. Fica por último por decisão de risco, como já
  registrado no plano.

## Decisão

**Não flipar `writeEnabled` nesta sessão.** Corrigir o que a auditoria encontrou com evidência (feito:
funcionários/`smartPhoneNumber`) e deixar registrado, por entidade, o que falta pra destravar com
segurança:

1. Uma sessão com acesso real à API Auvo (`AUVO_API_KEY`/`AUVO_USER_TOKEN` disponíveis pra teste
   controlado) ou o Lucas testando ao vivo uma edição pontual (ex.: editar o cargo de 1 funcionário de
   teste) e conferindo no Auvo se o campo realmente mudou.
2. Ordem sugerida pra esse teste, do menor pro maior risco: funcionários → equipamento_categorias →
   ferramentas (resolver primeiro o formato de moeda) → clientes.
3. Só depois de um `PATCH` real confirmado por entidade, flipar `writeEnabled:true` e escrever o teste de
   contrato Deno correspondente.

Isso não é uma regressão do que o Lucas pediu — é reportar, com uma auditoria real feita e um bug real já
corrigido, por que a parte de "testar contra a API real" não pôde ser concluída nesta sessão específica
(faltou credencial no ambiente, não faltou tentativa).

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Continua: `specs/E01-S36-write-path-instantaneo-auvo/tasks.md` (mesma pendência, agora com 1 bug a menos
  e critério mais claro de "o que falta" pra destravar).
- Arquivos tocados: `supabase/functions/_shared/auvo/registry/funcionarios.ts`,
  `supabase/functions/_shared/auvo/registry/funcionarios.test.ts`.
