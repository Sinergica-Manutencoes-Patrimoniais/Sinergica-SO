-- ADR-0860: mediação desligada; funções de negócio permanecem privadas.
create table pcm.sso_mediacao_cronograma_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_mediacao_cronograma_gate(id,habilitado) values(true,false);
alter table pcm.sso_mediacao_cronograma_gate enable row level security;
alter table pcm.sso_mediacao_cronograma_gate force row level security;
revoke all on pcm.sso_mediacao_cronograma_gate from public,anon,authenticated,service_role;

create function pcm.sso_exigir_mediacao_cronograma(p_cliente uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_ativo boolean;
begin
 select habilitado into v_ativo from pcm.sso_mediacao_cronograma_gate where id for share;
 if v_ativo is distinct from true then raise exception 'mediacao_cronograma_bloqueada' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if auth.uid() is null or p_cliente is null or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_mediacao_cronograma(uuid) from public,anon,authenticated,service_role;

do $migration$
declare v_def text; v_antigo text:='select habilitado from pcm.sso_cronograma_staging_gate where id';
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_listar_cronogramas_unificados(uuid,uuid,integer)'::regprocedure) into v_def;
 if (length(v_def)-length(replace(v_def,v_antigo,'')))/length(v_antigo)<>1 then raise exception 'definicao_listagem_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,'select g.habilitado from pcm.sso_cronograma_staging_gate g where g.id');
end; $migration$;
revoke all on function pcm.sso_listar_cronogramas_unificados(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_receber_cronograma_mediado(p_request uuid,p_lote uuid,p_cliente uuid,p_fonte text,p_matriz jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente); return pcm.sso_receber_cronograma_unificado(p_request,p_lote,p_cliente,p_fonte,p_matriz); end; $$;
create function pcm.sso_listar_cronogramas_mediado(p_cliente uuid,p_apos uuid,p_limite integer)
returns table(id uuid,fonte_id text,revisao integer,criado_em timestamptz) language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente); return query select * from pcm.sso_listar_cronogramas_unificados(p_cliente,p_apos,p_limite); end; $$;
create function pcm.sso_obter_cronograma_mediado(p_cliente uuid,p_lote uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_mediacao_cronograma(p_cliente); return pcm.sso_obter_cronograma_unificado(p_cliente,p_lote); end; $$;
create function pcm.sso_anotar_cronograma_mediado(p_request uuid,p_lote uuid,p_revision integer,p_linha integer,p_observacao text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote;
 perform pcm.sso_exigir_mediacao_cronograma(v_cliente);
 return pcm.sso_anotar_cronograma_unificado(p_request,p_lote,p_revision,p_linha,p_observacao);
end; $$;
revoke all on function pcm.sso_receber_cronograma_mediado(uuid,uuid,uuid,text,jsonb),pcm.sso_listar_cronogramas_mediado(uuid,uuid,integer),pcm.sso_obter_cronograma_mediado(uuid,uuid),pcm.sso_anotar_cronograma_mediado(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_receber_cronograma_mediado(uuid,uuid,uuid,text,jsonb),pcm.sso_listar_cronogramas_mediado(uuid,uuid,integer),pcm.sso_obter_cronograma_mediado(uuid,uuid),pcm.sso_anotar_cronograma_mediado(uuid,uuid,integer,integer,text) to authenticated;
