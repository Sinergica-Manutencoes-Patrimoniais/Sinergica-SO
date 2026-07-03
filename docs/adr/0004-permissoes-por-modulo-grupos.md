---
name: adr-0004-permissoes-por-modulo-grupos
description: Decisão de estender o RBAC com claim estruturado user_modulos, grupos e permissões por módulo, mantendo o padrão JWT/O(1) do ADR-0003.
alwaysApply: false
---

# ADR-0004 — Permissões por módulo via grupos + claim `user_modulos`

**Status:** Aceito
**Data:** 2026-07-02
**Decisores:** @architect, @pm
**Relacionados:** `ADR-0003`, spec `E00-S09-grupos-permissao-modulo`, `db/rls.template.sql`

## Contexto

O `ADR-0003` colocou o papel global do usuário (`user_role`) no JWT para evitar subqueries em
toda RLS policy. Isso resolveu a autorização grossa, mas não escala para um sistema operacional
acessado pela organização inteira: `supervisor` e `colaborador` são amplos demais para modelar
combinações reais de acesso por módulo.

O sistema precisa permitir que a gestão configure acesso por módulo (`pcm`, `atendimento`,
`comercial`, `financeiro`, `operacao`, `marketing`, `growth`, `gestao`, `area-cliente`) sem
deploy, mantendo o custo O(1) por request.

## Decisão

1. Adicionar tabelas de configuração no schema `config`:
   `config.grupos`, `config.grupo_modulos`, `config.usuario_modulos` e `config.usuarios.grupo_id`.
2. Um usuário tem **um modo de permissão**: grupo OU permissões individuais por módulo. Nunca os
   dois ao mesmo tempo. A invariável é garantida por triggers e pela função
   `config.definir_permissao_usuario(...)`.
3. O Custom Access Token Hook passa a emitir também o claim estruturado `user_modulos`, no formato
   `{"pcm":"escrita","comercial":"leitura"}`.
4. RLS de tabelas de domínio passa a consultar `user_modulos`:
   `SELECT` aceita `leitura` ou `escrita`; `INSERT`/`UPDATE` exigem `escrita`.
5. `superadmin` continua com bypass explícito em RLS via `user_role = 'superadmin'`.
6. `supervisor` e `colaborador` continuam valores válidos de `papel`, mas deixam de ser a fonte
   de autorização granular para tabelas de domínio. `supervisor` ainda tem capacidade especial de
   gestão de grupos/usuários, sem poder promover ninguém a `superadmin`.
7. `cliente-sindico` permanece fora deste modelo nesta fase.

## Alternativas consideradas

| Alternativa | Prós | Contras | Decisão |
|---|---|---|---|
| Claim estruturado `user_modulos` | Mantém O(1), sem subquery por linha; segue ADR-0003 | Mudanças refletem só no refresh/login | Escolhida |
| Subquery nas policies para resolver grupo/permissão | Permissão reflete na hora | Custo e risco de recursão em toda tabela; contradiz ADR-0003 | Rejeitada |
| Criar mais papéis fixos | Simples no curto prazo | Explode combinações e exige deploy para política de acesso | Rejeitada |
| Permitir grupo + override individual | Flexível | Aumenta ambiguidade e complexidade de auditoria | Rejeitada nesta fase |

## Consequências

**Positivas:**
- Novas combinações de acesso não exigem migration nem deploy.
- RLS de domínio continua rápida: lê claim assinado, sem consulta a tabelas de configuração.
- Frontend pode consultar `config.minhas_permissoes` sem decodificar JWT.

**Trade-offs aceitos:**
- Mudança de permissão não é instantânea; reflete no próximo login/refresh do token, igual ao
  `ADR-0003`.
- O hook JWT ficou mais complexo e precisa de teste de regressão antes de qualquer alteração.
- A lista de módulos é fixa em constraint SQL e em registry de frontend; novas áreas exigem
  migration + ajuste de UI.
