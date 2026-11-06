-- ADR-1410: leitura de metadados sem conceder acesso direto à função privada.
create table pcm.sso_leitura_evidencia_material_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_leitura_evidencia_material_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_leitura_evidencia_material_mediada_gate enable row level security;
alter table pcm.sso_leitura_evidencia_material_mediada_gate force row level security;
revoke all on pcm.sso_leitura_evidencia_material_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_evidencias_material_mediada(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_evento_revision integer,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_leitura_evidencia_material_mediada_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_material_evidencia_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_evidencias_material(p_lista_id,p_evento_revision,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_evidencias_material_mediada(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_evidencias_material_mediada(uuid,uuid,uuid,integer,uuid,integer) to authenticated;
