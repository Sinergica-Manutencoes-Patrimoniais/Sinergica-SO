# Plano técnico — E01-S189 Alcance dos escritores sem gate

> Detalhe técnico. AC referenciados vêm de `spec.md`.

## As sete funções e suas assinaturas

Obter as assinaturas exatas antes de escrever a migration:

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in (
  'sso_criar_orcamento_operacional','sso_declarar_repasse_despesa','sso_ratear_despesa_visita',
  'sso_alterar_previsao_visita','sso_publicar_cobranca_os','sso_criar_grupo_atomico',
  'sso_editar_grupo_idempotente')
order by 1,2;
```

Confirmar o estado atual (esperado: todas sem grant):

```sql
select p.proname, has_function_privilege('authenticated', p.oid, 'execute') from pg_proc p where ...
```

## Padrão a seguir — mediador com gate

Exemplar no repositório: `pcm.sso_informar_material_mediado` (migration 1061). Replicar a forma,
não inventar outra:

```sql
create table <schema>.sso_<acao>_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into <schema>.sso_<acao>_gate(id, habilitado) values (true, false);
alter table <schema>.sso_<acao>_gate enable row level security;
alter table <schema>.sso_<acao>_gate force row level security;
revoke all on <schema>.sso_<acao>_gate from public, anon, authenticated, service_role;

create function <schema>.sso_<acao>_mediada(<mesmos args do núcleo>)
returns <mesmo retorno> language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from <schema>.sso_<acao>_gate g where g.id), false) then
    raise exception '<acao>_indisponivel' using errcode = '55000';   -- AC-1: motivo nomeado
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  perform 1 from <schema>.sso_<acao>_gate g where g.id for share;    -- reconfere sob lock
  if not coalesce((select g.habilitado from <schema>.sso_<acao>_gate g where g.id), false) then
    raise exception '<acao>_indisponivel' using errcode = '55000';
  end if;
  if auth.uid() is null then raise exception 'sem_acesso' using errcode = '42501'; end if;
  return <schema>.sso_<acao>(<args>);
end; $$;

revoke all on function <schema>.sso_<acao>(<args>) from public, anon, authenticated, service_role;
revoke all on function <schema>.sso_<acao>_mediada(<args>) from public, anon, authenticated, service_role;
grant execute on function <schema>.sso_<acao>_mediada(<args>) to authenticated;
```

**Atenção:** o `for share` no gate é seguro aqui porque estas são funções de **escrita**. Não
replicar esse padrão em caminho de leitura — foi exatamente isso que quebrou produção na migration
1809 e exigiu a correção 1841 (`25006` em transação read-only do PostgREST).

Nomes de erro sugeridos, um por ação (AC-1): `orcamento_operacional_indisponivel`,
`repasse_despesa_indisponivel`, `rateio_despesa_indisponivel`, `previsao_visita_indisponivel`,
`cobranca_os_indisponivel`, `grupo_atomico_indisponivel`, `edicao_grupo_indisponivel`.

## Migration

Numeração: próxima livre após a maior da `main` no momento da implementação (conferir
`ls supabase/migrations | tail -1`; em 13/11 a maior era `1847`).

A GitHub Integration **não** roda migration em transação. Como esta migration cria tabelas,
funções e grants de forma aditiva e independente, não exige bloco atômico — mas se algum par
precisar ser indivisível, usar `do $$ ... $$` com DDL por `execute`, como na `1842`.

Cada `drop`/`revoke` precisa de `-- Reverso:` documentado, exigência de `scripts/lint-migrations.mjs`.

## Front

Localizar os chamadores das sete ações (`grep -rn "sso_criar_orcamento_operacional" apps/web/src`
e equivalentes) e, em cada um:

1. apontar o adapter para o **mediador** (`_mediada`), não para o núcleo;
2. consultar o diagnóstico de E01-S188 — ou, enquanto ele não existir, a própria resposta `55000`
   — para desabilitar o controle com explicação, em vez de deixar clicar e falhar (AC-4);
3. distinguir na mensagem `55000` (não liberado) de `42501` (sem permissão) — AC-5. O helper
   `apps/web/src/lib/http/problem.ts` é o lugar certo para esse mapeamento.

Cada ação tem sua flag `VITE_SSO_*_ENABLED` própria se ainda não tiver.

## Testes

**pgTAP**, um arquivo por jornada (orçamento, despesas, cobrança, grupos) — não um por função,
para que o teste conte a história da jornada:

- gate fechado recusa com o erro **nomeado** daquela ação (AC-1);
- gate aberto + concessão correta executa; replay por `request_id` devolve o mesmo recibo (AC-2);
- gate aberto + usuário sem concessão, e gate aberto + Cliente divergente, ambos recusados (AC-3);
- o núcleo continua revogado de `authenticated` depois da migration — a prova de que não vazou alcance (SC-002).

**Vitest**: controle desabilitado quando a ação está indisponível; mensagem distinta para 55000 e 42501.

## Ordem sugerida

1. Levantar assinaturas reais (consulta acima).
2. Migration: 7 gates + 7 mediadores + grants.
3. pgTAP por jornada.
4. Adapters e telas.
5. Registro em E01-S188.

## Riscos

- **Assinatura errada no mediador** quebra silenciosamente: o PostgREST resolve por nome e tipos. Conferir com `pg_get_function_identity_arguments`, não por leitura do arquivo da migration original.
- **`for share` em caminho de leitura**: ver aviso acima. Estas são de escrita; não generalizar.
- **Dar grant no núcleo por engano** anula a story inteira. O pgTAP de SC-002 existe para pegar isso.
