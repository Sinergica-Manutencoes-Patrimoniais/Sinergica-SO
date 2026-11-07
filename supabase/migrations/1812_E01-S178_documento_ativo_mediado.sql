-- ADR-1670: não expõe caminho ao usuário; gate fechado por padrão.
create table pcm.sso_documento_ativo_mediado_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_documento_ativo_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_documento_ativo_mediado_gate enable row level security;
alter table pcm.sso_documento_ativo_mediado_gate force row level security;
revoke all on pcm.sso_documento_ativo_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_autorizar_documento_ativo_mediado(p_ator_id uuid,p_vinculo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_objeto uuid; v_documento uuid; v_cliente uuid; v_atualizado timestamptz;
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_vinculo_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_documento_ativo_mediado_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_documento_staging_ativo_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_documentos_levantamento_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 select o.id,d.id,x.cliente_id,o.updated_at into v_objeto,v_documento,v_cliente,v_atualizado
 from pcm.sso_documento_staging_ativo x
 join pcm.sso_documentos_levantamento d on d.id=x.documento_id and d.cliente_id=x.cliente_id
 join storage.objects o on o.id=d.objeto_id and o.bucket_id='sso-levantamento-documentos'
 where x.id=p_vinculo_id for share of x,d,o nowait;
 if not found or v_atualizado is null then raise exception 'documento_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_caminho_documento_staging_ativo(p_vinculo_id);
 return jsonb_build_object('objetoId',v_objeto,'documentoId',v_documento,'clienteId',v_cliente,'objetoAtualizadoEm',v_atualizado);
end; $$;
revoke all on function pcm.sso_autorizar_documento_ativo_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_autorizar_documento_ativo_mediado(uuid,uuid) to authenticated;

create function pcm.sso_localizar_documento_ativo_servico(p_vinculo_id uuid)
returns table(caminho text,objeto_id uuid,documento_id uuid,cliente_id uuid,objeto_atualizado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if p_vinculo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 perform 1 from pcm.sso_documento_ativo_mediado_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_documento_staging_ativo_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_documentos_levantamento_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 return query select o.name,o.id,d.id,x.cliente_id,o.updated_at from pcm.sso_documento_staging_ativo x
 join pcm.sso_documentos_levantamento d on d.id=x.documento_id and d.cliente_id=x.cliente_id
 join storage.objects o on o.id=d.objeto_id and o.bucket_id='sso-levantamento-documentos'
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 join lateral (select a.decisao from pcm.sso_decisoes_documento_levantamento a where a.documento_id=d.id order by a.revisao desc limit 1) u on u.decisao='aceito'
 where x.id=p_vinculo_id and not pcm.sso_documento_inadequado(d.id)
 and ((x.tipo='sistema' and exists(select 1 from pcm.sistemas s where s.id=x.entidade_id and s.cliente_id=x.cliente_id and s.ativo and s.deleted_at is null))
 or (x.tipo='componente' and exists(select 1 from pcm.equipamentos e where e.id=x.entidade_id and e.client_id=x.cliente_id and e.tipo='componente' and e.ativo and e.deleted_at is null))
 or (x.tipo='grupo_quantitativo' and exists(select 1 from pcm.grupos_quantitativos g where g.id=x.entidade_id and g.cliente_id=x.cliente_id and g.ativo and g.deleted_at is null)));
end; $$;
revoke all on function pcm.sso_localizar_documento_ativo_servico(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_localizar_documento_ativo_servico(uuid) to service_role;

-- Listagem devolve somente os campos já previstos pelo núcleo privado.
create function pcm.sso_listar_documentos_ativo_mediado(p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,titulo text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_documento_ativo_mediado_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_documento_staging_ativo_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_documentos_levantamento_gate g where g.id and g.habilitado for share nowait;
 if not found then raise exception 'documento_desabilitado' using errcode='55000'; end if;
 return query select d.id,d.titulo,d.criado_em from pcm.sso_listar_documentos_staging_ativo(p_tipo,p_entidade_id,p_apos,p_limite) d;
end; $$;
revoke all on function pcm.sso_listar_documentos_ativo_mediado(text,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_documentos_ativo_mediado(text,uuid,uuid,integer) to authenticated;
