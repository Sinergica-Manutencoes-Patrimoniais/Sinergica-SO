-- ADR-0870 / SPEC_DEVIATION: revisão anterior somente se cada revisão intermediária for adição comprovada.
alter table pcm.chamado_os_comandos add column sso_snapshot_os jsonb;

create function pcm.sso_s167_revisoes_sao_adicoes(p_chamado uuid,p_cliente uuid,p_esperada bigint,p_atual bigint)
returns boolean language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin
  if p_esperada is null or p_atual is null or p_esperada < 1 or p_atual <= p_esperada
    or p_atual-p_esperada > 100 or pg_catalog.current_setting('session_replication_role') <> 'origin'
    or not exists(select 1 from pg_catalog.pg_trigger t
      where t.tgrelid='pcm.chamados'::pg_catalog.regclass and t.tgname='sso_incrementar_revisao_chamado'
        and not t.tgisinternal and t.tgenabled in ('O','A')
        and t.tgfoid='pcm.sso_incrementar_revisao_chamado()'::pg_catalog.regprocedure) then
    return false;
  end if;
  return not exists (
    select 1 from pg_catalog.generate_series(p_esperada+1,p_atual) as revisoes(revisao)
    where 1 <> (
      select count(*) from pcm.chamado_os_comandos c
      join pcm.ordens_servico o on o.id::text=c.resultado->>'osId'
        and o.chamado_id=p_chamado and o.client_id=p_cliente and o.deleted_at is null
      where c.chamado_id=p_chamado and c.cliente_id=p_cliente
        and c.payload->>'versao'='conversao-integral-v1'
        and c.payload->>'chamadoId'=p_chamado::text and c.payload->>'clienteId'=p_cliente::text
        and c.payload->>'osId'=c.resultado->>'osId'
        and c.resultado->>'chamadoId'=p_chamado::text and c.resultado->>'requestId'=c.request_id::text
        and c.resultado->'revision'=pg_catalog.to_jsonb(revisoes.revisao)
        and c.sso_snapshot_os=pg_catalog.jsonb_build_object('sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(o)::text,'UTF8')),'hex'),'xmin',o.xmin::text)
    )
  );
end;
$$;

-- ADR-0871: a representação JSON de timestamptz não pode depender do fuso do chamador.
alter function pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text) set timezone='UTC';
revoke all on function pcm.sso_s167_revisoes_sao_adicoes(uuid,uuid,bigint,bigint) from public,anon,authenticated,service_role;

do $$
declare
  v_funcao regprocedure := 'pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_antes text := 'if v_c.sso_revisao<>p_expected_revision then raise exception ''revisao_obsoleta'' using errcode=''40001''; end if;';
  v_depois text := 'if v_c.sso_revisao<>p_expected_revision and not pcm.sso_s167_revisoes_sao_adicoes(p_chamado_id,p_cliente_id,p_expected_revision,v_c.sso_revisao) then raise exception ''revisao_obsoleta'' using errcode=''40001''; end if;';
  v_lock text := 'perform o.id from pcm.ordens_servico o where (o.chamado_id=p_chamado_id or o.id=v_c.ordem_servico_id) and o.deleted_at is null order by o.id for share;';
  v_insert text := 'insert into pcm.chamado_os_comandos(request_id,actor_id,cliente_id,chamado_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,p_chamado_id,v_payload,v_resultado);';
  v_insert_novo text := 'insert into pcm.chamado_os_comandos(request_id,actor_id,cliente_id,chamado_id,payload,resultado,sso_snapshot_os) select p_request_id,v_actor,p_cliente_id,p_chamado_id,v_payload,v_resultado,pg_catalog.jsonb_build_object(''sha256'',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(o)::text,''UTF8'')),''hex''),''xmin'',o.xmin::text) from pcm.ordens_servico o where o.id=p_os_id; if not found then raise exception ''os_criada_nao_encontrada'' using errcode=''23514''; end if;';
begin
  if pg_catalog.strpos(v_definicao,v_antes)=0 or
    pg_catalog.length(v_definicao)-pg_catalog.length(pg_catalog.replace(v_definicao,v_antes,'')) <> pg_catalog.length(v_antes) or
    pg_catalog.strpos(v_definicao,v_lock)=0 or
    pg_catalog.length(v_definicao)-pg_catalog.length(pg_catalog.replace(v_definicao,v_lock,'')) <> pg_catalog.length(v_lock) or
    pg_catalog.strpos(v_definicao,v_insert)=0 or
    pg_catalog.length(v_definicao)-pg_catalog.length(pg_catalog.replace(v_definicao,v_insert,'')) <> pg_catalog.length(v_insert) then
    raise exception 'definicao_conversao_integral_incompativel' using errcode='55000';
  end if;
  v_definicao := pg_catalog.replace(v_definicao,v_antes,'');
  v_definicao := pg_catalog.replace(v_definicao,v_lock,v_lock || ' ' || v_depois);
  v_definicao := pg_catalog.replace(v_definicao,v_insert,v_insert_novo);
  execute v_definicao;
end;
$$;
