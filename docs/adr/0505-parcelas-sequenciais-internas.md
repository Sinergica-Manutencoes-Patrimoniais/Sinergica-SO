---
name: "docs-adr-0505-parcelas-sequenciais-internas-md"
description: "Documento Sinérgica SO: ADR-0505 — parcelas internas sequenciais"
alwaysApply: false
---

# ADR-0505 — parcelas internas sequenciais

Status: proposto; gates fechados, não aplicado nem homologado. Cada documento usa requestId próprio como identidade, preserva origem e seleção, e um item pode ter vários documentos históricos. Sob lock do item, no máximo uma reserva interna permanece ativa por vez. Após liberação ou conversão, outra parcela pode ser preparada; o saldo oficial é revalidado no comando de emissão. A restrição é deliberadamente sequencial e não permite reservas paralelas para um mesmo item.

Não há agrupamento de vários candidatos no mesmo documento. Alteração e cancelamento por outras rotas, fechamento, saldo, estornos e lock ordering precisam de auditoria completa e testes concorrentes. O gate continua fechado; a estrutura não deve ser tratada como demonstração de AC-4 até a validação integral. Não emite NF ou cobrança.
