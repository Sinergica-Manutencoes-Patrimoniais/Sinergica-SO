---
name: "docs-adr-1594-avaliacao-legada-impacto-revisao-md"
description: "Documento Sinérgica SO: ADR 1594: avaliação legada na revisão de impactos"
alwaysApply: false
---

# ADR 1594: avaliação legada na revisão de impactos

Uma avaliação recebida é evidência conhecida de execução, mesmo que o estado da ocorrência permaneça pendente. A escolha do PCM sobre um ciclo legado só resolve a fonte quando não existe avaliação para essa ocorrência. A consulta mantém trava compartilhada na tabela de avaliações até o fim da transação, recusando concorrência sem espera; a avaliação retornará à conferência quando houver evidência. Não altera histórico nem comprova fontes externas. A ativação da aprovação continua condicionada aos controles existentes.
