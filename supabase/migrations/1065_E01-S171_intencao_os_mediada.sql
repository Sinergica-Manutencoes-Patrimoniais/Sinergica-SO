-- ADR-0880: intenção interna, sem modificar OS ou tarefa remota; gate permanece fechado.
create function pcm.sso_exigir_intencao_os_mediada() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.reprogramacao_os_enviada_gate g where g.id),false) then
    raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.reprogramacao_os_enviada_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.reprogramacao_os_enviada_gate g where g.id),false) then
    raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000';
  end if;
end;
$$;
revoke all on function pcm.sso_exigir_intencao_os_mediada() from public,anon,authenticated,service_role;

-- A função privada original usava id sem qualificação, ambíguo com o campo de retorno.
create or replace function pcm.sso_listar_intencoes_os_enviada(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,estado text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.reprogramacao_os_enviada_gate g where g.id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,i.os_id,i.visita_origem_id,i.visita_destino_id,i.tarefa_auvo_id::text,i.estado,i.criado_em
    from pcm.reprogramacao_os_intencoes i join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
    where i.cliente_id=p_cliente_id and (p_apos is null or i.id>p_apos) order by i.id limit p_limite;
end;
$$;

create function pcm.sso_propor_intencao_os_mediada(p_request_id uuid,p_intencao_id uuid,p_origem_id uuid,p_destino_id uuid,
  p_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  return pcm.sso_propor_reprogramacao_os_enviada(p_request_id,p_intencao_id,p_origem_id,p_destino_id,p_vinculo_id,p_revisao_origem,p_revisao_destino,p_motivo);
end;
$$;
revoke all on function pcm.sso_propor_intencao_os_mediada(uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_propor_intencao_os_mediada(uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;

create function pcm.sso_listar_intencoes_os_mediada(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,estado text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  return query select * from pcm.sso_listar_intencoes_os_enviada(p_cliente_id,p_apos,p_limite);
end;
$$;
revoke all on function pcm.sso_listar_intencoes_os_mediada(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_intencoes_os_mediada(uuid,uuid,integer) to authenticated;
