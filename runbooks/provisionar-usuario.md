---
name: runbook-provisionar-usuario
description: Como criar um novo usuário (login + papel) no Sinérgica SO. Puxe ao dar acesso a alguém da equipe.
alwaysApply: false
---

# Runbook — Provisionar usuário

> Desde `E00-S09`, o caminho principal é a Edge Function `config-gerenciar-usuario`, que cria o
> usuário no Supabase Auth, vincula `config.usuarios` e define grupo/permissões iniciais numa
> única operação. O SQL Editor fica como fallback administrativo.

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

## Procedimento recomendado — Edge Function

Requisição autenticada como `superadmin` ou `supervisor`:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/config-gerenciar-usuario" \
  -H "Authorization: Bearer <jwt-superadmin-ou-supervisor>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pessoa@sinergica.com.br",
    "senha": "senha-temporaria-forte",
    "nome": "Nome Completo",
    "papel": "colaborador",
    "modo": {
      "tipo": "grupo",
      "grupoId": "<uuid-do-grupo>"
    }
  }'
```

Modo individual:

```json
{
  "tipo": "individual",
  "permissoes": {
    "pcm": "leitura",
    "comercial": "escrita"
  }
}
```

`supervisor` pode criar/editar usuários comuns, mas não pode criar nem promover `superadmin`.

## Fallback — SQL Editor

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

### Passo 3 — Definir grupo ou permissões individuais

Grupo:

```sql
select config.definir_permissao_usuario(
  p_user_id => '<uuid do passo 1>',
  p_grupo_id => '<uuid do grupo>',
  p_permissoes => null
);
```

Permissões individuais:

```sql
select config.definir_permissao_usuario(
  p_user_id => '<uuid do passo 1>',
  p_grupo_id => null,
  p_permissoes => '{"pcm":"leitura","comercial":"escrita"}'::jsonb
);
```

### Passo 4 — Confirmar
Peça para a pessoa logar em `/login` com o e-mail e a senha temporária, e trocar a senha (fluxo
padrão do Supabase Auth — "esqueci minha senha" está fora de escopo de UI própria nesta fase, usa
o e-mail de reset padrão do Supabase).

## Validação (funcionou?)
- [ ] `select * from config.usuarios where user_id = '<uuid>';` retorna 1 linha com o papel certo.
- [ ] `select * from config.resolver_permissoes_modulo('<uuid>');` retorna os módulos esperados.
- [ ] Login em `/login` funciona e não mostra "Conta sem perfil configurado".
- [ ] A pessoa só acessa os módulos definidos por grupo/permissão individual.

## Erros comuns
- **"Conta sem perfil configurado — contate o administrador"** no login → Passo 2 não foi feito
  (ou foi feito com o `user_id` errado). Confira `select * from config.usuarios where user_id = '<uuid>';`.
- **Papel mudou mas o usuário continua vendo o acesso antigo** → o claim `user_role` só atualiza no
  próximo refresh do token do Supabase (até ~1h) ou próximo login. Para revogar com urgência:
  **Authentication → Users → (usuário) → Revoke sessions** no Dashboard.
- **Permissão mudou mas a sidebar/RLS continua antiga** → mesmo comportamento: `user_modulos` só
  atualiza no próximo refresh/login.
- **`config.provisionar_usuario` retorna erro de `check constraint`** → papel digitado errado
  (confira os 4 valores exatos, sem acento/maiúscula diferente).
- **Erro de exclusividade grupo/permissão individual** → o usuário não pode ter `grupo_id` e linhas
  em `config.usuario_modulos` ao mesmo tempo. Use `config.definir_permissao_usuario`, que troca o
  modo atomicamente.

## Autoridade
- **Executa:** `superadmin`/`supervisor` pela aplicação/Edge Function; `@devops`/SQL Editor como
  fallback.
- `config.provisionar_usuario` segue revogado de `authenticated`/`anon`; a aplicação usa a Edge
  Function com `service_role`, nunca chama essa função direto do client.
