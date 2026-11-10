-- ADR-1475: decisões por ciclo S166 na revisão S165; sem efeitos operacionais.
create table pcm.sso_decisao_impacto_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_decisao_impacto_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_decisao_impacto_mediada_gate enable row level security;
alter table pcm.sso_decisao_impacto_mediada_gate force row level security;
revoke all on pcm.sso_decisao_impacto_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_conferir_decisao_impacto_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_visita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null or p_visita is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_decisao_impacto_mediada_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_decisao_impacto_revisao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if p_visita then
  perform 1 from pcm.sso_identidade_ciclo_visita_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or (p_visita and config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true)
   or not exists(select 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_decisao_impacto_mediada(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_listar_decisoes_calendario_mediada(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_apos uuid,p_limite integer)
returns table(preparada_id uuid,rascunho_id uuid,rotina_id uuid,ciclo integer,vencimento_original date,revisao_decisao integer,ultima_decisao text,ultima_revisao_plano integer,ultimo_motivo text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,false);
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 return query select * from pcm.sso_listar_decisoes_impacto_ocorrencia(p_cliente_id,p_plano_id,p_expected_plano,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_decisoes_calendario_mediada(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_decisoes_calendario_mediada(uuid,uuid,uuid,integer,uuid,integer) to authenticated;

create function pcm.sso_listar_decisoes_visita_mediada(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_apos uuid,p_limite integer)
returns table(preparada_id uuid,rascunho_id uuid,rotina_id uuid,semana_origem date,visita_id uuid,ciclo_canonico_id uuid,revisao_decisao integer,ultima_decisao text,ultima_revisao_plano integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,true);
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 return query select * from pcm.sso_listar_impactos_visita(p_cliente_id,p_plano_id,p_expected_plano,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_decisoes_visita_mediada(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_decisoes_visita_mediada(uuid,uuid,uuid,integer,uuid,integer) to authenticated;

create function pcm.sso_decidir_impacto_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_decisao text,p_motivo text,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb; v_visita boolean;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_visita:=p_tipo='visita';
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,v_visita);
 if v_visita then
  r:=pcm.sso_decidir_impacto_visita(p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo);
 else
  r:=pcm.sso_decidir_impacto_ocorrencia(p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo);
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or (v_visita and config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) to authenticated;
