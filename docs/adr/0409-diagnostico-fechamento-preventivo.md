---
name: "docs-adr-0409-diagnostico-fechamento-preventivo-md"
description: "Documento Sinérgica SO: ADR-0409 — Diagnóstico conservador do fechamento preventivo"
alwaysApply: false
---

# ADR-0409 — Diagnóstico conservador do fechamento preventivo

Status: preparado, gate desligado, não aplicado nem homologado. O diagnóstico compara a última declaração humana com OS atuais do vínculo legado e conta OS ausentes, adicionais, não finalizadas e sem registro de finalização validada. Não expõe outros Clientes nem altera qualquer dado. É uma fotografia sem locks: contagens zeradas não autorizam encerramento ou comprovam integralidade; o resultado sempre informa bloqueio.

O trigger 0633 não resolve ordenação geral de locks: escritores legados podem obter lock de OS antes do lock de ocorrência, enquanto 0626 usa ordem inversa. Um trigger de linha não consegue inverter o lock já obtido pela instrução. Permanece necessário inventariar transações e consumidores, definir contrato de integralidade/reconciliação, unificar ordenação em todos os caminhos e testar concorrência antes de qualquer ativação. A ponte de Visitas continua ausente.
