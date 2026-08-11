---
name: spec
description: Contrato — desativar a pesquisa de satisfação do Auvo e tornar pcm.portal_satisfacao a fonte canônica de CSAT/NPS.
alwaysApply: true
---

# Spec — E03-S11 · Satisfação: portal é a fonte única

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Independente das demais stories E03 — pode ser feita a qualquer momento.
> Decisão do PO (2026-08-10): *"eles não utilizam essa parte do Auvo, deixe desativado, mantenha o
> do portal do cliente"*.

## Resumo
Existem duas tabelas medindo satisfação do cliente com uma OS. A da pesquisa do Auvo nunca foi
usada; a do portal é a que vale. Esta story **desativa a captação do Auvo**, declara
`pcm.portal_satisfacao` como fonte canônica e preserva o histórico sem dropar nada.

| Tabela | Origem | Situação |
|---|---|---|
| `pcm.satisfacao_respostas` (E01-S55) | pesquisa do Auvo via `pcm-auvo-support-pull` | **desativar** — nunca usada |
| `pcm.portal_satisfacao` (E09) | CSAT/NPS respondido no portal | **fonte canônica** |

## Critérios de aceite

### AC-1: Só o recurso `satisfactions` é desligado
- **Dado** a Edge Function `pcm-auvo-support-pull`, que atende três recursos
  (`questionnaires`, `expenses`, `satisfactions`)
- **Quando** esta story é aplicada
- **Então** apenas `satisfactions` deixa de ser aceito/executado; `questionnaires` e `expenses`
  continuam funcionando exatamente como hoje

### AC-2: Nenhum agendamento continua chamando o recurso desligado
- **Dado** eventuais crons ou chamadas que passem `resource: "satisfactions"`
- **Quando** a story roda
- **Então** essas chamadas são removidas ou ajustadas — nada no sistema fica invocando um recurso
  que responde erro

### AC-3: Histórico preservado
- **Dado** `pcm.satisfacao_respostas`
- **Quando** a story roda
- **Então** a tabela **não é dropada**: vira espelho inativo (sem novas escritas), com
  `comment on table` explicando a desativação e como reativar — é espelho de sistema externo, e
  reativar deve ser mudar uma decisão, não recriar schema

### AC-4: `portal_satisfacao` declarada canônica
- **Dado** a documentação do projeto
- **Quando** a story conclui
- **Então** `ARCHITECTURE.md` e `glossary.md` registram `pcm.portal_satisfacao` como fonte única de
  CSAT/NPS, e qualquer indicador futuro de satisfação lê dela

### AC-5: Painel de diagnóstico não parece quebrado
- **Dado** `PainelDadosOperacionaisAuvo.tsx`, que hoje exibe a contagem de `satisfacao_respostas`
- **Quando** o sync do recurso é desligado
- **Então** a contagem some ou aparece marcada como **desativada** — nunca como "0 registros
  sincronizados", que leria como falha de integração

### AC-6: Nenhuma regressão nos outros recursos
- **Dado** `questionnaires` e `expenses`
- **Quando** os gates rodam
- **Então** continuam sincronizando; o smoke test confirma resposta 200 para os dois

## Casos de borda e erros
- **Chamada legada com `resource: "satisfactions"`** → responde erro claro de recurso desativado,
  nunca 500 silencioso.
- **Alguém reativar no futuro** → o comentário da tabela documenta o caminho.
- **Relatório mensal citando NPS** (E01, `Relatório Mensal`) → conferir de qual tabela ele lê; se
  vier da do Auvo, reapontar para a canônica faz parte desta story.

## Fora de escopo
- **Dropar `pcm.satisfacao_respostas`** (AC-3 preserva).
- **Unificar as duas tabelas numa só** — a decisão foi desativar, não unificar.
- **Construir dashboard de satisfação** — esta story só define a fonte.
- **Mexer na pesquisa de satisfação dentro do Auvo** (é configuração do sistema externo).

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/design.md` §5.2 · `product.md` (decisão 13)
- ADR-0019 — "Dívida de fronteira", item 2
- Código afetado: `supabase/functions/pcm-auvo-support-pull/index.ts`,
  `apps/web/src/features/pcm/components/PainelDadosOperacionaisAuvo.tsx`
- Contexto: auditoria Auvo de 2026-07-10 já registrava "pesquisa de satisfação nunca ativada"
