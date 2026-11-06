---
name: "docs-adr-0952-ciclos-vinculo-backlog-md"
description: "Documento Sinérgica SO: ADR-0952 — Ciclos históricos para escopo do Backlog"
alwaysApply: false
---

# ADR-0952 — Ciclos históricos para escopo do Backlog

Status: fundação isolada, não homologada.

## Problema

O vínculo legado `sso_backlog_parcelas` usa `pendencia_id` como chave permanente e consumidores o interpretam como associação atual. A composição e sua promoção também têm unicidade histórica. Apagar ou alterar esses vínculos para devolver escopo quebraria eventos, rastreabilidade e leitores; mantê-los como ativos impede nova promoção.

## Decisão

Preparar registro privado de ciclos, com identidade própria, origem legada explícita e unicidade de um ciclo ativo por Pendência. Uma inicialização idempotente registra somente vínculo legado pendente, sob autorização, travas e auditoria, sem alterar vínculo, parcela, Chamado, OS ou fila. A inicialização é uma fotografia operacional, não prova de interrupção ou autorização de devolução. Gate fechado e EXECUTE revogado.

Futuro comando de devolução deve encerrar ciclo anterior, registrar evento imutável e criar item disponível para nova promoção na mesma transação, após comprovar restante e prevenir execução concorrente. Promoção posterior deve criar novo ciclo e preservar o anterior. Migração de leitores e escritores, composição ativa, vínculos de Chamado e compatibilidade precisam ocorrer de forma coordenada; nenhum consumidor legado deve tratar a nova tabela como substituição completa antes disso.

## Limites

Não é devolução nem backfill completo. Revisar migração de volume, ordens de locks, idempotência, autorização, fontes de execução, referências históricas e todas as 23 ocorrências encontradas nos consumidores de `sso_backlog_parcelas`. Provar reversão, concorrência, RLS do proprietário e migração de dados antes de habilitar qualquer comando ou remover restrições legadas.
