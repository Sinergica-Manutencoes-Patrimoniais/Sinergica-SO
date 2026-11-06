---
name: "docs-adr-0964-ranking-unificado-backlog-md"
description: "Documento Sinérgica SO: ADR-0964 — Consulta unificada experimental de Backlog"
alwaysApply: false
---

# ADR-0964 — Consulta unificada experimental de Backlog

Status: preparação privada, não homologada.

Preparar uma consulta paginada que apresenta composições com Pendências e sem vínculo de Chamado junto a retornos aguardando, usando o cálculo GUTD compartilhado. Composições já vinculadas não entram como novo item; retorno preserva ID próprio e referência à composição de origem. A ordenação é score descendente, tipo e UUID; fatores não avaliados ficam sem score. Assinatura detecta alterações observáveis entre páginas, mas não substitui fotografia transacional.

A consulta não substitui o ranking operacional existente, não promove ou altera escopo e não comprova que a parcela anterior parou. Retornos ainda não cobrem todos os casos de escopo; filtros, concorrência, vínculos legados, integridade de Cliente, alterações entre as duas leituras e paginação devem ser validados. Execução permanece revogada e gates fechados até integração completa e revisão adversarial.
