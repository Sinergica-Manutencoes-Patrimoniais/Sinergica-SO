---
name: db-rls-test
description: Como testar que a RLS realmente protege (Supabase local / pgTAP). Puxe ao criar/alterar policy.
alwaysApply: false
---

# Testar RLS de verdade

> Política de RLS sem teste é esperança, não garantia. RLS é a fronteira de autorização do dado —
> **prove** que um papel sem permissão é bloqueado. Roda no **Supabase local**, fora da CI unitária
> (que não tem banco). Faça quando criar/alterar policy de tabela sensível.

## Setup (uma vez)
```bash
supabase start          # sobe Postgres + Auth locais
supabase db reset       # aplica db/migrations/ do zero
```

## Opção A — teste rápido por papel (psql)
Simula o contexto de um usuário autenticado setando os claims do JWT e o `role`:
```sql
-- Simula um 'analista' (só leitura) tentando inserir → deve FALHAR
set local role authenticated;
set local request.jwt.claims = '{"sub":"u1","user_role":"analista"}';
insert into public.comissoes (venda_id, comissao_centavos) values ('v-test', 100);
-- esperado: ERROR: new row violates row-level security policy

-- Simula 'financeiro' lendo → deve PASSAR
set local request.jwt.claims = '{"sub":"u2","user_role":"financeiro"}';
select count(*) from public.comissoes;
reset role;
```

## Opção B — suíte automatizada (pgTAP)
```sql
-- supabase/tests/comissoes_rls.test.sql
begin;
select plan(2);

set local role authenticated;
set local request.jwt.claims = '{"sub":"u1","user_role":"analista"}';
select throws_ok(
  $$ insert into public.comissoes (venda_id, comissao_centavos) values ('x', 1) $$,
  '42501',  -- insufficient_privilege
  'analista não pode inserir comissão'
);

set local request.jwt.claims = '{"sub":"u2","user_role":"financeiro"}';
select lives_ok(
  $$ select 1 from public.comissoes limit 1 $$,
  'financeiro pode ler comissões'
);

select * from finish();
rollback;
```
```bash
supabase test db   # roda os testes pgTAP em supabase/tests/
```

## O que sempre cobrir
- Papel sem permissão **bloqueado** (o caso que mais quebra em produção).
- Papel com permissão **liberado** (não trancar demais).
- Multi-tenant: usuário de um tenant **não lê** dado de outro tenant.
- Tabela `audit.*` (perfil OS): UPDATE/DELETE negados inclusive para `service_role`.
