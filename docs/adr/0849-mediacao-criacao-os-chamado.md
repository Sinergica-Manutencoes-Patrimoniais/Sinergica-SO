---
name: "docs-adr-0849-mediacao-criacao-os-chamado-md"
description: "Documento Sinérgica SO: ADR-0849 — Mediação de criação de OS do Chamado"
alwaysApply: false
---

# ADR-0849 — Mediação de criação de OS do Chamado

Estado: proposta local, gates fechados, não homologada. Complementa ADR-0107 e ADR-0832.

A interface de criação planejada chamava a função privada 0324 sem ter EXECUTE. A mediação adiciona wrapper autenticado com gate privado separado, verificação de sessão/Cliente e capacidade `chamado.os.criar`, lock transacional de autorização e gates, e delegação ao comando existente. O núcleo mantém ACL privada, revisão, requestId, validação de origem e bloqueios da transição legada. A interface passa a chamar o wrapper, mas segue desabilitada por flag e o servidor inicia com todos os gates fechados.

Índice singular e trigger de numeração continuam ativos. Enquanto existirem, o comando interno continua recusando criação múltipla; a mediação não autoriza removê-los nem implementa a transição completa. Testes de isolamento, concorrência, compatibilidade de todos os consumidores, migração, CI e revisão adversarial continuam obrigatórios. Não há chamada Auvo nem concessão de escrita direta. Rollback operacional é fechar o gate da mediação, preservando dados e bloqueios legados.
