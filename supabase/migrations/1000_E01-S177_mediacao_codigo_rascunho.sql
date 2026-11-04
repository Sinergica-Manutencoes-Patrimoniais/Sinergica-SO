-- ADR-0803: preparação inerte; não habilitar sem provas transversais.
create table pcm.sso_mediacao_codigo_rascunho_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_mediacao_codigo_rascunho_gate(id,habilitado) values(true,false);
alter table pcm.sso_mediacao_codigo_rascunho_gate enable row level security;
alter table pcm.sso_mediacao_codigo_rascunho_gate force row level security;
revoke all on pcm.sso_mediacao_codigo_rascunho_gate from public,anon,authenticated,service_role;

create function pcm.sso_mediar_consulta_codigo_rascunho(p_cliente_id uuid,p_tipo text,p_ativo_id uuid)
returns table(revisao integer,codigo text,aprovado_em timestamptz,sincronizado_em timestamptz,etiquetado_em timestamptz,referenciado_os_em timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.sso_mediacao_codigo_rascunho_gate g where g.id),false) then raise exception 'mediacao_codigo_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_tipo not in ('sistema','componente') or p_ativo_id is null
  or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true
  or not exists(select 1 from pcm.sso_codigo_ciclo c where c.cliente_id=p_cliente_id and c.tipo=p_tipo and c.ativo_id=p_ativo_id)
 then raise exception 'ciclo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_consultar_ciclo_codigo(p_tipo,p_ativo_id);
end;$$;
revoke all on function pcm.sso_mediar_consulta_codigo_rascunho(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_mediar_consulta_codigo_rascunho(uuid,text,uuid) to authenticated;

create function pcm.sso_mediar_edicao_codigo_rascunho(p_cliente_id uuid,p_request_id uuid,p_tipo text,p_ativo_id uuid,p_expected_revision integer,p_codigo_anterior text,p_codigo_novo text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 perform 1 from pcm.sso_mediacao_codigo_rascunho_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'mediacao_codigo_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_codigo_marcos_gate g where g.chave and g.habilitado for share;
 if not found then raise exception 'marcos_codigo_desabilitados' using errcode='55000'; end if;
 perform 1 from pcm.sso_codigo_rascunho_sem_sync_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'edicao_codigo_sem_sync_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_codigo_rascunho_gate g where g.chave and g.habilitado for share;
 if not found then raise exception 'edicao_codigo_rascunho_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_tipo not in ('sistema','componente') or p_ativo_id is null
  or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true
  or not exists(select 1 from pcm.sso_codigo_ciclo c where c.cliente_id=p_cliente_id and c.tipo=p_tipo and c.ativo_id=p_ativo_id)
 then raise exception 'ciclo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
 return pcm.sso_editar_codigo_rascunho(p_request_id,p_tipo,p_ativo_id,p_expected_revision,p_codigo_anterior,p_codigo_novo);
end;$$;
revoke all on function pcm.sso_mediar_edicao_codigo_rascunho(uuid,uuid,text,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_mediar_edicao_codigo_rascunho(uuid,uuid,text,uuid,integer,text,text) to authenticated;
