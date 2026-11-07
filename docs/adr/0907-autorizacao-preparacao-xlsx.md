---
name: "docs-adr-0907-autorizacao-preparacao-xlsx-md"
description: "Documento Sinérgica SO: ADR-0907 — Autorização da preparação XLSX"
alwaysApply: false
---

# ADR-0907 — Autorização da preparação XLSX

Data: 2026-10-30 · Status: preparação, não implantada.

## Decisão

A futura fronteira usa chave pública Supabase e o Bearer recebido, sem credencial de serviço, para validar identidade em `auth.getUser` e consultar `config.sso_autorizar_acao('plano.gerir', cliente)`. Cada requisição cria cliente próprio sem persistência ou renovação de sessão. Nenhuma resposta diferente do booleano `true` autoriza. Erros falham fechados e não registram token ou conteúdo.

Esta verificação antecede leitura e processamento; não é uma autorização transacional para gravar. A persistência deverá repetir autorização atual no banco sob o protocolo próprio e preservar isolamento de Cliente. A função HTTP não será registrada ou habilitada antes de integração, testes reais, limites operacionais e revisão adversarial. Rollback: manter rota e gates fechados.
