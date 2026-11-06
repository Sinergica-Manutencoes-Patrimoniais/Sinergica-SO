-- ADR-0653: fonte parcial separada; não soma com estimativa da OS.
create table pcm.sso_demanda_grupo_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_demanda_grupo_visita_gate enable row level security;
alter table pcm.sso_demanda_grupo_visita_gate force row level security;
revoke all on pcm.sso_demanda_grupo_visita_gate from public,anon,authenticated,service_role;
insert into pcm.sso_demanda_grupo_visita_gate(id,habilitado) values(true,false);
create function pcm.sso_listar_demanda_grupo_visita(p_cliente_id uuid,p_semana_inicio date,p_apos uuid,p_limite integer)
returns table(ocorrencia_id uuid,visita_id uuid,os_id uuid,inicio_em timestamptz,fuso text,esforco_minutos text,estimativa_os_minutos integer,estado text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_demanda_grupo_visita_gate where id),false) then raise exception 'demanda_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select g.id,v.id,os.id,v.inicio_em,v.fuso,case when e.dados->>'estado'='estimativa' then e.dados->>'esforcoMinutos' else null end,vo.estimativa_minutos,
 case when e.dados->>'estado'<>'estimativa' then 'tempo_a_validar' when vo.estimativa_minutos is not null then 'sobreposicao_com_os_nao_somavel' else 'fonte_parcial_nao_consolidada' end
 from pcm.sso_ocorrencias_grupo g
 join pcm.ocorrencias_visita_preparadas prep on prep.id=g.visita_preparada_id and prep.plano_id=g.plano_id and prep.versao_id=g.versao_id and prep.rotina_id=g.rotina_id and prep.alvo_tipo='grupo' and prep.alvo_id=g.grupo_id
 join pcm.visitas v on v.id=prep.visita_id and v.cliente_id=g.cliente_id and v.estado not in ('cancelada','concluida')
 join pcm.sso_vinculos_os_grupo vinc on vinc.ocorrencia_grupo_id=g.id and vinc.cliente_id=g.cliente_id
 join pcm.ordens_servico os on os.id=vinc.os_id and os.client_id=g.cliente_id and os.deleted_at is null
 join pcm.visita_ordens_servico vo on vo.visita_id=v.id and vo.os_id=os.id and vo.cliente_id=g.cliente_id and vo.encerrado_em is null
 cross join lateral (select pcm.sso_prever_esforco_grupo(p_cliente_id,g.id) dados) e
 where g.cliente_id=p_cliente_id and (v.inicio_em at time zone v.fuso)::date>=p_semana_inicio and (v.inicio_em at time zone v.fuso)::date<p_semana_inicio+7 and (p_apos is null or g.id>p_apos)
 order by g.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_demanda_grupo_visita(uuid,date,uuid,integer) from public,anon,authenticated,service_role;
