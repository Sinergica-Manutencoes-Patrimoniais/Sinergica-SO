-- ADR-0815: leitura em lote, sem criar OS ou afirmar conclusão.
create table pcm.sso_resumo_chamado_lote_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.sso_resumo_chamado_lote_gate enable row level security;
alter table pcm.sso_resumo_chamado_lote_gate force row level security;
revoke all on pcm.sso_resumo_chamado_lote_gate from public,anon,authenticated,service_role;
insert into pcm.sso_resumo_chamado_lote_gate(id,habilitado) values(true,false);

create function pcm.sso_resumir_chamados_lote(p_ids uuid[])
returns table(chamado_id uuid,total bigint,finalizadas bigint,etapas_mistas boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_resumo_chamado_lote_gate where id),false) then raise exception 'resumo_chamado_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_ids is null or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 return query
 with candidatos as (
   select c.id,c.cliente_id,c.ordem_servico_id from pcm.chamados c
   where c.id=any(p_ids) and c.deleted_at is null and config.sso_autorizar_acao('chamado.encerrar',c.cliente_id) is true
 ), validos as (
   select c.* from candidatos c where
     not exists(select 1 from pcm.ordens_servico o where o.chamado_id=c.id and o.deleted_at is null and o.client_id is distinct from c.cliente_id)
     and not exists(select 1 from pcm.ordens_servico o join pcm.chamados outro on outro.ordem_servico_id=o.id where o.chamado_id=c.id and o.deleted_at is null and outro.id<>c.id and outro.deleted_at is null)
     and (c.ordem_servico_id is null or (
       exists(select 1 from pcm.ordens_servico o where o.id=c.ordem_servico_id and o.client_id=c.cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=c.id))
       and not exists(select 1 from pcm.chamados outro where outro.id<>c.id and outro.ordem_servico_id=c.ordem_servico_id and outro.deleted_at is null)))
 ), ordens as (
   select c.id chamado_id,o.id,o.status from validos c join pcm.ordens_servico o
     on (o.chamado_id=c.id or (o.id=c.ordem_servico_id and o.chamado_id is null))
     and o.client_id=c.cliente_id and o.deleted_at is null
 )
 select o.chamado_id,count(*),count(*) filter(where o.status='finalizado'),
   bool_and(o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao','finalizado','cancelado')) and count(distinct o.status)>1
 from ordens o group by o.chamado_id;
end; $$;
revoke all on function pcm.sso_resumir_chamados_lote(uuid[]) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resumir_chamados_lote(uuid[]) to authenticated;
