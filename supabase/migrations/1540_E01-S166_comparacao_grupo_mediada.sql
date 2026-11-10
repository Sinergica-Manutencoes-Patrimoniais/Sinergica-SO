-- ADR-1394: comparação autorizada sem recalcular histórico.
create table pcm.sso_comparacao_grupo_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_comparacao_grupo_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_comparacao_grupo_mediada_gate enable row level security;
alter table pcm.sso_comparacao_grupo_mediada_gate force row level security;
revoke all on pcm.sso_comparacao_grupo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_comparar_quantidade_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_comparacao_grupo_mediada_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_comparar_quantidade_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_comparar_quantidade_grupo(p_cliente_id,p_ocorrencia_id);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_comparar_quantidade_grupo_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comparar_quantidade_grupo_mediada(uuid,uuid) to authenticated;
