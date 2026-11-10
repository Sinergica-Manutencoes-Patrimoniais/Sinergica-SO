-- ADR-1500: mediação da relação e materialização legadas.
create table pcm.sso_ponte_legada_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ponte_legada_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_ponte_legada_mediada_gate enable row level security;alter table pcm.sso_ponte_legada_mediada_gate force row level security;
revoke all on pcm.sso_ponte_legada_mediada_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_ponte_legada_mediada(p_ator uuid,p_cliente uuid,p_escrita boolean) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_escrita is null then raise exception 'sem_acesso' using errcode='42501';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 perform 1 from pcm.sso_ponte_legada_mediada_gate where id and habilitado for share;if not found then raise exception 'operacao_desabilitada' using errcode='55000';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_escrita then perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;if not found then raise exception 'protocolo_indisponivel' using errcode='55000';end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03';end if;end if;
end; $$;
revoke all on function pcm.sso_conferir_ponte_legada_mediada(uuid,uuid,boolean) from public,anon,authenticated,service_role;
-- A função original retorna uma coluna id; qualificar o gate evita ambiguidade PL/pgSQL em execução.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_listar_planos_legados_relacao(uuid,uuid,uuid,integer)'::regprocedure);
 a text:='select habilitado from pcm.sso_relacao_plano_legado_gate where id';
 b text:='select g.habilitado from pcm.sso_relacao_plano_legado_gate g where g.id';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_lista_legada_incompativel' using errcode='55000';end if;
 d:=replace(d,a,b);
 a:='select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id';
 b:='select 1 from pcm.planos_manutencao pl where pl.id=p_plano_id and pl.cliente_id=p_cliente_id';
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_plano_legado_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
create function pcm.sso_planos_legados_mediados(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_apos uuid,p_limite integer) returns table(id uuid,nome text,estado text,sistema_id uuid,equipamento_id uuid,primeira_data date,intervalo_n integer,intervalo_unidade text) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,false);return query select * from pcm.sso_listar_planos_legados_relacao(p_cliente_id,p_plano_id,p_apos,p_limite);if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;end; $$;
create function pcm.sso_historico_relacao_legada_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_legado_id uuid,p_antes integer,p_limite integer) returns table(request_id uuid,revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,false);return query select * from pcm.sso_historico_relacao_plano_legado(p_cliente_id,p_plano_id,p_legado_id,p_antes,p_limite);if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;end; $$;
create function pcm.sso_ciclos_legados_mediados(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_legado_id uuid,p_relacao_request_id uuid,p_apos uuid,p_limite integer) returns table(preparada_id uuid,versao_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento_original date,legadas_mesma_data integer) language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,false);return query select * from pcm.sso_listar_ciclos_integracao_legado(p_cliente_id,p_plano_id,p_legado_id,p_relacao_request_id,p_apos,p_limite);if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;end; $$;
create function pcm.sso_declarar_relacao_legada_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_plano_legado_id uuid,p_expected_revision integer,p_decisao text,p_motivo text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;begin perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,true);r:=pcm.sso_declarar_relacao_plano_legado(p_request_id,p_cliente_id,p_plano_id,p_plano_legado_id,p_expected_revision,p_decisao,p_motivo);if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;return r;end; $$;
create function pcm.sso_materializar_legado_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_plano_legado_id uuid,p_relacao_request_id uuid,p_ciclo_id uuid,p_motivo text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;begin perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,true);r:=pcm.sso_materializar_ciclo_legado(p_request_id,p_cliente_id,p_preparada_id,p_plano_legado_id,p_relacao_request_id,p_ciclo_id,p_motivo);if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;return r;end; $$;
create function pcm.sso_lote_legado_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_plano_legado_id uuid,p_relacao_request_id uuid,p_expected_revision integer,p_preparadas uuid[],p_motivo text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;begin perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,true);r:=pcm.sso_materializar_lote_legado(p_request_id,p_cliente_id,p_plano_id,p_plano_legado_id,p_relacao_request_id,p_expected_revision,p_preparadas,p_motivo);if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;return r;end; $$;
revoke all on function pcm.sso_planos_legados_mediados(uuid,uuid,uuid,uuid,integer),pcm.sso_historico_relacao_legada_mediado(uuid,uuid,uuid,uuid,integer,integer),pcm.sso_ciclos_legados_mediados(uuid,uuid,uuid,uuid,uuid,uuid,integer),pcm.sso_declarar_relacao_legada_mediada(uuid,uuid,uuid,uuid,uuid,integer,text,text),pcm.sso_materializar_legado_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text),pcm.sso_lote_legado_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid[],text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_planos_legados_mediados(uuid,uuid,uuid,uuid,integer),pcm.sso_historico_relacao_legada_mediado(uuid,uuid,uuid,uuid,integer,integer),pcm.sso_ciclos_legados_mediados(uuid,uuid,uuid,uuid,uuid,uuid,integer),pcm.sso_declarar_relacao_legada_mediada(uuid,uuid,uuid,uuid,uuid,integer,text,text),pcm.sso_materializar_legado_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text),pcm.sso_lote_legado_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid[],text) to authenticated;
