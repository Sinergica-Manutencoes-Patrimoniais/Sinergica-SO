-- ADR-0846: mediação fechada; núcleo 1032 permanece privado.
create table pcm.sso_consulta_conflitos_webhook_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_consulta_conflitos_webhook_gate enable row level security;
alter table pcm.sso_consulta_conflitos_webhook_gate force row level security;
revoke all on pcm.sso_consulta_conflitos_webhook_gate from public,anon,authenticated,service_role;
insert into pcm.sso_consulta_conflitos_webhook_gate(id,habilitado) values(true,false);

create function pcm.sso_listar_conflitos_webhook_autorizado(
 p_cliente_id uuid,p_os_id uuid,p_apos timestamptz,p_apos_id uuid,p_limite integer
) returns table(id uuid,task_id text,status_remoto text,criado_em timestamptz,resolvido_em timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.sso_consulta_conflitos_webhook_gate g where g.id),false) then raise exception 'consulta_conflito_bloqueada' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_consulta_conflitos_webhook_gate g where g.id for share;
 if not coalesce((select g.habilitado from pcm.sso_consulta_conflitos_webhook_gate g where g.id),false) then raise exception 'consulta_conflito_bloqueada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate g where g.id for share;
 return query select * from pcm.sso_listar_conflitos_webhook_chamado(p_cliente_id,p_os_id,p_apos,p_apos_id,p_limite);
end; $$;
revoke all on function pcm.sso_listar_conflitos_webhook_autorizado(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conflitos_webhook_autorizado(uuid,uuid,timestamptz,uuid,integer) to authenticated;
