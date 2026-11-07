---
name: "docs-adr-1672-hierarquia-grupos-mediada-md"
description: "Documento Sinérgica SO: ADR-1672 — Listagem mediada da hierarquia de Grupos"
alwaysApply: false
---

# ADR-1672 — Listagem mediada da hierarquia de Grupos

## Contexto

A tela chama `sso_listar_hierarquia_grupos`, mas a função privada não concede EXECUTE a usuários. A consulta já verifica Cliente, capacidade, posição, vínculos e paginação; conceder acesso ao núcleo alteraria sua fronteira.

## Decisão

Criar RPC autenticada de leitura, gate fechado por padrão e mesma projeção do núcleo, sem expor o núcleo privado. A borda valida ator e Cliente, exige READ COMMITTED, compartilha a trava de autorização, mantém gates de mediação e hierarquia sob trava e revalida capacidade após a consulta. O consumidor revalida sessão e oculta dados durante refetch e erro. Nenhum cadastro ou efeito externo é criado.

## Limites

Uma página não é fotografia transacional de todas as páginas. Gate desligado mantém consulta indisponível. Antes de habilitar, validar ACL/owner no ambiente, isolações de Cliente, permissão e revogação concorrente, dados legados, paginação, mutações e comportamento com flags; não é autorização de deploy.
