---
name: "docs-adr-1245-reserva-global-codigo-grupo-md"
description: "Documento Sinérgica SO: ADR-1245 — Verificação de colisão com código de Grupo"
alwaysApply: false
---

# ADR-1245 — Verificação de colisão com código de Grupo

**Status:** proposta local, não homologada. Complementa ADR-1244.

Preparar guardas nos escritores existentes de Sistemas, Componentes, aliases e reservas de staging para recusarem códigos presentes no registro privado de Grupos, atuais ou históricos. As guardas usam a mesma trava global de códigos e falham sem esperar se ela estiver ocupada, pois o escritor pode já deter trava de linha. Não reescrevem códigos ou registros históricos.

Essa proteção é apenas uma parte da unicidade global: inventariar escritores alternativos, chamadas privilegiadas e ordem de triggers; testar concorrência, rollout e rollback antes de aplicar. Registro de Grupo segue privado e sem consumidor, e a atribuição inicial ainda não pode ser liberada. Correção/alias e staging continuam pendentes.
