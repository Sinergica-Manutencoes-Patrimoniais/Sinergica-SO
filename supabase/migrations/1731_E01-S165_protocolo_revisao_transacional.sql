-- ADR-1589: liberação dedicada impede mudança de comportamento no rollout.
create table pcm.sso_protocolo_revisao_1731_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_protocolo_revisao_1731_gate(id,habilitado) values(true,false);
alter table pcm.sso_protocolo_revisao_1731_gate enable row level security;
alter table pcm.sso_protocolo_revisao_1731_gate force row level security;
revoke all on pcm.sso_protocolo_revisao_1731_gate from public,anon,authenticated,service_role;
-- Mantém o trigger 1045; exige protocolo obrigatório no próprio token.
create or replace function pcm.sso_bloquear_aprovacao_impacto_indeterminado()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' or pg_catalog.current_setting('session_replication_role')<>'origin'
  or new.txid is distinct from pg_catalog.txid_current() then raise exception 'transacao_invalida' using errcode='25001';end if;
 select cliente_id into v_cliente from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';end if;
 perform 1 from pcm.sso_protocolo_revisao_1731_gate where id and habilitado for share;
 if not found then raise exception 'protocolo_1731_desabilitado' using errcode='55000';end if;
 perform 1 from pcm.sso_aprovacao_revisao_mediada_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000';end if;
 perform pcm.sso_exigir_validadores_revisao_ativos();
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_aprovacao_impacto_indeterminado() from public,anon,authenticated,service_role;
