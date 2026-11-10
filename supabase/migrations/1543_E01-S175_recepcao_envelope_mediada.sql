-- ADR-1397: lote pendente, nenhuma incorporação automática.
create table pcm.sso_recepcao_envelope_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_recepcao_envelope_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_recepcao_envelope_mediada_gate enable row level security;
alter table pcm.sso_recepcao_envelope_mediada_gate force row level security;
revoke all on pcm.sso_recepcao_envelope_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_receber_envelope_campo_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_envelope_id uuid,p_request_id uuid,p_linhas jsonb,p_fotos jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_recepcao_envelope_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_recepcao_envelope_campo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_receber_envelope_campo_manual(p_ator_id,p_cliente_id,p_os_id,p_envelope_id,p_request_id,p_linhas,p_fotos);
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_receber_envelope_campo_mediada(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_receber_envelope_campo_mediada(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb) to authenticated;

create function pcm.sso_consultar_recepcao_envelope_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_envelope_id uuid,p_request_id uuid,p_linhas jsonb,p_fotos jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_recepcao_envelope_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_recepcao_envelope_campo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_consultar_recepcao_envelope(p_ator_id,p_cliente_id,p_os_id,p_envelope_id,p_request_id,p_linhas,p_fotos);
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_consultar_recepcao_envelope_mediada(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recepcao_envelope_mediada(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb) to authenticated;
