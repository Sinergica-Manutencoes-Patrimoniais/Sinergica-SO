-- ADR-1387: leitura parcial, mantendo o núcleo privado.
create table pcm.sso_obrigacoes_preparadas_mediadas_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_obrigacoes_preparadas_mediadas_gate(id,habilitado) values(true,false);
alter table pcm.sso_obrigacoes_preparadas_mediadas_gate enable row level security;
alter table pcm.sso_obrigacoes_preparadas_mediadas_gate force row level security;
revoke all on pcm.sso_obrigacoes_preparadas_mediadas_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_obrigacoes_preparadas_mediada(p_cliente_id uuid,p_plano_id uuid,p_apos_tipo text,p_apos_id uuid,p_limite integer)
returns table(tipo text,preparada_id uuid,versao_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento_original date,ocorrencia_grupo_id uuid,estado text,fila_executavel boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_obrigacoes_preparadas_mediadas_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fila_obrigacoes_preparadas_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select x.* from pcm.sso_listar_obrigacoes_preparadas(p_cliente_id,p_plano_id,p_apos_tipo,p_apos_id,p_limite) x;
end; $$;
revoke all on function pcm.sso_listar_obrigacoes_preparadas_mediada(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_obrigacoes_preparadas_mediada(uuid,uuid,text,uuid,integer) to authenticated;
