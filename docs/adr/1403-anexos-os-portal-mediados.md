---
name: "docs-adr-1403-anexos-os-portal-mediados-md"
description: "Documento Sinérgica SO: ADR-1403 — Anexos públicos de OS mediados"
alwaysApply: false
---

# ADR-1403 — Anexos públicos de OS mediados

A listagem retorna somente identificação, título e data de publicações autorizadas ao contato e Cliente. O resolvedor de caminho é exclusivo do serviço e recebe o usuário autenticado pela borda; confere contato ativo, OS, publicação, revogação e objeto privado. O caminho não é entregue ao navegador. Gates de lista e download começam fechados.

A rota revalida depois de baixar; não é possível revogar bytes já entregues. Antes de ativar: testes reais de Auth/Storage, vazamento de caminhos, limites, publicação e revogação concorrentes, permissões, RLS/FORCE e revisão adversarial. Nenhum arquivo é publicado por esta alteração.
