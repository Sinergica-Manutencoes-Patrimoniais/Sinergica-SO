-- ADR-1138: mediação por identidade e revisão, sem alteração cadastral.
create table pcm.sso_conferencia_codigos_revisao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_codigos_revisao_gate(id,habilitado) values(true,false);
alter table pcm.sso_conferencia_codigos_revisao_gate enable row level security;
alter table pcm.sso_conferencia_codigos_revisao_gate force row level security;
revoke all on pcm.sso_conferencia_codigos_revisao_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferencia_codigos_revisada(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid,p_revision integer,p_apos text,p_limite integer)
returns table(chave text,tipo text,codigo_informado text,codigo_candidato text,formato_invalido boolean,codigos_divergentes boolean,
 outras_linhas bigint,cadastros_cliente bigint,aliases_cliente bigint,revisao integer)
language plpgsql volatile security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lote_id is null or p_revision is null or p_revision<1
  or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos)>200) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_conferencia_codigos_revisao_gate where id and habilitado for share;
 if not found then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id for share;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_lote.revisao is distinct from p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return query select c.chave,c.tipo,c.codigo_informado,c.codigo_candidato,c.formato_invalido,c.codigos_divergentes,
  c.outras_linhas,c.cadastros_cliente,c.aliases_cliente,v_lote.revisao from pcm.sso_conferir_codigos_lote(p_lote_id,p_apos,p_limite) c;
end; $$;
revoke all on function pcm.sso_conferencia_codigos_revisada(uuid,uuid,uuid,integer,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferencia_codigos_revisada(uuid,uuid,uuid,integer,text,integer) to authenticated;
