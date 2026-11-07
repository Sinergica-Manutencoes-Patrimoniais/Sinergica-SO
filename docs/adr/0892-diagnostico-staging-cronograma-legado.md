---
name: "docs-adr-0892-diagnostico-staging-cronograma-legado-md"
description: "Documento Sinérgica SO: ADR-0892 — Diagnóstico anterior à reconciliação do staging de cronogramas"
alwaysApply: false
---

# ADR-0892 — Diagnóstico anterior à reconciliação do staging de cronogramas

Data: 2026-10-30 · Status: preparação; sem autorização de migração ou habilitação.

## Contexto

A migration 0347 criou lotes, revisões e comandos separados; a 0361 revoga o acesso legado e encaminha novos cronogramas ao staging S178. A tarefa T003 continua aberta: os dados legados não são automaticamente transportáveis. Há diferenças de restrições, referências de usuários, identificadores de origem e espaço de request IDs. Recriar um lote sem suas revisões ou reaproveitar um request ID poderia quebrar histórico e idempotência.

## Decisão

Preparar diagnóstico SQL de leitura, executável por operador autorizado em transação read-only, sem alterar dados nem expor conteúdo da matriz ou observações. Para cada lote, verificar formato e limites de matriz/fonte do receptor canônico, existência dos atores no cadastro, continuidade e referência de revisões, colisões de lote, origem e request IDs, e coerência dos comandos legados associados. Produzir indicadores, não classificar o lote como automaticamente migrável: dados e permissões podem mudar após a consulta.

Nenhum vínculo é inferido para comando sem identificação inequívoca de lote. Relatar contagem de comandos sem vínculo legível em resumo separado; o tratamento depende de investigação. Não interpretar ausência de problemas detectados como prova de integridade, de autorização ou de segurança para importar.

## Compatibilidade e retorno

Diagnóstico não migra, aprova, apaga nem ativa nada; mantém originais e gates. Futuro transporte requer decisão arquitetural própria, autorização atual, validação transacional, serialização de concorrência, preservação de IDs, atores, revisões, comandos e auditoria, testes negativos e revisão adversarial. Reverter diagnóstico consiste em deixar de executar o script. Não executar contra banco oficial sem coordenação operacional.
