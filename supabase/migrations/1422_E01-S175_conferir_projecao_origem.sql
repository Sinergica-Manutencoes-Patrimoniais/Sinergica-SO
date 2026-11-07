-- ADR-1274: guarda transacional; falha reverte toda a criação/vínculo.
create function pcm.sso_conferir_projecao_origem() returns trigger language plpgsql security definer set search_path='' as $$
declare
  e pcm.origem_campo_inbox%rowtype; c pcm.sso_contratos_origem_campo%rowtype;
  campos jsonb; dados jsonb; p jsonb; fuso text; bruto text; os_raw text; chamado_raw text;
  os_valido boolean; chamado_valido boolean; campo text; chave text; data_civil text;
begin
  select * into e from pcm.origem_campo_inbox where id=new.envelope_id and integracao=new.integracao and task_id=new.task_id for share;
  if not found then raise exception 'envelope_incompativel' using errcode='23514'; end if;
  select * into c from pcm.sso_contratos_origem_campo where id=new.contrato_id and integracao=new.integracao and habilitado for share;
  if not found then raise exception 'contrato_indisponivel' using errcode='55000'; end if;
  campos:=c.definicao->'campos'; dados:=e.payload; p:=new.projecao; fuso:=c.definicao->>'fuso';
  if jsonb_typeof(campos) is distinct from 'object' or jsonb_typeof(c.definicao->'estados') is distinct from 'object'
    or fuso is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=fuso)
    or not (campos ?& array['taskId','clienteId','titulo','status','ordem']) then raise exception 'contrato_invalido' using errcode='23514'; end if;
  if dados->>(campos->>'taskId') is distinct from e.task_id::text
    or nullif(dados->>(campos->>'clienteId'),'') is distinct from e.cliente_externo_id
    or btrim(dados->>(campos->>'titulo')) is distinct from p->>'titulo'
    or nullif(btrim(dados->>(campos->>'descricao')),'') is distinct from p->>'descricao'
    or c.definicao->'estados'->>(dados->>(campos->>'status')) is distinct from p->>'statusCampo'
    or dados->>(campos->>'ordem') is distinct from p->>'ordemExterna' then
    raise exception 'projecao_divergente' using errcode='23514';
  end if;
  os_raw:=nullif(dados->>(campos->>'osExternaId'),''); chamado_raw:=nullif(dados->>(campos->>'chamadoId'),'');
  os_valido:=os_raw is null or os_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  chamado_valido:=chamado_raw is null or chamado_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  if (case when os_valido then lower(os_raw) else null end) is distinct from p->>'osExternaId'
    or (case when chamado_valido then lower(chamado_raw) else null end) is distinct from p->>'chamadoId'
    or p->'referenciaInvalida' is distinct from to_jsonb(not os_valido or not chamado_valido)
    or nullif(dados->>(campos->>'tecnicoId'),'') is distinct from p->>'tecnicoAuvoId'
    or nullif(dados->(campos->>'detalhes'),'null'::jsonb) is distinct from nullif(p->'detalhes','null'::jsonb) then
    raise exception 'projecao_divergente' using errcode='23514';
  end if;
  foreach campo in array array['dataAgendada','checkIn','checkOut'] loop
    chave:=campos->>campo; bruto:=dados->>chave;
    if bruto is null or bruto='' then
      if p->>campo is not null then raise exception 'projecao_divergente' using errcode='23514'; end if;
    else
      if bruto !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$' or p->>campo is null then raise exception 'projecao_divergente' using errcode='23514'; end if;
      data_civil:=to_char((p->>campo)::timestamptz at time zone fuso,'YYYY-MM-DD"T"HH24:MI:SS');
      if data_civil is distinct from bruto then raise exception 'projecao_divergente' using errcode='23514'; end if;
    end if;
  end loop;
  return new;
end; $$;
revoke all on function pcm.sso_conferir_projecao_origem() from public,anon,authenticated,service_role;
create trigger sso_conferir_projecao_origem before insert on pcm.sso_origem_campo_processamentos
  for each row execute function pcm.sso_conferir_projecao_origem();
