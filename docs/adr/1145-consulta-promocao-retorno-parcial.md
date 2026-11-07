---
name: "docs-adr-1145-consulta-promocao-retorno-parcial-md"
description: "Documento Sinérgica SO: ADR-1145 — Consulta da promoção de retorno parcial"
alwaysApply: false
---

# ADR-1145 — Consulta da promoção de retorno parcial

Status: proposta local, gate fechado; não aplicada nem homologada.

Operador com capacidades de promoção, validação e gestão de escopo poderá consultar o recibo imutável de promoção pelo Cliente e retorno. A leitura confere identidade atual, propriedade do retorno e dos Chamados de origem/destino; não permite repetir ação nem cria OS ou tarefa. Um retorno sem recibo é apenas ausência nesta consulta.

A leitura não prova execução ou parada remota. Gate permanece fechado até validar autorização, mudança de Cliente, preservação histórica, reconsulta, acesso cruzado, RLS/FORCE e revisão adversarial. O resultado não substitui conciliação de tentativas incertas.
