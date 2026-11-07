-- ADR-1398: retificação não pode deixar recepção ou processamento em Cliente anterior.
create function pcm.sso_guardar_retificacao_campo_recebido() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_integracao text;v_task bigint;
begin
 if new.cliente_id is not distinct from old.cliente_id then return new; end if;
 select i.integracao,i.task_id into v_integracao,v_task from pcm.origem_campo_inbox i where i.id=old.envelope_id for update nowait;
 if not found then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
 if v_integracao='auvo' and v_task is not null and not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-origem-campo-tarefa:'||v_task::text,0)) then
   raise exception 'processamento_em_andamento' using errcode='55P03';
 end if;
 if exists(select 1 from pcm.sso_recepcao_envelope_campo r where r.envelope_id=old.envelope_id)
   or exists(select 1 from pcm.sso_origem_campo_processamentos p where p.integracao=v_integracao and p.task_id=v_task) then
   raise exception 'origem_recebida_ou_processada_exige_reconciliacao' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_retificacao_campo_recebido() from public,anon,authenticated,service_role;
create trigger sso_guardar_retificacao_campo_recebido before update of cliente_id on pcm.sso_origem_campo_triagens
for each row execute function pcm.sso_guardar_retificacao_campo_recebido();
