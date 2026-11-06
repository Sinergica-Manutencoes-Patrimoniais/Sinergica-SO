---
name: "docs-adr-1037-bloqueio-encerramento-continuidade-devolvida-md"
description: "Documento Sinérgica SO: ADR-1037 — Bloqueio conservador de encerramento"
alwaysApply: false
---

# ADR-1037 — Bloqueio conservador de encerramento

Status: preparação local; não aplicada nem testada.

Enquanto os diagnósticos e comandos legados não interpretarem integralmente `devolvida_backlog`, um trigger impede encerrar ou cancelar Chamado que possua proposta nesse estado. O bloqueio atua no servidor independentemente da interface e não prova parada remota nem condição técnica resolvida. A tela informa que o diagnóstico antigo pode ser incompleto. Nenhum dado é apagado; a liberação exige protocolo auditado específico e adaptação de todos os consumidores.

Antes do rollout, avaliar caminho legado e todos os escritores, isolamento por Cliente, ordem de locks, concorrência entre transição e encerramento, revisão e rollback. Gate, EXECUTE e flags existentes continuam fechados. Não usar o diagnóstico antigo como autorização para encerrar.

Aplicar 1187–1189 em sequência controlada com o gate da transição fechado durante todo o intervalo; não conceder execução da 1187 antes de instalar e validar esta proteção e os demais consumidores.
