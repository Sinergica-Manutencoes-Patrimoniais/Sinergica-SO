-- ADR-0854. Preserva ACL da RPC e não altera gates.
create function pcm.sso_guardar_autorizacao_feriado_calendario(p_cliente_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_gate boolean;
begin
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select g.habilitado into v_gate from pcm.sso_decisao_feriado_calendario_gate g where g.id for share nowait;
 if not coalesce(v_gate,false) then raise exception 'decisao_feriado_bloqueada' using errcode='55000'; end if;
 select g.habilitado into v_gate from pcm.feriado_declarado_gate g where g.id for share nowait;
 if not coalesce(v_gate,false) then raise exception 'decisao_feriado_bloqueada' using errcode='55000'; end if;
end $$;
revoke all on function pcm.sso_guardar_autorizacao_feriado_calendario(uuid) from public,anon,authenticated,service_role;

do $$
declare v_def text; v_marcador text:=' v_payload:=jsonb_build_object('; v_pos integer;
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_feriado_calendario(uuid,uuid,uuid,uuid,integer,text)'::regprocedure);
 v_pos:=strpos(v_def,v_marcador);
 if v_pos=0 or strpos(substr(v_def,v_pos+length(v_marcador)),v_marcador)>0 or strpos(v_def,'sso_guardar_autorizacao_feriado_calendario')>0 then
  raise exception 'definicao_decisao_feriado_incompativel' using errcode='55000';
 end if;
 v_def:=overlay(v_def placing E' perform pcm.sso_guardar_autorizacao_feriado_calendario(p_cliente_id);\n v_payload:=jsonb_build_object(' from v_pos for length(v_marcador));
 execute v_def;
end $$;
