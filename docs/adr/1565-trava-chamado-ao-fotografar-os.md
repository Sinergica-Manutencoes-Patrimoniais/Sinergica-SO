---
name: "docs-adr-1565-trava-chamado-ao-fotografar-os-md"
description: "Documento Sinérgica SO: ADR-1565 — Serializar fotografia por Chamado"
alwaysApply: false
---

# ADR-1565 — Serializar fotografia por Chamado

A migration 1689 travava globalmente as duas tabelas de mapeamento preventivo antes de saber se a OS era preventiva. Uma inserção concorrente em qualquer Cliente podia impedir a criação de OS corretiva com Chamado.

Substituir essas travas globais por `FOR UPDATE NOWAIT` na linha do próprio Chamado. As FKs imediatas das duas tabelas de mapeamento exigem KEY SHARE na mesma linha ao vincular o Chamado e, portanto, serializam a criação do vínculo com a leitura/fotografia da OS. A trava permanece até o fim da transação; concorrência no mesmo Chamado falha fechada, sem bloquear Chamados de outros Clientes. A guarda de versão, a fotografia e a 1045 não mudam.

A aplicação exige comprovar FKs ativas/imediatas e escritores sem desativar triggers, concorrência dos dois modos, integridade/rollback e compatibilidade antes de homologação. Escritas privilegiadas que desabilitem FKs ficam fora da garantia. Reversão restaura a trava global da 1689, sem apagar dados.
