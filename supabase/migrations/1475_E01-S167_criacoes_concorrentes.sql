-- ADR-1325: preparação; nenhuma restrição legada ou gate é aberto.
create or replace function pcm.sso_s167_revisoes_sao_adicoes(p_chamado uuid,p_cliente uuid,p_esperada bigint,p_atual bigint)
returns boolean language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_escopo text;
begin
  if p_esperada is null or p_atual is null or p_esperada < 1 or p_atual <= p_esperada
    or p_atual-p_esperada > 100 or pg_catalog.current_setting('session_replication_role') <> 'origin'
    or not exists(select 1 from pg_catalog.pg_trigger t
      where t.tgrelid='pcm.chamados'::pg_catalog.regclass and t.tgname='sso_incrementar_revisao_chamado'
        and not t.tgisinternal and t.tgenabled in ('O','A')
        and t.tgfoid='pcm.sso_incrementar_revisao_chamado()'::pg_catalog.regprocedure) then
    return false;
  end if;
  v_escopo := pcm.sso_hash_escopo_chamado(p_chamado);
  return not exists (
    select 1 from pg_catalog.generate_series(p_esperada+1,p_atual) as revisoes(revisao)
    where 1 <> (
      select count(*) from pcm.chamado_os_comandos c
      join pcm.ordens_servico o on o.id::text=c.resultado->>'osId'
        and o.chamado_id=p_chamado and o.client_id=p_cliente and o.deleted_at is null
      where c.chamado_id=p_chamado and c.cliente_id=p_cliente
        and ((c.payload->>'versao'='conversao-integral-v1' and
          c.sso_snapshot_os=pg_catalog.jsonb_build_object('sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(o)::text,'UTF8')),'hex'),'xmin',o.xmin::text)) or (
          not (c.payload ? 'versao') and not (c.payload ? 'acao')
          and c.payload - array['chamadoId','clienteId','expectedRevision','osId','titulo','descricao','categoria']::text[] = '{}'::jsonb
          and jsonb_typeof(c.payload->'expectedRevision')='number'
          and jsonb_typeof(c.payload->'titulo')='string'
          and jsonb_typeof(c.payload->'categoria')='string'
          and c.sso_snapshot_os=pg_catalog.jsonb_build_object('sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(o)::text,'UTF8')),'hex'),'xmin',o.xmin::text,'escopoSha256',v_escopo)
          -- Continuação também cria OS, mas altera proposta e não é adição simples.
          and not exists(select 1 from pcm.chamado_os_comandos composto
            where composto.payload->>'acao'='aprovar_continuacao'
              and composto.payload->>'requestCriarId'=c.request_id::text)
        ))
        and c.payload->>'chamadoId'=p_chamado::text and c.payload->>'clienteId'=p_cliente::text
        and c.payload->>'osId'=c.resultado->>'osId'
        and c.resultado->>'chamadoId'=p_chamado::text and c.resultado->>'requestId'=c.request_id::text
        and c.resultado->'revision'=pg_catalog.to_jsonb(revisoes.revisao)
    )
  );
end $$;
revoke all on function pcm.sso_s167_revisoes_sao_adicoes(uuid,uuid,bigint,bigint) from public,anon,authenticated,service_role;

alter function pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text) set timezone='UTC';
do $alteracao$
declare
  v_funcao regprocedure := 'pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_revisao text := $antes$if v_chamado.sso_revisao <> p_expected_revision then
    raise exception 'revisao_obsoleta' using errcode = '40001';
  end if;$antes$;
  v_revisao_nova text := $depois$perform pcm.sso_hash_escopo_chamado(p_chamado_id);
  perform o.id from pcm.ordens_servico o where (o.chamado_id = p_chamado_id or o.id = v_chamado.ordem_servico_id) and o.deleted_at is null order by o.id for share;
  if v_chamado.sso_revisao <> p_expected_revision and not pcm.sso_s167_revisoes_sao_adicoes(p_chamado_id,p_cliente_id,p_expected_revision,v_chamado.sso_revisao) then
    raise exception 'revisao_obsoleta' using errcode = '40001';
  end if;$depois$;
  v_insert text := $antes$insert into pcm.chamado_os_comandos(request_id, actor_id, cliente_id, chamado_id, payload, resultado)
    values (p_request_id, v_actor, p_cliente_id, p_chamado_id, v_payload, v_resultado);$antes$;
  v_insert_novo text := $depois$insert into pcm.chamado_os_comandos(request_id, actor_id, cliente_id, chamado_id, payload, resultado, sso_snapshot_os)
    select p_request_id, v_actor, p_cliente_id, p_chamado_id, v_payload, v_resultado,
      pg_catalog.jsonb_build_object('sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(o)::text,'UTF8')),'hex'),'xmin',o.xmin::text,'escopoSha256',pcm.sso_hash_escopo_chamado(p_chamado_id))
    from pcm.ordens_servico o where o.id=p_os_id;
  if not found then raise exception 'os_criada_nao_encontrada' using errcode='23514'; end if;$depois$;
begin
  if strpos(v_definicao,v_revisao)=0 or length(v_definicao)-length(replace(v_definicao,v_revisao,''))<>length(v_revisao)
    or strpos(v_definicao,v_insert)=0 or length(v_definicao)-length(replace(v_definicao,v_insert,''))<>length(v_insert) then
    raise exception 'definicao_criacao_os_incompativel' using errcode='55000';
  end if;
  v_definicao:=replace(v_definicao,v_revisao,v_revisao_nova);
  v_definicao:=replace(v_definicao,v_insert,v_insert_novo);
  execute v_definicao;
end;
$alteracao$;

-- A entrada de escopo conferido usa a mesma prova, incluindo criações simples fotografadas.
do $alteracao$
declare
  v_funcao regprocedure := 'pcm.sso_converter_os_concorrente(uuid,bigint,uuid,uuid,uuid,jsonb,text,text,text,uuid)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_inicio_marcador text := 'select count(*),count(distinct (c.resultado->>''revision'')) into v_qtd,v_distintas';
  v_fim_marcador text := 'v_resultado:=pcm.sso_converter_chamado_escopo_conferido';
  v_inicio integer := strpos(v_definicao,v_inicio_marcador);
  v_fim integer := strpos(v_definicao,v_fim_marcador);
  v_novo text := $trecho$perform o.id from pcm.ordens_servico o where (o.chamado_id=p_chamado_id or o.id=(select c.ordem_servico_id from pcm.chamados c where c.id=p_chamado_id)) and o.deleted_at is null order by o.id for share;
  if v_atual<>p_expected_revision and not pcm.sso_s167_revisoes_sao_adicoes(p_chamado_id,p_cliente_id,p_expected_revision,v_atual) then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  $trecho$;
begin
  if v_inicio=0 or v_fim<=v_inicio or
    length(v_definicao)-length(replace(v_definicao,v_inicio_marcador,''))<>length(v_inicio_marcador) or
    length(v_definicao)-length(replace(v_definicao,v_fim_marcador,''))<>length(v_fim_marcador) then
    raise exception 'definicao_criacao_concorrente_incompativel' using errcode='55000';
  end if;
  execute substring(v_definicao from 1 for v_inicio-1) || v_novo || substring(v_definicao from v_fim);
end;
$alteracao$;

-- A conversão integral já tranca o Chamado; antecipa a trava do escopo antes das OS.
do $alteracao$
declare
  v_funcao regprocedure := 'pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_lock text := 'perform o.id from pcm.ordens_servico o where (o.chamado_id=p_chamado_id or o.id=v_c.ordem_servico_id) and o.deleted_at is null order by o.id for share;';
begin
  if strpos(v_definicao,v_lock)=0 or length(v_definicao)-length(replace(v_definicao,v_lock,''))<>length(v_lock) then
    raise exception 'definicao_conversao_os_incompativel' using errcode='55000';
  end if;
  execute replace(v_definicao,v_lock,'perform pcm.sso_hash_escopo_chamado(p_chamado_id); ' || v_lock);
end;
$alteracao$;
