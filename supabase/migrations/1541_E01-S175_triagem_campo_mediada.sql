-- ADR-1395: fronteira de triagem; não processa evento de campo.
create table pcm.sso_triagem_campo_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_triagem_campo_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_triagem_campo_mediada_gate enable row level security;
alter table pcm.sso_triagem_campo_mediada_gate force row level security;
revoke all on pcm.sso_triagem_campo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_conferir_triagem_mediada(p_escrita boolean) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_triagem_campo_mediada_gate where id and case when p_escrita then escrita else leitura end for share;
 if not found then raise exception 'triagem_mediada_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_triagem_mediada(boolean) from public,anon,authenticated,service_role;

create function pcm.sso_permissao_triagem_mediada() returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_triagem_campo_mediada_gate where id and leitura for share;
 if not found or auth.uid() is null then return false; end if;
 return config.sso_autorizar_triagem_global() is true;
end; $$;
revoke all on function pcm.sso_permissao_triagem_mediada() from public,anon,authenticated,service_role;
grant execute on function pcm.sso_permissao_triagem_mediada() to authenticated;

create function pcm.sso_listar_envelopes_triagem_mediada(p_apos uuid,p_limite integer)
returns table(id uuid,integracao text,task_id text,cliente_externo_id text,recebido_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 return query select t.id,t.integracao,t.task_id::text,t.cliente_externo_id,t.recebido_em from pcm.sso_listar_triagem_origem_campo(p_apos,p_limite) t;
 if config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_envelopes_triagem_mediada(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_envelopes_triagem_mediada(uuid,integer) to authenticated;

create function pcm.sso_listar_clientes_triagem_mediada(p_apos uuid,p_limite integer)
returns table(id uuid,nome text) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 return query select * from pcm.sso_listar_clientes_triagem(p_apos,p_limite);
 if config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_clientes_triagem_mediada(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_clientes_triagem_mediada(uuid,integer) to authenticated;

create function pcm.sso_listar_triagens_campo_mediada(p_apos uuid,p_limite integer)
returns table(envelope_id uuid,cliente_id uuid,revisao integer,motivo text,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 return query select * from pcm.sso_listar_triagens_campo(p_apos,p_limite);
 if config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_triagens_campo_mediada(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_triagens_campo_mediada(uuid,integer) to authenticated;

create function pcm.sso_indicar_cliente_campo_mediada(p_request_id uuid,p_envelope_id uuid,p_cliente_id uuid,p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_conferir_triagem_mediada(true);
 perform 1 from pcm.sso_origem_campo_triagem_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 v_resultado:=pcm.sso_indicar_cliente_origem_campo(p_request_id,p_envelope_id,p_cliente_id,p_motivo);
 if config.sso_autorizar_triagem_global() is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_indicar_cliente_campo_mediada(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_indicar_cliente_campo_mediada(uuid,uuid,uuid,text) to authenticated;

create function pcm.sso_retificar_cliente_campo_mediada(p_request_id uuid,p_envelope_id uuid,p_expected_revision integer,p_cliente_id uuid,p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;v_anterior uuid;
begin
 perform pcm.sso_conferir_triagem_mediada(true);
 perform 1 from pcm.sso_origem_campo_triagem_revisao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 v_resultado:=pcm.sso_retificar_cliente_origem_campo(p_request_id,p_envelope_id,p_expected_revision,p_cliente_id,p_motivo);
 select h.cliente_anterior into v_anterior from pcm.sso_origem_campo_triagem_historico h where h.request_id=p_request_id and h.ator_id=auth.uid();
 if not found or v_anterior is null or config.sso_autorizar_triagem_global() is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',v_anterior) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_retificar_cliente_campo_mediada(uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_retificar_cliente_campo_mediada(uuid,uuid,integer,uuid,text) to authenticated;

create function pcm.sso_consultar_tentativa_triagem_mediada(p_request_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 v_resultado:=pcm.sso_consultar_tentativa_triagem(p_request_id);
 if config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_consultar_tentativa_triagem_mediada(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_tentativa_triagem_mediada(uuid) to authenticated;

create function pcm.sso_consultar_resolucao_campo_mediada(p_request_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 v_resultado:=pcm.sso_consultar_resolucao_origem(p_request_id);
 if config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_consultar_resolucao_campo_mediada(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_resolucao_campo_mediada(uuid) to authenticated;
