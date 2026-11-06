---
name: "docs-adr-0237-timeline-publica-os-md"
description: "Documento Sinérgica SO: ADR-0237 — Linha do tempo pública de status da OS"
alwaysApply: false
---

# ADR-0237 — Linha do tempo pública de status da OS

**Estado:** proposta preparatória, não homologada nem implantada.

A linha do tempo do Portal apresenta somente eventos de status da OS já acessíveis na solução existente, com enumeração restrita e data do evento. Não envia origem, metadados, textos livres, nomes, dados de equipe, fotos, custos ou comprovantes. A consulta valida contato ativo, vínculo atual à Conta e OS por chamada e pagina em ordem decrescente por data e ID. Estados desconhecidos são omitidos; ausência não significa que não houve execução.

O status `finalizado` é apresentado como status informado, sem interpretá-lo como validação/encerramento PCM ou conclusão contratual. Essa fatia não publica eventos de campo que ainda não tenham projeção segura. Gate e RPC ficam fechados. Antes de abrir, revisar significado dos estados legados, isolamento e revogação, corridas de troca de Conta, dados históricos, exposição de outras rotas do Portal, paginação e acessibilidade; executar testes e revisão adversarial.
