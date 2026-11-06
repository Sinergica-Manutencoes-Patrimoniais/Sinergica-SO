-- ADR-1385: núcleos permanecem privados e escrita tem gate próprio.
create table pcm.sso_vinculo_os_grupo_mediado_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_vinculo_os_grupo_mediado_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_vinculo_os_grupo_mediado_gate enable row level security;
alter table pcm.sso_vinculo_os_grupo_mediado_gate force row level security;
revoke all on pcm.sso_vinculo_os_grupo_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_os_candidatas_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text,status text) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_vinculo_os_grupo_mediado_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_vinculo_os_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or p_limite is null or p_limite not between 1 and 100
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.ocorrencias_visita_preparadas o on o.id=g.visita_preparada_id
   join pcm.sso_visitas_suprimidas_feriado s on s.visita_id=o.visita_id and s.cliente_id=g.cliente_id
   where g.id=p_ocorrencia_id and g.cliente_id=p_cliente_id) then raise exception 'ocorrencia_suprimida' using errcode='23514'; end if;
 return query select x.* from pcm.sso_listar_os_candidatas_grupo(p_cliente_id,p_ocorrencia_id,p_apos,p_limite) x;
end; $$;
revoke all on function pcm.sso_listar_os_candidatas_grupo_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_os_candidatas_grupo_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_declarar_vinculo_os_grupo_mediado(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_os_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_vinculo_os_grupo_mediado_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_vinculo_os_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or p_request_id is null or p_os_id is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_declarar_vinculo_os_grupo(p_request_id,p_cliente_id,p_ocorrencia_id,p_os_id,p_motivo);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_vinculo_os_grupo_mediado(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_vinculo_os_grupo_mediado(uuid,uuid,uuid,uuid,text) to authenticated;
