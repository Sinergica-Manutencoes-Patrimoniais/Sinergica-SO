-- ADR-1465: acesso mediado, desligado até validação e liberação coordenada.
create table pcm.sso_publicacao_materiais_mediada_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_publicacao_materiais_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_publicacao_materiais_mediada_gate enable row level security;
alter table pcm.sso_publicacao_materiais_mediada_gate force row level security;
revoke all on pcm.sso_publicacao_materiais_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_portal_publicar_materiais_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,
  p_request_id uuid,p_lista_id uuid,p_expected_revision integer,p_linhas jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_publicacao_materiais_mediada_gate where id and habilitado for share;
 if not found then raise exception 'publicacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
 -- Mesma ordem do núcleo: request antes da lista, inclusive no replay.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-material:'||p_request_id::text,0));
 perform 1 from pcm.listas_materiais l join pcm.ordens_servico o on o.id=l.ordem_servico_id and o.client_id=l.cliente_id
   where l.id=p_lista_id and l.cliente_id=p_cliente_id and o.id=p_os_id and o.deleted_at is null for update of l,o;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_portal_publicar_materiais(p_request_id,p_lista_id,p_expected_revision,p_linhas);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_portal_publicar_materiais_mediada(uuid,uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_publicar_materiais_mediada(uuid,uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
