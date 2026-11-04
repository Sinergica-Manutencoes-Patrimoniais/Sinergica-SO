-- ADR-1126: não apresenta cancelamento técnico como Visita operacional.
create or replace function pcm.sso_listar_visitas(p_cliente_id uuid,p_inicio timestamptz,p_fim timestamptz,p_limite integer,p_apos_inicio timestamptz,p_apos_id uuid)
returns table(id uuid,cliente_id uuid,inicio_em timestamptz,fim_em timestamptz,fuso text,natureza text,estado text,revisao integer,responsavel_id uuid)
language plpgsql volatile security definer set search_path='' as $$
begin
 if p_cliente_id is null or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<=p_inicio
  or p_limite is null or p_limite not between 1 and 100 or ((p_apos_inicio is null)<>(p_apos_id is null))
  or (p_apos_inicio is not null and not isfinite(p_apos_inicio)) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 if auth.uid() is null then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 return query select v.id,v.cliente_id,v.inicio_em,v.fim_em,v.fuso,v.natureza,v.estado,v.revisao,v.responsavel_id
  from pcm.visitas v where v.cliente_id=p_cliente_id and v.inicio_em>=p_inicio and v.inicio_em<p_fim
   and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=v.id and s.cliente_id=p_cliente_id)
   and (p_apos_inicio is null or (v.inicio_em,v.id)>(p_apos_inicio,p_apos_id)) order by v.inicio_em,v.id limit p_limite;
end; $$;
