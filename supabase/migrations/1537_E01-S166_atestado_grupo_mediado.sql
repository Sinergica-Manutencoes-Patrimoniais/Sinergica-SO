-- ADR-1391: declaração mediada sem comprovar execução ou acionar Auvo.
create table pcm.sso_atestado_grupo_mediado_gate(id boolean primary key default true check(id),escrita boolean not null default false);
insert into pcm.sso_atestado_grupo_mediado_gate(id,escrita) values(true,false);
alter table pcm.sso_atestado_grupo_mediado_gate enable row level security;
alter table pcm.sso_atestado_grupo_mediado_gate force row level security;
revoke all on pcm.sso_atestado_grupo_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_declarar_atestado_grupo_mediado(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_expected_revision integer,p_declaracao text,p_referencia_evidencia text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_atestado_grupo_mediado_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_atestado_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_declarar_atestado_grupo(p_request_id,p_cliente_id,p_ocorrencia_id,p_expected_revision,p_declaracao,p_referencia_evidencia);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_atestado_grupo_mediado(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_atestado_grupo_mediado(uuid,uuid,uuid,integer,text,text) to authenticated;
