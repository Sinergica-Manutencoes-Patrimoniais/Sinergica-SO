-- ADR-1471: leituras autenticadas; núcleos e gates originais permanecem privados.
create table pcm.sso_diagnostico_revisao_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_revisao_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_revisao_mediado_gate enable row level security;
alter table pcm.sso_diagnostico_revisao_mediado_gate force row level security;
revoke all on pcm.sso_diagnostico_revisao_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_conferir_diagnostico_revisao(p_ator uuid,p_cliente uuid,p_plano uuid,p_revisao integer,p_fonte text)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_revisao integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null or p_revisao is null or p_revisao<1 or p_fonte is null or p_fonte not in ('preflight','impacto','os') then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_diagnostico_revisao_mediado_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if p_fonte='preflight' then
  perform 1 from pcm.sso_guardar_impacto_aprovacao_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 elsif p_fonte='impacto' then
  perform 1 from pcm.sso_avaliacao_impacto_revisao_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_decisao_impacto_revisao_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 else
  perform 1 from pcm.sso_impacto_revisao_os_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select revisao into v_revisao from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_revisao<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
end; $$;
revoke all on function pcm.sso_conferir_diagnostico_revisao(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_preflight_revisao_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'preflight');
 r:=pcm.sso_preflight_aprovacao_revisao(p_cliente_id,p_plano_id,p_expected_revision,p_vigencia);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_preflight_revisao_mediado(uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_preflight_revisao_mediado(uuid,uuid,uuid,integer,date) to authenticated;

create function pcm.sso_avaliar_impacto_revisao_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita_legado') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_plano,'impacto');
 if p_tipo='calendario' then r:=pcm.sso_avaliar_decisoes_impacto(p_cliente_id,p_plano_id,p_expected_plano);
 else r:=pcm.sso_avaliar_fontes_impacto_visita_legado(p_cliente_id,p_plano_id,p_expected_plano); end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_avaliar_impacto_revisao_mediado(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_avaliar_impacto_revisao_mediado(uuid,uuid,uuid,integer,text) to authenticated;

create function pcm.sso_diagnosticar_os_revisao_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'os');
 r:=pcm.sso_diagnosticar_os_revisao_plano(p_cliente_id,p_plano_id,p_expected_revision);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_diagnosticar_os_revisao_mediado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_os_revisao_mediado(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_os_revisao_mediada(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_apos uuid,p_limite integer)
returns table(os_id uuid,ocorrencia_id uuid,rotina_id uuid,vencimento_original date,status text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'os');
 return query select * from pcm.sso_listar_os_abertas_revisao(p_cliente_id,p_plano_id,p_expected_revision,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_os_revisao_mediada(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_os_revisao_mediada(uuid,uuid,uuid,integer,uuid,integer) to authenticated;

create function pcm.sso_comparar_questionario_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_revisao integer,p_rotina_logica_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_revisao,'os');
 r:=pcm.sso_comparar_questionario_revisao(p_cliente_id,p_plano_id,p_revisao,p_rotina_logica_id);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_comparar_questionario_mediado(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comparar_questionario_mediado(uuid,uuid,uuid,integer,uuid) to authenticated;

create function pcm.sso_diagnosticar_vigencias_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'os');
 r:=pcm.sso_diagnosticar_vigencias_revisao(p_cliente_id,p_plano_id,p_expected_revision);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_diagnosticar_vigencias_mediado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_vigencias_mediado(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_vigencias_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_apos integer,p_limite integer)
returns table(versao_id uuid,numero integer,estado text,vigencia_inicio date,vigencia_fim date,aprovada_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'os');
 return query select * from pcm.sso_listar_vigencias_revisao(p_cliente_id,p_plano_id,p_expected_revision,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_vigencias_mediado(uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_vigencias_mediado(uuid,uuid,uuid,integer,integer,integer) to authenticated;

create function pcm.sso_diagnosticar_fuso_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'os');
 r:=pcm.sso_diagnosticar_fuso_vigencia(p_cliente_id,p_plano_id,p_expected_revision);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_diagnosticar_fuso_mediado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_fuso_mediado(uuid,uuid,uuid,integer) to authenticated;
