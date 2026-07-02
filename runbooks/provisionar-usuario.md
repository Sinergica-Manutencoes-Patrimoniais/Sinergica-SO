---
name: runbook-provisionar-usuario
description: Como criar um novo usuário (login + papel) no Sinérgica SO. Puxe ao dar acesso a alguém da equipe.
alwaysApply: false
---

# Runbook — Provisionar usuário

> Provisionamento é **manual e em 2 passos** nesta fase (E00-S05) — não existe tela de
> administração de usuário ainda (fora de escopo, ver `specs/E00-S05-autenticacao-autorizacao/product.md`).
> Sem os dois passos completos, o usuário não consegue logar (`AC-4`/`AC-9` do `spec.md`): login
> sem perfil em `config.usuarios` é bloqueado explicitamente pelo frontend.

## Cenário

Alguém da Sinérgica ou da Trívia precisa de acesso ao Sinérgica SO (superadmin, supervisor ou
colaborador — renomeado de admin/escritorio/tecnico em E00-S08, mesma matriz de permissão).
`cliente-sindico` **não** passa por este runbook — o acesso dele é via WhatsApp/portal (E09, ainda
não implementado).

## Pré-requisitos

- Acesso ao **Supabase Dashboard** do projeto (`nudannsrfvjggoergvyn.supabase.co`) com permissão
  de Authentication e SQL Editor — só `superadmin`/`@devops` tem isso hoje.
- Papel a atribuir: `superadmin`, `supervisor` ou `colaborador` (ver `docs/PROJECT.md` para o que
  cada um pode fazer).

## Procedimento

### Passo 1 — Criar o usuário no Supabase Auth
No Dashboard: **Authentication → Users → Add user** (ou `supabase.auth.admin.createUser()` via
script, se preferir automatizar depois). Preencha e-mail e senha temporária, marque
"Auto Confirm User" (senão o usuário precisa confirmar por e-mail antes de logar).

Anote o `user_id` (UUID) gerado — é necessário no passo 2.

### Passo 2 — Vincular o papel (config.usuarios)
No **SQL Editor** do Dashboard (roda como um role que bypassa RLS — não use isso pelo client):

```sql
select config.provisionar_usuario(
  p_user_id => '<uuid do passo 1>',
  p_papel   => 'supervisor', -- superadmin | supervisor | colaborador
  p_nome    => 'Nome Completo da Pessoa'
);
```

A função valida o papel contra a constraint (`superadmin`, `supervisor`, `colaborador`,
`cliente-sindico`) — papel inválido retorna erro claro, não insere linha inconsistente.

### Passo 3 — Confirmar
Peça para a pessoa logar em `/login` com o e-mail e a senha temporária, e trocar a senha (fluxo
padrão do Supabase Auth — "esqueci minha senha" está fora de escopo de UI própria nesta fase, usa
o e-mail de reset padrão do Supabase).

## Validação (funcionou?)
- [ ] `select * from config.usuarios where user_id = '<uuid>';` retorna 1 linha com o papel certo.
- [ ] Login em `/login` funciona e não mostra "Conta sem perfil configurado".
- [ ] A pessoa só acessa o que o papel dela permite (ver matriz de decisão em `spec.md` desta story).

## Erros comuns
- **"Conta sem perfil configurado — contate o administrador"** no login → Passo 2 não foi feito
  (ou foi feito com o `user_id` errado). Confira `select * from config.usuarios where user_id = '<uuid>';`.
- **Papel mudou mas o usuário continua vendo o acesso antigo** → o claim `user_role` só atualiza no
  próximo refresh do token do Supabase (até ~1h) ou próximo login. Para revogar com urgência:
  **Authentication → Users → (usuário) → Revoke sessions** no Dashboard.
- **`config.provisionar_usuario` retorna erro de `check constraint`** → papel digitado errado
  (confira os 4 valores exatos, sem acento/maiúscula diferente).

## Autoridade
- **Executa:** `superadmin`/`@devops` (único com acesso ao Dashboard/SQL Editor nesta fase).
- Não é possível fazer isso de dentro da aplicação — `config.provisionar_usuario` tem `execute`
  revogado de `authenticated`/`anon` de propósito (ver `supabase/migrations/0002_E00-S05_perfis_rbac.sql`).
