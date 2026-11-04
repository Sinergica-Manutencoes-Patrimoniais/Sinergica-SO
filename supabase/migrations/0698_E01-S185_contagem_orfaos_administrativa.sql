-- ADR-0472: projeção global administrativa agregada, sem ação na fila.
create table pcm.reconciliacao_orfaos_admin_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.reconciliacao_orfaos_admin_gate(id,habilitado) values(true,false);
alter table pcm.reconciliacao_orfaos_admin_gate enable row level security;
alter table pcm.reconciliacao_orfaos_admin_gate force row level security;
revoke all on pcm.reconciliacao_orfaos_admin_gate from public,anon,authenticated,service_role;

create function pcm.sso_contar_orfaos_fila_admin()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n integer; sem_origem integer; sem_cliente integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_orfaos_admin_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' then raise exception 'sem_acesso' using errcode='42501'; end if;
  with amostra as materialized (
    select o.id,case when o.entity='sistemas' then s.id is null else e.id is null end as sem_origem,
      case when o.entity='sistemas' then s.id is not null and s.cliente_id is null else e.id is not null and e.client_id is null end as sem_cliente
    from pcm.auvo_sync_outbox o left join pcm.sistemas s on o.entity='sistemas' and s.id=o.row_id
      left join pcm.equipamentos e on o.entity='equipamentos' and e.id=o.row_id
    where (o.entity='sistemas' and (s.id is null or s.cliente_id is null)) or (o.entity='equipamentos' and (e.id is null or e.client_id is null))
    order by o.id limit 1001
  ), numerados as (select *,row_number() over(order by id) pos from amostra)
  select count(*)::integer,count(*) filter(where pos<=1000 and numerados.sem_origem)::integer,count(*) filter(where pos<=1000 and numerados.sem_cliente)::integer
    into n,sem_origem,sem_cliente from numerados;
  return jsonb_build_object('escopo','global_administrativo_sistemas_e_equipamentos','considerados',least(n,1000),'limite',1000,'truncado',n>1000,
    'origemAusente',sem_origem,'clienteAusente',sem_cliente,'outrasEntidades','nao_avaliadas','estadoRemoto','desconhecido');
end $$;
revoke all on function pcm.sso_contar_orfaos_fila_admin() from public,anon,authenticated,service_role;
