---
name: spec
description: Contrato — validação viva e habilitação gradual da escrita PCM→Auvo.
alwaysApply: true
---

# Spec — Escrita real PCM→Auvo por entidade

> **Fonte da verdade.** Status: bloqueada externamente · Tier: arquitetural. Esta story retoma a pendência
> de E01-S36: nenhuma entidade ganha `writeEnabled: true` sem teste de contrato vivo, reversível
> e documentado.

## Resumo

O PCM continua a ser a porta única de operação. Para cada entidade aprovada, a sessão verifica o
contrato real do Auvo com um registro de teste, habilita o descriptor somente após comparação
campo a campo e ajusta a UI para não afirmar que a escrita ainda é local quando o sync já é real.

## Critérios de aceite

### AC-1: contrato vivo por entidade antes do flip

- **Dado** uma entidade na ordem funcionários → categorias de equipamento → ferramentas → clientes
- **Quando** sua habilitação é avaliada
- **Então** cria ou edita um registro de teste via API, lê o resultado de volta, compara os campos
  enviados e remove/desativa o registro; uma amostra anonimizada fica registrada no `design.md`.

### AC-2: somente entidade validada propaga escrita real

- **Dado** uma entidade cujo AC-1 passou e cujo mapeamento está coberto por teste de descriptor
- **Quando** o descriptor recebe `writeEnabled: true`
- **Então** CREATE/UPDATE/DELETE suportados passam pelo outbox e `pcm-auvo-push`, sem eco no pull e
  com falha visível na saúde de sync.

### AC-3: a UI declara o estado verdadeiro por entidade

- **Dado** uma entidade habilitada
- **Quando** o usuário abre sua tela ou a Visão 360 correspondente
- **Então** o `BannerEscritaAuvoPendente` e o banner da 360 deixam de dizer que aquela escrita é
  somente local; entidades ainda bloqueadas preservam o aviso explícito.

### AC-4: falha não habilita parcialmente

- **Dado** falha, divergência de schema ou impossibilidade de limpar o registro de teste
- **Quando** o teste de contrato termina
- **Então** `writeEnabled` permanece `false`, a divergência é registrada e nenhuma outra entidade
  é promovida por semelhança.

## Fora de escopo

- Habilitar `produto_categorias` ou `servicos`, cujos endpoints retornam 404 na conta atual.
- Espelhar orçamento ou financeiro do Auvo.
- Alterar o mecanismo de outbox, anti-eco ou cron de E01-S22/E01-S36.

## Rastreabilidade

- Design: `design.md`.
- Precedente: `../E01-S36-write-path-instantaneo-auvo/spec.md`.
- Decisão durável: `../../docs/adr/0005-outbox-sync-auvo.md`.
- Roteiro: `../../docs/AUDITORIA-AUVO-API.md` §5.
