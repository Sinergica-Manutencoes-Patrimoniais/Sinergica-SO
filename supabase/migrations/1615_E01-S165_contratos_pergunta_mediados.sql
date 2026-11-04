-- ADR-1472: não expõe núcleos nem altera questionário externo.
create table pcm.sso_contrato_pergunta_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_contrato_pergunta_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_contrato_pergunta_mediado_gate enable row level security;
alter table pcm.sso_contrato_pergunta_mediado_gate force row level security;
revoke all on pcm.sso_contrato_pergunta_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_conferir_contrato_pergunta_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_tipo text,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null or p_tipo is null or p_tipo not in ('pergunta','evidencia') or p_escrita is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_contrato_pergunta_mediado_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 if p_tipo='pergunta' then
  perform 1 from pcm.sso_contrato_pergunta_gate where id and habilitado for share;
 else
  perform 1 from pcm.sso_contrato_evidencia_gate where id and habilitado for share;
 end if;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_escrita then perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update;
 else perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share; end if;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_contrato_pergunta_mediado(uuid,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_configurar_pergunta_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_obrigatoria boolean,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_contrato_pergunta_mediado(p_ator_id,p_cliente_id,p_plano_id,'pergunta',true);
 r:=pcm.sso_configurar_obrigatoriedade_pergunta(p_request_id,p_cliente_id,p_plano_id,p_expected_revision,p_versao_id,p_rotina_id,p_pergunta_id,p_obrigatoria,p_justificativa);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_configurar_pergunta_mediada(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_configurar_pergunta_mediada(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text) to authenticated;

create function pcm.sso_configurar_evidencia_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_exigida boolean,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_contrato_pergunta_mediado(p_ator_id,p_cliente_id,p_plano_id,'evidencia',true);
 r:=pcm.sso_configurar_evidencia_pergunta(p_request_id,p_cliente_id,p_plano_id,p_expected_revision,p_versao_id,p_rotina_id,p_pergunta_id,p_exigida,p_justificativa);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_configurar_evidencia_mediada(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_configurar_evidencia_mediada(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text) to authenticated;

create function pcm.sso_listar_perguntas_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,obrigatoria boolean,contrato_atual boolean,revisao_plano integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_contrato_pergunta_mediado(p_ator_id,p_cliente_id,p_plano_id,'pergunta',false);
 return query select * from pcm.sso_listar_contratos_pergunta_rascunho(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_perguntas_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_perguntas_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_listar_evidencias_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,exigida boolean,contrato_atual boolean,revisao_plano integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_contrato_pergunta_mediado(p_ator_id,p_cliente_id,p_plano_id,'evidencia',false);
 return query select * from pcm.sso_listar_contratos_evidencia_rascunho(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_evidencias_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_evidencias_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_historico_pergunta_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_antes integer,p_limite integer)
returns table(id uuid,revisao_plano integer,questionario_id uuid,obrigatoria boolean,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_contrato_pergunta_mediado(p_ator_id,p_cliente_id,p_plano_id,'pergunta',false);
 return query select * from pcm.sso_historico_contrato_pergunta(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_pergunta_id,p_antes,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_historico_pergunta_mediado(uuid,uuid,uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_pergunta_mediado(uuid,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;

create function pcm.sso_historico_evidencia_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_antes integer,p_limite integer)
returns table(id uuid,revisao_plano integer,exigida boolean,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_contrato_pergunta_mediado(p_ator_id,p_cliente_id,p_plano_id,'evidencia',false);
 return query select * from pcm.sso_historico_contrato_evidencia(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_pergunta_id,p_antes,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_historico_evidencia_mediado(uuid,uuid,uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_evidencia_mediado(uuid,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;
