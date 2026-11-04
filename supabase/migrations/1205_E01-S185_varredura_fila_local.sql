-- ADR-1054. Página privada; não agenda job, não chama Auvo nem concede EXECUTE.
create table pcm.sso_varredura_fila_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_varredura_fila_gate(id,habilitado) values(true,false);
alter table pcm.sso_varredura_fila_gate enable row level security;
alter table pcm.sso_varredura_fila_gate force row level security;
revoke all on pcm.sso_varredura_fila_gate from public,anon,authenticated,service_role;

alter table pcm.sso_ocorrencias_fila_eventos alter column ator_id drop not null;
alter table pcm.sso_ocorrencias_fila_eventos add column origem text not null default 'operador'
  check(origem in ('operador','varredura'));
alter table pcm.sso_ocorrencias_fila_eventos add constraint sso_evento_fila_origem_ator
  check((origem='operador' and ator_id is not null) or (origem='varredura' and ator_id is null));

create table pcm.sso_varredura_fila_paginas (
  request_id uuid primary key, cursor_entrada uuid, limite integer not null check(limite between 1 and 50),
  resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_varredura_fila_paginas enable row level security;
alter table pcm.sso_varredura_fila_paginas force row level security;
revoke all on pcm.sso_varredura_fila_paginas from public,anon,authenticated,service_role;
create trigger sso_varredura_fila_paginas_imutaveis before update or delete on pcm.sso_varredura_fila_paginas
  for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_varrer_fila_local(p_request_id uuid,p_cursor uuid,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_pagina pcm.sso_varredura_fila_paginas%rowtype; v_outbox pcm.auvo_sync_outbox%rowtype;
  v_atual pcm.sso_ocorrencias_fila%rowtype; v_id uuid; v_cliente uuid; v_estado text;
  v_cursor uuid:=p_cursor; v_total integer:=0; v_alterados integer:=0; v_resultado jsonb;v_cliente_historico uuid;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if p_request_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform 1 from pcm.sso_varredura_fila_gate where id and habilitado for share;
  if not found then raise exception 'varredura_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_observacao_fila_gate where id and habilitado for share;
  if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
  if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-varredura-fila:'||p_request_id::text,0));
  select * into v_pagina from pcm.sso_varredura_fila_paginas where request_id=p_request_id;
  if found then
    if v_pagina.cursor_entrada is distinct from p_cursor or v_pagina.limite is distinct from p_limite then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_pagina.resultado;
  end if;
  for v_id in select o.id from pcm.auvo_sync_outbox o where o.entity in ('sistemas','equipamentos')
    and (p_cursor is null or o.id>p_cursor) order by o.id limit p_limite loop
    v_cursor:=v_id; v_total:=v_total+1;
    select * into v_outbox from pcm.auvo_sync_outbox where id=v_id for update;
    if not found or v_outbox.entity not in ('sistemas','equipamentos') or v_outbox.status not in ('pending','processing','error','sent')
      or v_outbox.attempts is null or v_outbox.attempts<0 then raise exception 'origem_alterada' using errcode='40001'; end if;
    v_cliente:=null;
    if v_outbox.entity='sistemas' then
      select cliente_id into v_cliente from pcm.sistemas where id=v_outbox.row_id for share;
    else
      select client_id into v_cliente from pcm.equipamentos where id=v_outbox.row_id for share;
    end if;
    -- Sem Cliente comprovado não há ocorrência atribuível; inspeção separada é necessária.
    if v_cliente is null then continue; end if;
    select cliente_id into v_cliente_historico from pcm.sso_ocorrencias_fila where outbox_id=v_id for update;
    if found and v_cliente_historico is distinct from v_cliente then
      perform pcm.sso_quarentenar_propriedade_fila(p_request_id,v_id,v_cliente_historico,v_cliente,'ocorrencia');
      continue;
    end if;
    select cliente_id into v_cliente_historico from pcm.sso_demora_fila_observacoes where outbox_id=v_id for update;
    if found and v_cliente_historico is distinct from v_cliente then
      perform pcm.sso_quarentenar_propriedade_fila(p_request_id,v_id,v_cliente_historico,v_cliente,'demora');
      continue;
    end if;
    perform pcm.sso_observar_demora_fila(p_request_id,v_id,v_cliente);
    v_estado:=case v_outbox.status when 'pending' then 'pendente' when 'sent' then 'enviado_nao_confirmado' else 'incerto' end;
    select * into v_atual from pcm.sso_ocorrencias_fila where outbox_id=v_id for update;
    if found and (v_atual.cliente_id is distinct from v_cliente or v_atual.entidade is distinct from v_outbox.entity or v_atual.objeto_id is distinct from v_outbox.row_id) then
      raise exception 'origem_exige_reconciliacao' using errcode='23514'; end if;
    if not found then
      insert into pcm.sso_ocorrencias_fila(outbox_id,cliente_id,entidade,objeto_id,estado,estado_fonte,tentativas,revisao)
        values(v_id,v_cliente,v_outbox.entity,v_outbox.row_id,v_estado,v_outbox.status,v_outbox.attempts,1) returning * into v_atual;
    elsif v_atual.estado is distinct from v_estado or v_atual.estado_fonte is distinct from v_outbox.status or v_atual.tentativas is distinct from v_outbox.attempts then
      update pcm.sso_ocorrencias_fila set estado=v_estado,estado_fonte=v_outbox.status,tentativas=v_outbox.attempts,revisao=revisao+1,atualizado_em=now()
        where outbox_id=v_id returning * into v_atual;
    else
      continue;
    end if;
    insert into pcm.sso_ocorrencias_fila_eventos(outbox_id,revisao,request_id,ator_id,origem,estado,estado_fonte,tentativas)
      values(v_id,v_atual.revisao,p_request_id,null,'varredura',v_estado,v_outbox.status,v_outbox.attempts);
    v_alterados:=v_alterados+1;
  end loop;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'considerados',v_total,'alterados',v_alterados,
    'proximoCursor',case when v_total=p_limite then v_cursor else null end,'efeitoRemotoComprovado',false);
  insert into pcm.sso_varredura_fila_paginas(request_id,cursor_entrada,limite,resultado) values(p_request_id,p_cursor,p_limite,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.varredura_fila','sso_varredura_fila_paginas',p_request_id,
    jsonb_build_object('considerados',v_total,'alterados',v_alterados));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_varrer_fila_local(uuid,uuid,integer) from public,anon,authenticated,service_role;
