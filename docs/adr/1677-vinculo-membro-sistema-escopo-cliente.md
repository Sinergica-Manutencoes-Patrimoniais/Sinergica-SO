---
name: adr-1677-vinculo-membro-sistema-escopo-cliente
description: Vínculo explícito e isolado de membros distribuídos entre Sistemas.
alwaysApply: false
---

# ADR-1677 — Vínculo de membros de Sistema com isolamento por Cliente

## Estado

Proposta pendente de revisão arquitetural, execução integrada e homologação. Não autoriza deploy.

## Contexto

Um Sistema pode abranger mais de uma composição física. A associação de componentes e grupos a Sistemas precisa ser explícita, consultável e isolada por Cliente sem renomear nem substituir os cadastros existentes de Componentes e Sistemas.

## Decisão

Persistir o vínculo de membro como relação explícita entre Sistema e alvo técnico existente, sempre validando que ambos pertencem ao mesmo Cliente. Preservar os identificadores e cadastros atuais; aplicar autorização no servidor e RLS com `ENABLE` e `FORCE`. A interface consulta e altera a relação por operações mediadas e versionadas.

## Consequências

Duplicidade, alvo inexistente e relação entre Clientes diferentes devem ser recusados na fronteira transacional. Alterações precisam de revisão esperada, auditoria e cobertura para concorrência. A relação não cria automaticamente ativos nem modifica códigos públicos.

## Validação pendente

Revisão arquitetural e testes pgTAP de vínculo permitido/negado, isolamento de Cliente, concorrência, auditoria e compatibilidade com os cadastros atuais.
