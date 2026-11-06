---
name: "docs-adr-1586-decisao-vencidos-plano-ativado-md"
description: "Documento Sinérgica SO: ADR 1586 — Decisão preliminar de vencidos após ativação"
alwaysApply: false
---

# ADR 1586 — Decisão preliminar de vencidos após ativação

## Contexto
A decisão preliminar de vencimento exigia uma transição de retomada anterior, impedindo registrar a decisão após a primeira ativação do Plano. O critério AC-6 também contempla ativação.

## Decisão
A decisão pode ser registrada para ciclo vencido de versão aprovada cuja vigência inclua o vencimento, ainda sujeita à conferência canônica existente, autorização, revisão e gate. A decisão continua preliminar, imutável e sem efeito operacional; não gera ocorrência nem presume ausência de execução. O comportamento de retomada permanece. Plano encerrado não admite nova decisão; repetição idempotente de pedido anterior continua disponível.

## Consequências
Nenhuma autorização de geração é adicionada. A preparação explícita de vencido continua sujeita às suas próprias regras e controles.

Implementação: migration `1728_E01-S166_decisao_vencidos_ativacao.sql`.
