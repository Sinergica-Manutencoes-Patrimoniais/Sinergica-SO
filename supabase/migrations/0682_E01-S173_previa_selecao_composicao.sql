-- ADR-0456: prévia sem escrita ou composição.
create table pcm.sso_previa_selecao_composicao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_previa_selecao_composicao_gate(id,habilitado) values(true,false);
alter table pcm.sso_previa_selecao_composicao_gate enable row level security;
alter table pcm.sso_previa_selecao_composicao_gate force row level security;
revoke all on pcm.sso_previa_selecao_composicao_gate from public,anon,authenticated,service_role;
create function pcm.sso_previa_selecao_composicao(p_cliente_id uuid,p_itens jsonb)
returns table(pendencia_id uuid,revisao_solicitada integer,revisao_atual integer,situacao text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_previa_selecao_composicao_gate where id),false) then raise exception 'previa_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if exists(select 1 from jsonb_array_elements(p_itens) e(item) where jsonb_typeof(e.item) is distinct from 'object' or not (e.item ? 'id' and e.item ? 'revision') or (select count(*) from jsonb_object_keys(e.item))<>2 or jsonb_typeof(e.item->'id') is distinct from 'string' or jsonb_typeof(e.item->'revision') is distinct from 'number' or (e.item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (e.item->>'revision') !~ '^[1-9][0-9]{0,8}$') then raise exception 'itens_invalidos' using errcode='22023'; end if;
 if (select count(distinct (e.item->>'id')::uuid) from jsonb_array_elements(p_itens) e(item))<>jsonb_array_length(p_itens) then raise exception 'itens_invalidos' using errcode='22023'; end if;
 return query select (e.item->>'id')::uuid,(e.item->>'revision')::integer,p.revisao,
 case when p.id is null then 'indisponivel' when p.revisao<>(e.item->>'revision')::integer then 'revisao_alterada' when p.estado<>'aberta' then 'nao_aberta' when exists(select 1 from pcm.sso_backlog_pendencias b where b.pendencia_id=p.id) then 'ja_composta' else 'sem_conflito_observado' end
 from jsonb_array_elements(p_itens) e(item) left join pcm.sso_pendencias_tecnicas p on p.id=(e.item->>'id')::uuid and p.cliente_id=p_cliente_id order by (e.item->>'id')::uuid;
end; $$;
revoke all on function pcm.sso_previa_selecao_composicao(uuid,jsonb) from public,anon,authenticated,service_role;
