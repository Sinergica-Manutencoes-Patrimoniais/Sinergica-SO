-- ADR-1102: conflito não paralisa a página nem move histórico.
create or replace function pcm.sso_varrer_os_local(p_request_id uuid,p_cursor uuid,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_pagina pcm.sso_varredura_os_paginas%rowtype;v_os pcm.ordens_servico%rowtype;v_atual pcm.sso_observacoes_os%rowtype;
 v_id uuid;v_cursor uuid:=p_cursor;v_total integer:=0;v_alterados integer:=0;v_estado text;v_sync text;v_possui boolean;
 v_fonte timestamptz;v_resultado jsonb;v_conflito pcm.sso_conflitos_propriedade_os%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_request_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_varredura_os_gate where id and habilitado for share;
 if not found then raise exception 'varredura_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_observacao_os_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-varredura-os:'||p_request_id::text,0));
 select * into v_pagina from pcm.sso_varredura_os_paginas where request_id=p_request_id;
 if found then
   if v_pagina.cursor_entrada is distinct from p_cursor or v_pagina.limite is distinct from p_limite then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_pagina.resultado;
 end if;
 for v_id in select o.id from pcm.ordens_servico o where o.deleted_at is null
   and (o.auvo_sync_status is not null or o.auvo_task_id is not null) and (p_cursor is null or o.id>p_cursor) order by o.id limit p_limite loop
   v_cursor:=v_id;v_total:=v_total+1;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-observacao-os-item:'||v_id::text,0));
   select * into v_os from pcm.ordens_servico where id=v_id and deleted_at is null for share;
   if not found or v_os.client_id is null or (v_os.auvo_sync_status is null and v_os.auvo_task_id is null) then raise exception 'origem_alterada' using errcode='40001'; end if;
   v_fonte:=coalesce(v_os.updated_at,v_os.created_at);v_sync:=v_os.auvo_sync_status::text;v_possui:=v_os.auvo_task_id is not null;
   if v_fonte is null or not isfinite(v_fonte) then raise exception 'origem_invalida' using errcode='23514'; end if;
   v_estado:=case when v_possui then 'vinculo_observado_nao_confirmado' else 'incerto' end;
   select * into v_atual from pcm.sso_observacoes_os where os_id=v_id for update;
   if found and v_atual.cliente_id is distinct from v_os.client_id then
     select * into v_conflito from pcm.sso_conflitos_propriedade_os where os_id=v_id for update;
     if not found then
       insert into pcm.sso_conflitos_propriedade_os(os_id,cliente_observacao_id,cliente_atual_id,revisao)
         values(v_id,v_atual.cliente_id,v_os.client_id,1) returning * into v_conflito;
     elsif v_conflito.cliente_observacao_id is distinct from v_atual.cliente_id or v_conflito.cliente_atual_id is distinct from v_os.client_id then
       update pcm.sso_conflitos_propriedade_os set cliente_observacao_id=v_atual.cliente_id,cliente_atual_id=v_os.client_id,
         revisao=revisao+1,atualizado_em=now() where os_id=v_id returning * into v_conflito;
     else continue;
     end if;
     insert into pcm.sso_conflitos_propriedade_os_eventos(os_id,revisao,request_id,cliente_observacao_id,cliente_atual_id)
       values(v_id,v_conflito.revisao,p_request_id,v_conflito.cliente_observacao_id,v_conflito.cliente_atual_id);
     v_alterados:=v_alterados+1;
     continue;
   end if;
   if not found then
     insert into pcm.sso_observacoes_os(os_id,cliente_id,estado_local,sincronizacao,possui_tarefa,fonte_atualizada_em,revisao)
       values(v_id,v_os.client_id,v_estado,v_sync,v_possui,v_fonte,1) returning * into v_atual;
   elsif v_atual.estado_local is distinct from v_estado or v_atual.sincronizacao is distinct from v_sync
     or v_atual.possui_tarefa is distinct from v_possui or v_atual.fonte_atualizada_em is distinct from v_fonte then
     update pcm.sso_observacoes_os set estado_local=v_estado,sincronizacao=v_sync,possui_tarefa=v_possui,
       fonte_atualizada_em=v_fonte,revisao=revisao+1,atualizado_em=now() where os_id=v_id returning * into v_atual;
   else continue;
   end if;
   insert into pcm.sso_observacoes_os_eventos(os_id,revisao,request_id,ator_id,origem,estado_local,sincronizacao,possui_tarefa,fonte_atualizada_em)
     values(v_id,v_atual.revisao,p_request_id,null,'varredura',v_estado,v_sync,v_possui,v_fonte);
   v_alterados:=v_alterados+1;
 end loop;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'considerados',v_total,'alterados',v_alterados,
   'proximoCursor',case when v_total=p_limite then v_cursor else null end,'efeitoRemotoComprovado',false);
 insert into pcm.sso_varredura_os_paginas(request_id,cursor_entrada,limite,resultado) values(p_request_id,p_cursor,p_limite,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.varredura_os','sso_varredura_os_paginas',p_request_id,
   jsonb_build_object('considerados',v_total,'alterados',v_alterados));
 return v_resultado;
end; $$;
