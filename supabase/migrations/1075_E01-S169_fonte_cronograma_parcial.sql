-- ADR-0890: fonte parcial, sem inferir execução ou capacidade.
create table pcm.sso_cronograma_exportacao_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_cronograma_exportacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_cronograma_exportacao_gate enable row level security;
alter table pcm.sso_cronograma_exportacao_gate force row level security;
revoke all on pcm.sso_cronograma_exportacao_gate from public,anon,authenticated,service_role;

create function pcm.sso_ocorrencias_cronograma_exportacao(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_inicio date,p_fim date,p_apos_tipo text,p_apos_id uuid,p_limite integer)
returns table(tipo text,id uuid,cliente_id uuid,plano_id uuid,versao_id uuid,rotina_id uuid,alvo_id uuid,vencimento_original date,data_programada date,visita_estado text,visita_revisao integer,snapshot_hash text,completude text)
language plpgsql volatile security definer set search_path='' as $$
declare v_fotografia jsonb;
begin
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366
   or p_limite is null or p_limite not between 1 and 100 or ((p_apos_tipo is null)<>(p_apos_id is null))
   or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then
   raise exception 'consulta_invalida' using errcode='22023';
 end if;
 v_fotografia:=pcm.sso_snapshot_exportacao_conferido(p_cliente_id,p_plano_id,p_versao_id,0,1);
 perform 1 from pcm.sso_cronograma_exportacao_gate g where g.id for share;
 if not coalesce((select g.habilitado from pcm.sso_cronograma_exportacao_gate g where g.id),false) then
   raise exception 'cronograma_exportacao_bloqueado' using errcode='55000';
 end if;
 if auth.uid() is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
   raise exception 'sem_acesso' using errcode='42501';
 end if;
 return query with fontes as (
   select 'calendario'::text tipo,o.id,o.plano_id,o.versao_id,o.rotina_id,o.alvo_id,o.vencimento_original,
     null::date data_programada,null::text visita_estado,null::integer visita_revisao
   from pcm.ocorrencias_rotina_preparadas o
   where o.plano_id=p_plano_id and o.versao_id=p_versao_id and o.vencimento_original between p_inicio and p_fim
   union all
   select 'visita'::text,o.id,o.plano_id,o.versao_id,o.rotina_id,o.alvo_id,o.vencimento_original,
     case when v.estado='cancelada' then null else (v.inicio_em at time zone v.fuso)::date end,v.estado,v.revisao
   from pcm.ocorrencias_visita_preparadas o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=p_cliente_id
   where o.plano_id=p_plano_id and o.versao_id=p_versao_id
     and (o.vencimento_original between p_inicio and p_fim or (v.estado<>'cancelada' and (v.inicio_em at time zone v.fuso)::date between p_inicio and p_fim))
 )
 select f.tipo,f.id,p_cliente_id,f.plano_id,f.versao_id,f.rotina_id,f.alvo_id,f.vencimento_original,f.data_programada,f.visita_estado,f.visita_revisao,v_fotografia->>'snapshotHash','desconhecida'::text
 from fontes f where p_apos_tipo is null or (f.tipo,f.id)>(p_apos_tipo,p_apos_id)
 order by f.tipo,f.id limit p_limite;
end; $$;
revoke all on function pcm.sso_ocorrencias_cronograma_exportacao(uuid,uuid,uuid,date,date,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_ocorrencias_cronograma_exportacao(uuid,uuid,uuid,date,date,text,uuid,integer) to authenticated;
