-- ADR-1074: complemento informativo às fontes; sem alterar declarações ou agenda.
create function pcm.sso_fontes_esforco_continuacao(p_cliente_id uuid,p_semana_inicio date,p_apos uuid default null,p_limite integer default 50)
returns table(vinculo_id uuid,visita_id uuid,os_id uuid,os_status text,ocorrencia_legada_id uuid,ocorrencia_preparada_id uuid,ciclo_id uuid,
  inicio_em timestamptz,fuso text,estimativa_os_minutos integer,participantes bigint,deslocamento_visita_minutos integer,completude text,
  esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer,
  proposta_continuacao_id uuid,minutos_continuacao integer)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform 1 from pcm.sso_continuacao_os_parcela_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_desabilitada' using errcode='55000'; end if;
  return query select f.*,v.proposta_id,cp.minutos_restantes from pcm.sso_fontes_esforco_autorizadas(p_cliente_id,p_semana_inicio,p_apos,p_limite) f
    left join pcm.sso_continuacoes_os_parcela v on v.os_nova_id=f.os_id and v.cliente_id=p_cliente_id
    left join pcm.chamado_continuacoes_propostas cp on cp.id=v.proposta_id and cp.chamado_id=v.chamado_id
      and cp.os_anterior_id=v.os_anterior_id and cp.os_continuacao_id=v.os_nova_id and cp.situacao='executada'
    order by f.vinculo_id;
end; $$;
revoke all on function pcm.sso_fontes_esforco_continuacao(uuid,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_fontes_esforco_continuacao(uuid,date,uuid,integer) to authenticated;
