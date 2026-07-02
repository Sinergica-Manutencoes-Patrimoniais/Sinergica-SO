---
name: adr-0003-rbac-jwt-claim-config-usuarios
description: Decisão de modelar papel do usuário em config.usuarios e propagá-lo via Custom Access Token Hook (claim user_role no JWT), não por subquery em cada RLS policy. Puxe ao criar/alterar RLS de qualquer schema.
alwaysApply: false
---

# ADR-0003 — RBAC via claim `user_role` no JWT + tabela `config.usuarios`

**Status:** Aceito
**Data:** 2026-07-01
**Decisores:** @architect, @pm
**Relacionados:** spec `E00-S05-autenticacao-autorizacao`, design.md, `db/rls.template.sql`, `docs/ARCHITECTURE.md`

## Contexto

O Sinérgica SO precisa de uma fonte de verdade para o papel do usuário (`admin`, `escritorio`,
`tecnico`, `cliente-sindico`) que seja lida por **todas** as RLS policies das tabelas de domínio
(hoje 7 tabelas em 4 schemas; crescendo a cada story de E01 em diante). A forma como essa
resolução acontece é uma decisão estrutural: está presente em toda policy futura do sistema,
custosa de migrar depois que dezenas de policies já dependerem de um mecanismo.

O perfil single-repo do Padrão SO já documentava, em `db/rls.template.sql` e `db/README.md`, o
padrão `auth.jwt() ->> 'user_role'` para leitura de papel — mas sem especificar, para o perfil OS
(múltiplos schemas, tabela de perfis própria), como esse claim chega ao JWT.

## Decisão

1. **O papel vive em `config.usuarios`** (schema `config`, já documentado em
   `docs/ARCHITECTURE.md` como schema de governança que inclui "papéis") — não em schema novo
   dedicado, não em `raw_app_meta_data` solto no `auth.users`.
2. **O papel é propagado ao JWT via Custom Access Token Hook** (função Postgres registrada como
   Auth Hook do Supabase) — nunca por subquery a `config.usuarios` dentro de cada RLS policy.
   Toda policy de domínio lê `auth.jwt() ->> 'user_role'` diretamente, exatamente como o padrão
   single-repo já estabelecido.
3. **Nenhuma linha em `config.usuarios` existe sem papel válido** — a coluna `papel` é
   `not null` com `check` nos 4 valores permitidos. Não existe trigger automático que crie a linha
   ao surgir um `auth.users` novo (isso obrigaria um papel default implícito, ou uma linha com
   papel null, ambos rejeitados). Provisionamento é explícito via função
   `config.provisionar_usuario(...)`.
4. Usuário autenticado sem linha em `config.usuarios` (perfil ausente) recebe claim `user_role`
   ausente/null — toda policy nega por padrão (deny by default), e o frontend bloqueia o login
   com mensagem explícita, nunca crash ou acesso default.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| **JWT claim via Custom Access Token Hook** (A) | Zero custo por request; papel não forjável pelo client; consistente com `db/rls.template.sql` já existente | Papel só atualiza no próximo refresh de token; requer configurar Auth Hook no projeto (passo de config além de SQL) | **Escolhida** |
| Subquery a `config.usuarios` em cada policy | Papel sempre atualizado na hora | Custo por linha × tabela; risco de recursão de RLS mal escrita; um mecanismo novo e diferente do padrão single-repo | Rejeitada |
| Papel em `auth.users.raw_app_meta_data` (sem tabela própria) | Sem tabela nova | Sem FK/constraint de integridade; sem colunas de auditoria (`created_by`, `updated_at`) exigidas pelo baseline OS-grade; mistura dado de aplicação com schema gerido pelo Supabase | Rejeitada |
| Trigger automático em `auth.users` cria perfil | Zero passo manual de provisionamento | Não há como inferir o papel correto do novo usuário; força papel default (privilégio implícito) ou papel null (viola a garantia "nunca sem papel") | Rejeitada |

## Consequências

**Positivas:**
- Toda RLS policy de todo schema de domínio segue o mesmo padrão (`auth.jwt() ->> 'user_role' in (...)`), já documentado e testável via `db/rls-test.md` — nenhuma story futura de PCM/Comercial/Financeiro/etc. precisa redecidir isso.
- Custo de autorização por request é O(1) — leitura de claim já assinado, sem query adicional.
- Constraint `not null` + ausência de trigger cego elimina a classe de bug "usuário com papel indefinido acessando dado por acidente".

**Negativas / trade-offs aceitos:**
- Mudança de papel de um usuário não é instantânea — só reflete no próximo refresh do token do Supabase (tipicamente até ~1h, ou no próximo login). Para revogação urgente, o runbook documenta invalidar a sessão diretamente no Supabase Dashboard.
- Provisionamento de novo usuário continua manual (2 passos: criar no Auth + `provisionar_usuario`) até que haja demanda de self-service — dívida técnica aceita conscientemente, não bloqueia esta story (ver Non-goals do `product.md`).
- Depende de um recurso de configuração do projeto Supabase (Auth Hooks) além de SQL puro — se mal registrado, o sistema fica fail-closed (bloqueia todos, não expõe dado), comportamento seguro mas que exige validação manual do `@dev` antes do merge.
