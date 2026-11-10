-- ADR-1663: vínculo transacional de aprovações novas à versão explicitamente conferida.
create table pcm.sso_exigir_versao_aprovacao_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_exigir_versao_aprovacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_exigir_versao_aprovacao_gate enable row level security;
alter table pcm.sso_exigir_versao_aprovacao_gate force row level security;
revoke all on pcm.sso_exigir_versao_aprovacao_gate from public,anon,authenticated,service_role;

create table pcm.sso_aprovacao_versao_tokens (
  txid bigint not null, request_id uuid not null, ator_id uuid not null, cliente_id uuid not null,
  plano_id uuid not null, versao_id uuid not null, revisao integer not null, vigencia date not null,
  primary key (txid,request_id)
);
alter table pcm.sso_aprovacao_versao_tokens enable row level security;
alter table pcm.sso_aprovacao_versao_tokens force row level security;
revoke all on pcm.sso_aprovacao_versao_tokens from public,anon,authenticated,service_role;

create function pcm.sso_exigir_token_versao_aprovacao(p_request uuid,p_plano uuid,p_versao uuid,p_revisao integer,p_vigencia date,p_cliente uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_exigir_versao_aprovacao_gate where id for share nowait;
  if not found then raise exception 'gate_indisponivel' using errcode='55000'; end if;
  if not v_habilitado then return; end if;
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not exists(select 1 from pcm.sso_aprovacao_versao_tokens t where t.txid=pg_catalog.txid_current()
    and t.request_id=p_request and t.ator_id=auth.uid() and t.cliente_id=p_cliente
    and t.plano_id=p_plano and t.versao_id=p_versao and t.revisao=p_revisao and t.vigencia=p_vigencia) then
    raise exception 'versao_esperada_obrigatoria' using errcode='23514';
  end if;
end; $$;
revoke all on function pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid) from public,anon,authenticated,service_role;

-- O marcador está após autorização, conferência de payload e retorno de recibo antigo.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_plano(uuid,integer,uuid,date)'::regprocedure);
  a text:=$a$  -- Bloqueios em ordem estável impedem alteração das referências até o snapshot.$a$;
  b text:=$b$  perform pcm.sso_exigir_token_versao_aprovacao(p_request_id,p_plano_id,v_versao.id,p_expected_revision,p_vigencia,v_antes.cliente_id);
  -- Bloqueios em ordem estável impedem alteração das referências até o snapshot.$b$;
begin
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 or strpos(d,'sso_exigir_token_versao_aprovacao')>0 then
    raise exception 'aprovacao_plano_incompativel' using errcode='55000'; end if;
  execute replace(d,a,b);
end; $patch$;

-- Token é criado exclusivamente após a borda 1804 confirmar o rascunho e o recibo anterior.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean)'::regprocedure);
  a text:=$a$  if p_revisao_preparada then
    v_resultado:=pcm.sso_aprovar_revisao_mediada$a$;
  b text:=$b$  insert into pcm.sso_aprovacao_versao_tokens(txid,request_id,ator_id,cliente_id,plano_id,versao_id,revisao,vigencia)
    values(pg_catalog.txid_current(),p_request,p_ator,p_cliente,p_plano,p_versao,p_revisao,p_vigencia);
  if p_revisao_preparada then
    v_resultado:=pcm.sso_aprovar_revisao_mediada$b$;
  c text:=$c$  return v_resultado;$c$;
  e text:=$e$  delete from pcm.sso_aprovacao_versao_tokens where txid=pg_catalog.txid_current() and request_id=p_request;
  return v_resultado;$e$;
begin
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1
    or strpos(d,'sso_aprovacao_versao_tokens')>0 then raise exception 'aprovacao_versao_incompativel' using errcode='55000'; end if;
  execute replace(replace(d,a,b),c,e);
end; $patch$;
