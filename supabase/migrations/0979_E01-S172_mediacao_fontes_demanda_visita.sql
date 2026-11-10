-- ADR-0775: mantém fonte interna sem grant e adiciona gate independente.
create table pcm.capacidade_fontes_mediacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.capacidade_fontes_mediacao_gate enable row level security;
alter table pcm.capacidade_fontes_mediacao_gate force row level security;
revoke all on pcm.capacidade_fontes_mediacao_gate from public,anon,authenticated,service_role;
insert into pcm.capacidade_fontes_mediacao_gate(id,habilitado) values(true,false);

create function pcm.sso_mediar_fontes_demanda_visita(p_cliente_id uuid,p_semana_inicio date,p_apos uuid default null,p_limite integer default 50)
returns table(vinculo_id uuid,visita_id uuid,os_id uuid,os_status text,ocorrencia_legada_id uuid,ocorrencia_preparada_id uuid,ciclo_id uuid,
  inicio_em timestamptz,fuso text,estimativa_os_minutos integer,participantes bigint,deslocamento_visita_minutos integer,completude text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.capacidade_fontes_mediacao_gate where id),false) then
    raise exception 'mediacao_fontes_capacidade_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then
    raise exception 'capacidade_nao_encontrada_ou_sem_acesso' using errcode='42501';
  end if;
  return query select * from pcm.sso_listar_fontes_demanda_visita(p_cliente_id,p_semana_inicio,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_mediar_fontes_demanda_visita(uuid,date,uuid,integer) from public,anon,service_role;
grant execute on function pcm.sso_mediar_fontes_demanda_visita(uuid,date,uuid,integer) to authenticated;
