-- ADR-1148: somente preparação. Nenhum produtor ou executor é habilitado.
alter table pcm.sso_t24_tentativas add column outbox_id uuid references pcm.auvo_sync_outbox(id);
-- ADR-1186: a reserva abaixo e os produtores posteriores já leem esta fotografia.
alter table pcm.sso_t24_tentativas add column despacho jsonb
 check(despacho is null or (jsonb_typeof(despacho)='object' and octet_length(despacho::text)<=16384));
create unique index sso_t24_outbox_unica on pcm.sso_t24_tentativas(outbox_id) where outbox_id is not null;

-- A entidade reservada jamais deve ser consumida pelo drain genérico.
create or replace function pcm.fn_claim_auvo_outbox_batch(p_limit int default 20)
returns setof pcm.auvo_sync_outbox language sql security definer set search_path = pcm, public as $$
  update pcm.auvo_sync_outbox set status='processing'
  where id in (
    select id from pcm.auvo_sync_outbox
    where status='pending' and entity <> 'ordens_servico_t24'
    order by enqueued_at for update skip locked limit p_limit
  ) returning *;
$$;

create or replace function pcm.sso_t24_reservar_candidata(p_duracao_segundos integer) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_t24_tentativas%rowtype; q pcm.auvo_sync_outbox%rowtype;
 v_sequencia bigint; v_agora timestamptz:=clock_timestamp();
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 if p_duracao_segundos is null or p_duracao_segundos not between 10 and 300 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_reserva_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 -- A fila controla a ordem de trabalho; o livro é associado, não uma fila paralela.
 select o.* into q from pcm.auvo_sync_outbox o
 join pcm.sso_t24_tentativas t on t.outbox_id=o.id
 where o.entity='ordens_servico_t24' and o.row_id=t.os_id
  and o.op=case t.operacao when 'criar' then 'create' else 'update' end
  and t.elegivel_em<=v_agora
  and ((o.status='pending' and t.estado='aguardando')
    or (o.status='processing' and t.estado='reservado' and t.reservado_ate<=v_agora))
 order by t.elegivel_em,o.enqueued_at,o.id for update of o skip locked limit 1;
 if not found then return null; end if;
 select * into v from pcm.sso_t24_tentativas where outbox_id=q.id for update;
 if not found or v.os_id<>q.row_id or v.elegivel_em>v_agora
  or not ((q.status='pending' and v.estado='aguardando') or (q.status='processing' and v.estado='reservado' and v.reservado_ate<=v_agora))
  then raise exception 'candidata_obsoleta' using errcode='40001'; end if;
 if v.fence>=9007199254740991 then raise exception 'fence_esgotado' using errcode='22003'; end if;
 update pcm.auvo_sync_outbox set status='processing' where id=q.id;
 update pcm.sso_t24_tentativas set estado='reservado',fence=fence+1,reservado_ate=v_agora+make_interval(secs=>p_duracao_segundos),atualizado_em=v_agora
  where id=v.id returning * into v;
 select coalesce(max(sequencia),0)+1 into v_sequencia from pcm.sso_t24_tentativa_eventos where tentativa_id=v.id;
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(v.id,v_sequencia,v.fence,'reservado','candidata_reservada_outbox');
 return jsonb_build_object('outboxId',q.id,'tentativaId',v.id,'clienteId',v.cliente_id,'visitaId',v.visita_id,'osId',v.os_id,
  'revisao',v.revisao_visita,'operacao',v.operacao,'tarefaId',v.tarefa_id,'esperado',v.esperado,'despacho',v.despacho,
  'questionarioObrigatorio',v.questionario_obrigatorio,'fence',v.fence,'reservadoAte',v.reservado_ate,'autorizaEnvio',false);
end; $$;
revoke all on function pcm.sso_t24_reservar_candidata(integer) from public,anon,authenticated,service_role;
