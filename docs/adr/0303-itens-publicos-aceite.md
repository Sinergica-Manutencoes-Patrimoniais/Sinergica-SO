---
name: "docs-adr-0303-itens-publicos-aceite-md"
description: "Documento Sinérgica SO: ADR-0303 — Apresentação e aceite de itens estruturados"
alwaysApply: false
---

# ADR-0303 — Apresentação e aceite de itens estruturados

Status: proposta; gate fechado, revisão e testes pendentes.

Quando o gate estruturado estiver ativo, propostas operacionais só podem passar a aceita se existir snapshot correspondente à versão; leitura é limitada ao contato e OS autorizados. O Portal bloqueia ação enquanto a leitura falha, carrega ou não oferece snapshot estruturado. Isso não comprova que o usuário leu o conteúdo; o comando mantém a decisão versionada e não substitui autorização no servidor. Versões antigas não são preenchidas: exigem republicação compatível ou processo próprio. Exportação PDF e versões históricas ainda precisam de alinhamento antes da ativação, assim como revisão de todos os caminhos legados e testes de isolamento/concorrência.
