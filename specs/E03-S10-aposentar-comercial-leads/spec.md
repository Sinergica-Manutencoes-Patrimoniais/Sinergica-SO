---
name: spec
description: Contrato — aposentar comercial.leads com segurança, tratando a FK de conversas e o check de vinculos.
alwaysApply: true
---

# Spec — E03-S10 · Aposentar `comercial.leads`

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> ⚠️ **Bloqueada pela E03-S09.** Só executar depois que o agente estiver em produção criando
> oportunidade e a tabela tiver parado de receber linha nova (`design.md` §4.3).

## Resumo
Remove a última violação de R1 no schema `comercial`: uma tabela cujo único escritor era o
Atendimento. Aposentadoria em duas etapas — primeiro read-only, depois drop —, tratando a FK
`atendimento.conversas.lead_id` e o check de `relacionamento.vinculos`.

## Critérios de aceite

### AC-1: Pré-condição verificada, não assumida
- **Dado** o início da implementação
- **Quando** o desenvolvedor começa
- **Então** confirma por query em produção que a **S09 está em produção** e que
  `comercial.leads` não recebe linha nova (nenhum `created_at` posterior ao deploy da S09) —
  se receber, a story **para** e o problema volta para a S09

### AC-2: Nenhum dado é descartado sem destino
- **Dado** eventuais linhas em `comercial.leads`
- **Quando** a story roda
- **Então** cada uma vira oportunidade (mesma lógica da RPC da S09) **antes** de qualquer drop;
  a contagem de origem e destino é conferida por query

### AC-3: Read-only antes do drop
- **Dado** a tabela migrada
- **Quando** a primeira migration roda
- **Então** INSERT/UPDATE são revogados de `service_role` e `authenticated`, e a tabela permanece
  legível por um ciclo — se algo ainda escrever, falha visível e reversível, não perda silenciosa

### AC-4: FK de conversas tratada
- **Dado** `atendimento.conversas.lead_id` referenciando `comercial.leads`
- **Quando** a tabela é dropada
- **Então** a coluna passa a apontar para a oportunidade (ou é removida, se `oportunidade_id` já
  cobrir) **sem** quebrar o Inbox nem o histórico de conversa — decidido com o uso real na mão

### AC-5: Check de `vinculos` limpo
- **Dado** `relacionamento.vinculos.entidade_tipo` com `'comercial_lead'` no check
- **Quando** a limpeza roda
- **Então** eventuais linhas com esse tipo são convertidas para `'pcm_cliente'` com o
  `cliente_id` correto, e só então o valor sai do check — revogando o que o ADR-0007 previa
  (já registrado no ADR-0020)

### AC-6: Drop reversível e documentado
- **Dado** a migration de drop
- **Quando** é escrita
- **Então** traz no comentário o DDL completo de recriação (padrão de "Rollback" das migrations do
  projeto) — a tabela some, a forma dela não

### AC-7: Nada quebra depois do drop
- **Dado** a tabela removida
- **Quando** os gates rodam
- **Então** nenhuma referência a `comercial.leads` sobra em código, Edge Function, tipos gerados ou
  teste — busca textual no repo confirma

## Casos de borda e erros
- **Linha nova aparecendo durante a story** → AC-1 barra: a S09 não está completa.
- **Conversa apontando para lead que virou oportunidade** → AC-4 reaponta antes do drop.
- **Tipos gerados (`packages/database`) desatualizados** → regenerar faz parte da story.

## Fora de escopo
- Alterar o comportamento do agente (é a S09).
- Mexer em `comercial.oportunidades` além do necessário para receber os dados.

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/design.md` §4.3 · ADR-0019 (R1) · ADR-0020
- Bloqueada por: `../E03-S09-agente-lead-funil/spec.md`
