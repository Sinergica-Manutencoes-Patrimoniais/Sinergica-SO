-- ADR-0841. Não abre gates nem altera o núcleo ou a ACL da RPC mediada.
create function pcm.sso_guardar_alteracao_feriado_geracao() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-geracao-visita-feriados-v1',0));
  return null;
end $$;
revoke all on function pcm.sso_guardar_alteracao_feriado_geracao() from public,anon,authenticated,service_role;
create trigger sso_feriado_geracao_serializar
  before insert or update or delete or truncate on pcm.feriados_declarados
  for each statement execute function pcm.sso_guardar_alteracao_feriado_geracao();

create or replace function pcm.sso_pcm_gerar_visita(p_request_id uuid,p_cliente_id uuid,p_serie_id uuid,p_regra_id uuid,p_semana date,p_visita_id uuid,p_inicio_em timestamptz,p_responsavel_id uuid,p_cobertura text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_gate boolean;
begin
 if not coalesce((select habilitado from pcm.sso_acesso_geracao_visita_gate where id),false) then raise exception 'acesso_geracao_visita_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select g.habilitado into v_gate from pcm.sso_acesso_geracao_visita_gate g where g.id for share nowait;
 if not coalesce(v_gate,false) then raise exception 'acesso_geracao_visita_bloqueado' using errcode='55000'; end if;
 select g.habilitado into v_gate from pcm.sso_gerar_visita_contratual_gate g where g.id for share nowait;
 if not coalesce(v_gate,false) then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
 select g.habilitado into v_gate from pcm.feriado_declarado_gate g where g.id for share nowait;
 if not coalesce(v_gate,false) then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
 select g.habilitado into v_gate from pcm.sso_origem_contratual_unica_gate g where g.id for share nowait;
 if not coalesce(v_gate,false) then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-geracao-visita-feriados-v1',0)) then raise exception 'feriado_em_alteracao' using errcode='55P03'; end if;
 return pcm.sso_gerar_visita_contratual(p_request_id,p_cliente_id,p_serie_id,p_regra_id,p_semana,p_visita_id,p_inicio_em,p_responsavel_id,p_cobertura);
end $$;
