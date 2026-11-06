-- ADR-1508: borda autorizada; a guarda 1045 continua bloqueando a aprovação.
create table pcm.sso_aprovacao_revisao_mediada_gate (
 id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_aprovacao_revisao_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_aprovacao_revisao_mediada_gate enable row level security;
alter table pcm.sso_aprovacao_revisao_mediada_gate force row level security;
revoke all on pcm.sso_aprovacao_revisao_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_aprovar_revisao_mediada(
 p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_expected_revision integer,p_plano_id uuid,p_vigencia date
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_aprovacao_revisao_mediada_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;
 if not found then raise exception 'protocolo_indisponivel' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update nowait;
 if not found then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_aprovar_revisao_preparada(p_request_id,p_expected_revision,p_plano_id,p_vigencia);
 if auth.uid() is distinct from p_ator_id or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_revisao_mediada(uuid,uuid,uuid,integer,uuid,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aprovar_revisao_mediada(uuid,uuid,uuid,integer,uuid,date) to authenticated;
