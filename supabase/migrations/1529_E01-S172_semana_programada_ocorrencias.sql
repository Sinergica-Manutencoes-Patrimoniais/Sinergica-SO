-- ADR-1383: consulta paralela sem mudar o contrato das fontes existentes.
create table pcm.sso_ocorrencias_referencia_capacidade_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ocorrencias_referencia_capacidade_gate(id,habilitado) values(true,false);
alter table pcm.sso_ocorrencias_referencia_capacidade_gate enable row level security;
alter table pcm.sso_ocorrencias_referencia_capacidade_gate force row level security;
revoke all on pcm.sso_ocorrencias_referencia_capacidade_gate from public,anon,authenticated,service_role;

create function pcm.sso_ocorrencias_sem_os_referencia(p_cliente_id uuid,p_semana_inicio date,p_apos_tipo text,p_apos_id uuid,p_limite integer)
returns table(tipo text,ocorrencia_id uuid,vencimento_original date,data_referencia date,plano_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,
 esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer,completude text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_ocorrencias_referencia_capacidade_gate where id and habilitado for share;
 if not found then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fila_obrigacoes_preparadas_gate where id and habilitado for share;
 if not found then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 perform 1 from pcm.capacidade_esforco_declarado_gate where id and habilitado for share;
 if not found then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100
   or ((p_apos_tipo is null)<>(p_apos_id is null)) or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query with candidatas as (
   select 'calendario'::text tipo,o.id ocorrencia_id,o.vencimento_original,o.vencimento_original data_referencia,o.plano_id,o.rotina_id,o.alvo_tipo,o.alvo_id
   from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
   where o.vencimento_original>=p_semana_inicio and o.vencimento_original<p_semana_inicio+7
    and not exists(select 1 from pcm.ocorrencias_rotina_vinculos v join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id where v.ocorrencia_preparada_id=o.id)
    and not exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=g.id where g.calendario_preparado_id=o.id)
   union all
   select 'visita'::text,o.id,o.vencimento_original,coalesce(case when v.estado<>'cancelada' then (v.inicio_em at time zone v.fuso)::date end,o.vencimento_original),o.plano_id,o.rotina_id,o.alvo_tipo,o.alvo_id
   from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
   join pcm.visitas v on v.id=o.visita_id and v.cliente_id=p_cliente_id
   where coalesce(case when v.estado<>'cancelada' then (v.inicio_em at time zone v.fuso)::date end,o.vencimento_original)>=p_semana_inicio
    and coalesce(case when v.estado<>'cancelada' then (v.inicio_em at time zone v.fuso)::date end,o.vencimento_original)<p_semana_inicio+7
    and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado sv where sv.visita_id=o.visita_id and sv.cliente_id=p_cliente_id)
    and not exists(select 1 from pcm.sso_vinculos_visita_legado x join pcm.ordens_servico os on os.ocorrencia_preventiva_id=x.ocorrencia_legada_id where x.ocorrencia_visita_id=o.id)
    and not exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.sso_vinculos_os_grupo x on x.ocorrencia_grupo_id=g.id where g.visita_preparada_id=o.id)
 ), pagina as (select c.* from candidatas c where p_apos_tipo is null or (c.tipo,c.ocorrencia_id)>(p_apos_tipo,p_apos_id) order by c.tipo,c.ocorrencia_id limit p_limite)
 select p.tipo,p.ocorrencia_id,p.vencimento_original,p.data_referencia,p.plano_id,p.rotina_id,p.alvo_tipo,p.alvo_id,coalesce(d.revisao,0),d.internos_minutos,d.terceiros_minutos,d.acompanhamento_minutos,'desconhecida'::text
 from pagina p left join lateral (select e.revisao,e.internos_minutos,e.terceiros_minutos,e.acompanhamento_minutos from pcm.capacidade_esforco_declaracoes e
   where e.cliente_id=p_cliente_id and ((p.tipo='calendario' and e.ocorrencia_id=p.ocorrencia_id) or (p.tipo='visita' and e.ocorrencia_visita_id=p.ocorrencia_id))
   order by e.revisao desc limit 1) d on true order by p.tipo,p.ocorrencia_id;
end; $$;
revoke all on function pcm.sso_ocorrencias_sem_os_referencia(uuid,date,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_ocorrencias_sem_os_referencia(uuid,date,text,uuid,integer) to authenticated;
