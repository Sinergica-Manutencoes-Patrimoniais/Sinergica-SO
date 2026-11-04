-- ADR-0851: quadro adicional; quadro de OS e restrições de escrita permanecem intactos.
create table pcm.sso_quadro_chamados_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_quadro_chamados_gate enable row level security;
alter table pcm.sso_quadro_chamados_gate force row level security;
revoke all on pcm.sso_quadro_chamados_gate from public,anon,authenticated,service_role;
insert into pcm.sso_quadro_chamados_gate(id,habilitado) values(true,false);

create function pcm.sso_rejeitar_vinculo_quadro_chamados() returns boolean language plpgsql set search_path='' as $$
begin raise exception 'vinculo_legado_inconsistente' using errcode='23514'; end; $$;
revoke all on function pcm.sso_rejeitar_vinculo_quadro_chamados() from public,anon,authenticated,service_role;

create function pcm.sso_listar_chamados_gerenciais(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text,status_chamado text,total_os bigint,finalizadas bigint,etapas_mistas boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.sso_quadro_chamados_gate g where g.id),false) then raise exception 'quadro_chamados_bloqueado' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quadro_chamados_gate g where g.id for share;
 if not coalesce((select g.habilitado from pcm.sso_quadro_chamados_gate g where g.id),false) then raise exception 'quadro_chamados_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query
 with candidatos as materialized (
   select c.id,c.numero,c.titulo,c.status,c.cliente_id,c.ordem_servico_id
   from pcm.chamados c where c.cliente_id=p_cliente_id and c.deleted_at is null and (p_apos is null or c.id>p_apos)
   order by c.id limit p_limite
 ), invalidos as (
   select c.id from candidatos c where
     exists(select 1 from pcm.ordens_servico o where o.chamado_id=c.id and o.deleted_at is null and o.client_id is distinct from c.cliente_id)
     or exists(select 1 from pcm.ordens_servico o join pcm.chamados outro on outro.ordem_servico_id=o.id where o.chamado_id=c.id and o.deleted_at is null and outro.id<>c.id and outro.deleted_at is null)
     or (c.ordem_servico_id is not null and (
       not exists(select 1 from pcm.ordens_servico o where o.id=c.ordem_servico_id and o.client_id=c.cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=c.id))
       or exists(select 1 from pcm.chamados outro where outro.id<>c.id and outro.ordem_servico_id=c.ordem_servico_id and outro.deleted_at is null)))
 ), totais as (
   select c.id,count(o.id) total,count(o.id) filter(where o.status='finalizado') concluidas,
     coalesce(bool_and(o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao','finalizado','cancelado')) filter(where o.id is not null),false) and count(distinct o.status)>1 mistas
   from candidatos c left join pcm.ordens_servico o on (o.chamado_id=c.id or (o.id=c.ordem_servico_id and o.chamado_id is null)) and o.client_id=c.cliente_id and o.deleted_at is null
   group by c.id
 )
 select c.id,c.numero::text,c.titulo::text,c.status::text,t.total,t.concluidas,t.mistas
 from candidatos c join totais t on t.id=c.id
 where case when exists(select 1 from invalidos) then pcm.sso_rejeitar_vinculo_quadro_chamados() else true end
 order by c.id;
end; $$;
revoke all on function pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer) to authenticated;
