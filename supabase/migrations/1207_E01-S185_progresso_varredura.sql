-- ADR-1056. Nenhum cron, chamada externa ou abertura de gate.
create table pcm.sso_execucoes_varredura_fila (
  id uuid primary key, cursor_atual uuid, revisao integer not null check(revisao>=0),
  estado text not null check(estado in ('em_andamento','concluida')),
  considerados bigint not null default 0 check(considerados>=0),
  alterados bigint not null default 0 check(alterados>=0),
  criada_em timestamptz not null default now(), atualizada_em timestamptz not null default now()
);
create table pcm.sso_avancos_varredura_fila (
  request_id uuid primary key, execucao_id uuid not null references pcm.sso_execucoes_varredura_fila(id),
  revisao_esperada integer not null check(revisao_esperada>=0), limite integer not null check(limite between 1 and 50),
  resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_execucoes_varredura_fila enable row level security;
alter table pcm.sso_execucoes_varredura_fila force row level security;
alter table pcm.sso_avancos_varredura_fila enable row level security;
alter table pcm.sso_avancos_varredura_fila force row level security;
revoke all on pcm.sso_execucoes_varredura_fila,pcm.sso_avancos_varredura_fila from public,anon,authenticated,service_role;
create trigger sso_avancos_varredura_imutaveis before update or delete on pcm.sso_avancos_varredura_fila
  for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_avancar_varredura_fila(p_execucao_id uuid,p_request_id uuid,p_expected_revision integer,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_run pcm.sso_execucoes_varredura_fila%rowtype; v_anterior pcm.sso_avancos_varredura_fila%rowtype;
  v_pagina jsonb; v_cursor uuid; v_considerados integer; v_alterados integer; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if p_execucao_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision<0
    or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform 1 from pcm.sso_varredura_fila_gate where id and habilitado for share;
  if not found then raise exception 'varredura_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_observacao_fila_gate where id and habilitado for share;
  if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
  if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-avanco-varredura-request:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_avancos_varredura_fila where request_id=p_request_id;
  if found then
    if v_anterior.execucao_id is distinct from p_execucao_id or v_anterior.revisao_esperada is distinct from p_expected_revision
      or v_anterior.limite is distinct from p_limite then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_anterior.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-execucao-varredura:'||p_execucao_id::text,0));
  select * into v_run from pcm.sso_execucoes_varredura_fila where id=p_execucao_id for update;
  if not found then
    if p_expected_revision<>0 then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
    insert into pcm.sso_execucoes_varredura_fila(id,revisao,estado) values(p_execucao_id,0,'em_andamento') returning * into v_run;
  end if;
  if v_run.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_run.estado<>'em_andamento' then raise exception 'execucao_concluida' using errcode='23514'; end if;
  v_pagina:=pcm.sso_varrer_fila_local(p_request_id,v_run.cursor_atual,p_limite);
  v_cursor:=(v_pagina->>'proximoCursor')::uuid;
  v_considerados:=(v_pagina->>'considerados')::integer;
  v_alterados:=(v_pagina->>'alterados')::integer;
  if v_pagina->>'requestId' is distinct from p_request_id::text or v_pagina->'efeitoRemotoComprovado' is distinct from 'false'::jsonb
    or v_considerados is null or v_considerados not between 0 and p_limite or v_alterados is null or v_alterados not between 0 and v_considerados
    or (v_considerados<p_limite and v_cursor is not null) or (v_considerados=p_limite and (v_cursor is null or (v_run.cursor_atual is not null and v_cursor<=v_run.cursor_atual))) then
    raise exception 'pagina_invalida' using errcode='23514'; end if;
  update pcm.sso_execucoes_varredura_fila set cursor_atual=v_cursor,revisao=revisao+1,
    estado=case when v_cursor is null then 'concluida' else 'em_andamento' end,
    considerados=considerados+v_considerados,alterados=alterados+v_alterados,atualizada_em=now()
    where id=p_execucao_id returning * into v_run;
  v_resultado:=jsonb_build_object('execucaoId',p_execucao_id,'requestId',p_request_id,'revisao',v_run.revisao,'estado',v_run.estado,
    'cursor',v_run.cursor_atual,'considerados',v_run.considerados,'alterados',v_run.alterados,'efeitoRemotoComprovado',false);
  insert into pcm.sso_avancos_varredura_fila(request_id,execucao_id,revisao_esperada,limite,resultado)
    values(p_request_id,p_execucao_id,p_expected_revision,p_limite,v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_avancar_varredura_fila(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_avancar_varredura_fila(uuid,uuid,integer,integer) to service_role;
revoke all on function pcm.sso_varrer_fila_local(uuid,uuid,integer) from public,anon,authenticated,service_role;
