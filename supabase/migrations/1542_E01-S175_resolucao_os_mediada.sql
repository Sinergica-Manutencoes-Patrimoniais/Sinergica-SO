-- ADR-1396: identificação manual sem aplicar evento externo.
create table pcm.sso_resolucao_os_campo_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_resolucao_os_campo_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_resolucao_os_campo_mediada_gate enable row level security;
alter table pcm.sso_resolucao_os_campo_mediada_gate force row level security;
revoke all on pcm.sso_resolucao_os_campo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_os_campo_mediada(p_cliente_id uuid,p_envelope_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 perform 1 from pcm.sso_resolucao_os_campo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_origem_campo_triagens t where t.envelope_id=p_envelope_id and t.cliente_id=p_cliente_id for share;
 if not found or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_os_para_origem_triagem(p_envelope_id,p_apos,p_limite);
 if config.sso_autorizar_triagem_global() is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_os_campo_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_os_campo_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_os_campo_detalhada_mediada(p_cliente_id uuid,p_envelope_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 perform 1 from pcm.sso_resolucao_os_campo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_origem_campo_triagens t where t.envelope_id=p_envelope_id and t.cliente_id=p_cliente_id for share;
 if not found or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_os_triagem_detalhada(p_envelope_id,p_apos,p_limite);
 if config.sso_autorizar_triagem_global() is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_os_campo_detalhada_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_os_campo_detalhada_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_resolver_os_campo_mediada(p_request_id uuid,p_cliente_id uuid,p_envelope_id uuid,p_expected_revision integer,p_os_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_conferir_triagem_mediada(true);
 perform 1 from pcm.sso_resolucao_os_campo_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_origem_campo_resolucao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_resolver_os_origem_triagem(p_request_id,p_envelope_id,p_expected_revision,p_os_id,p_motivo);
 if v_resultado->>'clienteId' is distinct from p_cliente_id::text or config.sso_autorizar_triagem_global() is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_os_campo_mediada(uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_os_campo_mediada(uuid,uuid,uuid,integer,uuid,text) to authenticated;
