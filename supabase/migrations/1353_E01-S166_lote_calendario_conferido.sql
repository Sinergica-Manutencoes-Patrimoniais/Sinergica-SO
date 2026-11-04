-- ADR-1199: comparação do resultado na mesma transação do comando canônico.
create table pcm.sso_lote_calendario_conferido_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_lote_calendario_conferido_gate(id,habilitado) values(true,false);
create table pcm.sso_lote_calendario_conferido_tokens(txid bigint not null,ator_id uuid not null,request_id uuid not null,primary key(txid,ator_id,request_id));
alter table pcm.sso_lote_calendario_conferido_gate enable row level security;
alter table pcm.sso_lote_calendario_conferido_gate force row level security;
alter table pcm.sso_lote_calendario_conferido_tokens enable row level security;
alter table pcm.sso_lote_calendario_conferido_tokens force row level security;
revoke all on pcm.sso_lote_calendario_conferido_gate,pcm.sso_lote_calendario_conferido_tokens from public,anon,authenticated,service_role;

create function pcm.sso_exigir_lote_calendario_conferido(p_request_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 perform 1 from pcm.sso_lote_calendario_conferido_gate g where g.id for share;
 if not found then raise exception 'gate_indisponivel' using errcode='55000'; end if;
 if not (select g.habilitado from pcm.sso_lote_calendario_conferido_gate g where g.id) then return; end if;
 -- O núcleo valida integralmente ator e payload de recibos anteriores.
 if exists(select 1 from pcm.calendario_contratual_comandos c where c.request_id=p_request_id) then return; end if;
 if auth.uid() is null or not exists(select 1 from pcm.sso_lote_calendario_conferido_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid() and t.request_id=p_request_id)
   then raise exception 'previa_conferida_obrigatoria' using errcode='55000'; end if;
end; $$;
revoke all on function pcm.sso_exigir_lote_calendario_conferido(uuid) from public,anon,authenticated,service_role;

-- Inserção após a guarda 1002, preservando assinatura e concessões existentes.
do $$
declare v_def text;v_marcador text:=E'begin\n perform pcm.sso_guardar_ordem_ciclo(p_cliente_id);';
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date)'::regprocedure);
 if pg_catalog.strpos(v_def,v_marcador)=0 or pg_catalog.strpos(v_def,'sso_exigir_lote_calendario_conferido')>0
  then raise exception 'definicao_lote_incompativel' using errcode='55000'; end if;
 v_def:=pg_catalog.replace(v_def,v_marcador,v_marcador||E'\n perform pcm.sso_exigir_lote_calendario_conferido(p_request_id);');
 execute v_def;
end; $$;

create function pcm.sso_materializar_lote_calendario_conferido(
 p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,
 p_expected_revision integer,p_inicio date,p_fim date,p_esperados jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;v_esperados jsonb;v_atuais jsonb;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_plano_id is null
  or p_esperados is null or jsonb_typeof(p_esperados)<>'array' or jsonb_array_length(p_esperados) not between 1 and 31 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_esperados) e where jsonb_typeof(e)<>'object' or (e-'ciclo'-'vencimento')<>'{}'::jsonb
  or jsonb_typeof(e->'ciclo') is distinct from 'number' or e->>'ciclo' !~ '^(0|[1-9][0-9]{0,8})$'
  or jsonb_typeof(e->'vencimento') is distinct from 'string' or e->>'vencimento' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  or exists(select 1 from jsonb_array_elements(p_esperados) e group by (e->>'ciclo')::integer having count(*)>1) then raise exception 'previa_invalida' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_lote_ciclos_calendario_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'lote_calendario_bloqueado' using errcode='55000'; end if;
 perform 1 from pcm.sso_lote_calendario_conferido_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'lote_conferido_bloqueado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select jsonb_agg(jsonb_build_object('ciclo',(e->>'ciclo')::integer,'vencimento',e->>'vencimento') order by (e->>'ciclo')::integer)
  into v_esperados from jsonb_array_elements(p_esperados) e;
 insert into pcm.sso_lote_calendario_conferido_tokens(txid,ator_id,request_id) values(pg_catalog.txid_current(),p_ator_id,p_request_id);
 v_resultado:=pcm.sso_materializar_lote_calendario(p_request_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_inicio,p_fim);
 delete from pcm.sso_lote_calendario_conferido_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=p_ator_id and t.request_id=p_request_id;
 if jsonb_typeof(v_resultado->'itens') is distinct from 'array' then raise exception 'recibo_invalido' using errcode='23514'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('ciclo',(e->>'indice')::integer,'vencimento',e->>'vencimentoOriginal') order by (e->>'indice')::integer),'[]'::jsonb)
  into v_atuais from jsonb_array_elements(v_resultado->'itens') e;
 if v_atuais is distinct from v_esperados then raise exception 'previa_divergente' using errcode='40001'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_materializar_lote_calendario_conferido(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_materializar_lote_calendario_conferido(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) to authenticated;
