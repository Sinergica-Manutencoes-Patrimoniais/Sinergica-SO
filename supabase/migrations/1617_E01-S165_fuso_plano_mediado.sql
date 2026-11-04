-- ADR-1474: declaração de fuso não valida contrato nem altera geração.
create table pcm.sso_fuso_plano_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_fuso_plano_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_fuso_plano_mediado_gate enable row level security;
alter table pcm.sso_fuso_plano_mediado_gate force row level security;
revoke all on pcm.sso_fuso_plano_mediado_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_fuso_plano_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null or p_escrita is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_fuso_plano_mediado_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fuso_plano_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_escrita then perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update;
 else perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share; end if;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_fuso_plano_mediado(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;
create function pcm.sso_declarar_fuso_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_fuso text,p_contrato_referencia_id uuid,p_fonte text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_fuso_plano_mediado(p_ator_id,p_cliente_id,p_plano_id,true);
 r:=pcm.sso_declarar_fuso_plano(p_request_id,p_cliente_id,p_plano_id,p_expected_revision,p_fuso,p_contrato_referencia_id,p_fonte,p_motivo);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_declarar_fuso_mediado(uuid,uuid,uuid,uuid,integer,text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_fuso_mediado(uuid,uuid,uuid,uuid,integer,text,uuid,text,text) to authenticated;
create function pcm.sso_listar_fusos_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_busca text,p_apos text,p_limite integer)
returns table(fuso text) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_fuso_plano_mediado(p_ator_id,p_cliente_id,p_plano_id,false);
 return query select * from pcm.sso_listar_fusos_iana_plano(p_cliente_id,p_plano_id,p_busca,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_fusos_mediado(uuid,uuid,uuid,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fusos_mediado(uuid,uuid,uuid,text,text,integer) to authenticated;
create function pcm.sso_historico_fuso_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,revisao integer,fuso text,contrato_referencia_id uuid,fonte text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_fuso_plano_mediado(p_ator_id,p_cliente_id,p_plano_id,false);
 return query select * from pcm.sso_historico_fuso_plano(p_cliente_id,p_plano_id,p_antes,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_historico_fuso_mediado(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_fuso_mediado(uuid,uuid,uuid,integer,integer) to authenticated;
