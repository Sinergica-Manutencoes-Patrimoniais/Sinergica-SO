---
name: "docs-adr-0044-selecao-alvos-plano-md"
description: "Documento Sinérgica SO: ADR-0044 — Seleção de alvos do Plano"
alwaysApply: false
---

# ADR-0044 — Seleção de alvos do Plano

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

Gestor com `plano.gerir` individual e escopo do Plano consulta uma projeção paginada dos Sistemas, Componentes e Grupos ativos do Cliente desse Plano, sem exigir a capacidade separada de gestão cadastral. A consulta não autoriza mudanças nos cadastros e não divulga outros Clientes. O Cliente é resolvido pelo Plano no servidor; alvo é revalidado transacionalmente ao salvar. Usar busca literal, cursor e limites. IDs e cadastros originais permanecem os mesmos.

A mesma consulta pode listar identificação e nome dos questionários ativos existentes, sem expor payload nem conceder edição do catálogo. Política mais ampla para leitura de Plano por não gestores, snapshot de questionários, concorrência, revisão adversarial e homologação continuam pendentes. Nenhuma execução ou integração externa é disparada.
