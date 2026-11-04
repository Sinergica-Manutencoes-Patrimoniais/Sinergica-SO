-- ADR-1149: proposta privada; não cria produtor, executor ou concessões.
create function pcm.sso_t24_registrar_resultado_outbox(
 p_request_id uuid,p_tentativa_id uuid,p_fence bigint,p_estado text,p_tarefa_observada text,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_outbox_id uuid; q pcm.auvo_sync_outbox%rowtype; v_resultado jsonb; v_existente boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 if p_request_id is null or p_tentativa_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select outbox_id into v_outbox_id from pcm.sso_t24_tentativas where id=p_tentativa_id;
 if v_outbox_id is null then raise exception 'outbox_indisponivel' using errcode='42501'; end if;
 select * into q from pcm.auvo_sync_outbox where id=v_outbox_id for update;
 if not found or q.entity<>'ordens_servico_t24' or q.status not in ('processing','error') then
  raise exception 'outbox_indisponivel' using errcode='40001';
 end if;
 -- Um estado error só admite recuperação de recibo já persistido, nunca uma nova decisão.
 select exists(select 1 from pcm.sso_t24_resultado_recibos r where r.request_id=p_request_id and r.tentativa_id=p_tentativa_id) into v_existente;
 if q.status='error' and not v_existente then raise exception 'outbox_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_t24_tentativas t where t.id=p_tentativa_id and t.outbox_id=q.id and t.os_id=q.row_id
   and q.op=case t.operacao when 'criar' then 'create' else 'update' end) then
  raise exception 'outbox_divergente' using errcode='40001';
 end if;
 -- Replay antigo não pode mudar a linha se ela tiver sido retomada por outro fluxo.
 -- O núcleo verifica integralmente o payload antes de devolver o recibo histórico.
 if v_existente then
  v_resultado:=pcm.sso_t24_registrar_resultado_conservador(p_request_id,p_tentativa_id,p_fence,p_estado,p_tarefa_observada,p_motivo);
  return v_resultado || jsonb_build_object('outboxId',q.id,'outboxStatus',q.status,'reciboHistorico',true);
 end if;
 v_resultado:=pcm.sso_t24_registrar_resultado_conservador(p_request_id,p_tentativa_id,p_fence,p_estado,p_tarefa_observada,p_motivo);
 if q.status='processing' then
  update pcm.auvo_sync_outbox set status='error',last_error='t24_requer_conferencia',sent_at=null where id=q.id;
 end if;
 return v_resultado || jsonb_build_object('outboxId',q.id,'outboxStatus','error','reciboHistorico',false);
end; $$;
revoke all on function pcm.sso_t24_registrar_resultado_outbox(uuid,uuid,bigint,text,text,text) from public,anon,authenticated,service_role;
