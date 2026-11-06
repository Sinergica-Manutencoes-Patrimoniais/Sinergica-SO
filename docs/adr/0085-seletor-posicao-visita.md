---
name: "docs-adr-0085-seletor-posicao-visita-md"
description: "Documento Sinérgica SO: ADR-0085 — Seleção de posição da Visita"
alwaysApply: false
---

# ADR-0085 — Seleção de posição da Visita

## Decisão

Disponibilizar consulta paginada de Áreas e Locais ativos para uma Visita do Cliente, exigindo `visita.confirmar` atual e conferindo a Visita e a Área no servidor. Não exigir capacidade de gestão cadastral: selecionar posição operacional não é alterar cadastro. Local sempre é filtrado pela Área selecionada. Busca é literal, limite e cursor são validados; o comando de edição continua revalidando vínculos e revisão. Consulta não grava, não consulta Auvo e não revela posições de outro Cliente.

## Limites

Posição antiga pode ter sido movida ou desativada: a interface deve mostrar claramente esse caso e não presumir que o seletor atual represente histórico. Áreas/Locais são dados atuais, não snapshots. Testar revogação, paginação, concorrência com movimentação e acessibilidade antes de homologar; histórico aprovado e edição pós-confirmação permanecem em outras etapas. Sem deploy nesta fase.
