-- ADR-1127: excluir Visitas suprimidas antes da paginação, preservando histórico.
create or replace function pcm.sso_listar_obrigacoes_preparadas(p_cliente_id uuid,p_plano_id uuid,p_apos_tipo text,p_apos_id uuid,p_limite integer)
returns table(tipo text,preparada_id uuid,versao_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento_original date,ocorrencia_grupo_id uuid,estado text,fila_executavel boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_fila_obrigacoes_preparadas_gate where id),false) then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or ((p_apos_tipo is null) <> (p_apos_id is null)) or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query with candidatas as (
   select 'calendario'::text tipo,o.id preparada_id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,o.vencimento_original,g.id grupo_id
   from pcm.ocorrencias_rotina_preparadas o left join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=o.id and g.cliente_id=p_cliente_id and g.plano_id=p_plano_id
   where o.plano_id=p_plano_id
   union all
   select 'visita'::text,o.id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,o.vencimento_original,g.id
   from pcm.ocorrencias_visita_preparadas o left join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=o.id and g.cliente_id=p_cliente_id and g.plano_id=p_plano_id
   where o.plano_id=p_plano_id
   and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado sv where sv.visita_id=o.visita_id and sv.cliente_id=p_cliente_id)
 )
 select c.tipo,c.preparada_id,c.versao_id,c.rotina_id,c.alvo_tipo,c.alvo_id,c.vencimento_original,c.grupo_id,
   case when c.grupo_id is not null then 'grupo_registrado_nao_executavel' when c.alvo_tipo='grupo' then 'grupo_preparado_sem_registro' else 'preparada_sem_estado_execucao' end,false
 from candidatas c where p_apos_tipo is null or (c.tipo,c.preparada_id)>(p_apos_tipo,p_apos_id)
 order by c.tipo,c.preparada_id limit p_limite;
end; $$;

create or replace function pcm.sso_mediar_ocorrencias_sem_os(p_cliente_id uuid,p_semana_inicio date,p_apos_tipo text default null,p_apos_id uuid default null,p_limite integer default 50)
returns table(tipo text,ocorrencia_id uuid,vencimento_original date,plano_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer,completude text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_fila_obrigacoes_preparadas_gate where id),false) or not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then raise exception 'ocorrencias_capacidade_bloqueadas' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100 or ((p_apos_tipo is null)<>(p_apos_id is null)) or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query with candidatas as (
  select 'calendario'::text tipo,o.id ocorrencia_id,o.vencimento_original,o.plano_id,o.rotina_id,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
  where o.vencimento_original>=p_semana_inicio and o.vencimento_original<p_semana_inicio+7
   and not exists(select 1 from pcm.ocorrencias_rotina_vinculos v join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id where v.ocorrencia_preparada_id=o.id)
   and not exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=g.id where g.calendario_preparado_id=o.id)
  union all
  select 'visita'::text,o.id,o.vencimento_original,o.plano_id,o.rotina_id,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
  where o.vencimento_original>=p_semana_inicio and o.vencimento_original<p_semana_inicio+7
   and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado sv where sv.visita_id=o.visita_id and sv.cliente_id=p_cliente_id)
   and not exists(select 1 from pcm.sso_vinculos_visita_legado v join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id where v.ocorrencia_visita_id=o.id)
   and not exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=g.id where g.visita_preparada_id=o.id)
 ), pagina as (select c.* from candidatas c where p_apos_tipo is null or (c.tipo,c.ocorrencia_id)>(p_apos_tipo,p_apos_id) order by c.tipo,c.ocorrencia_id limit p_limite)
 select p.tipo,p.ocorrencia_id,p.vencimento_original,p.plano_id,p.rotina_id,p.alvo_tipo,p.alvo_id,coalesce(d.revisao,0),d.internos_minutos,d.terceiros_minutos,d.acompanhamento_minutos,'desconhecida'::text
 from pagina p left join lateral (select e.revisao,e.internos_minutos,e.terceiros_minutos,e.acompanhamento_minutos from pcm.capacidade_esforco_declaracoes e where e.cliente_id=p_cliente_id and ((p.tipo='calendario' and e.ocorrencia_id=p.ocorrencia_id) or (p.tipo='visita' and e.ocorrencia_visita_id=p.ocorrencia_id)) order by e.revisao desc limit 1) d on true order by p.tipo,p.ocorrencia_id;
end; $$;

create or replace function pcm.sso_ocorrencias_cronograma_exportacao(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_inicio date,p_fim date,p_apos_tipo text,p_apos_id uuid,p_limite integer)
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
     and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado sv where sv.visita_id=o.visita_id and sv.cliente_id=p_cliente_id)
     and (o.vencimento_original between p_inicio and p_fim or (v.estado<>'cancelada' and (v.inicio_em at time zone v.fuso)::date between p_inicio and p_fim))
 )
 select f.tipo,f.id,p_cliente_id,f.plano_id,f.versao_id,f.rotina_id,f.alvo_id,f.vencimento_original,f.data_programada,f.visita_estado,f.visita_revisao,v_fotografia->>'snapshotHash','desconhecida'::text
 from fontes f where p_apos_tipo is null or (f.tipo,f.id)>(p_apos_tipo,p_apos_id)
 order by f.tipo,f.id limit p_limite;
end; $$;

