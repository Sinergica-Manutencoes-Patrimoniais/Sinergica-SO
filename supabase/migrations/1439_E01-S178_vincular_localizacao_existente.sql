-- ADR-1292: vínculo explícito, sem atualização do cadastro oficial.
create table pcm.sso_vincular_localizacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_vincular_localizacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_vincular_localizacao_gate enable row level security;
alter table pcm.sso_vincular_localizacao_gate force row level security;
revoke all on pcm.sso_vincular_localizacao_gate from public,anon,authenticated,service_role;

create function pcm.sso_vincular_localizacao_existente(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare l pcm.sso_levantamentos%rowtype; linha pcm.sso_levantamento_linhas%rowtype; cmd pcm.sso_levantamento_comandos%rowtype;
  pai_tipo text; pai_id uuid; referencia text; atual jsonb; payload jsonb; resultado jsonb; ator uuid:=auth.uid();
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200
    or p_entidade_id is null or jsonb_typeof(p_snapshot) is distinct from 'object' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_vincular_localizacao_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
  payload:=jsonb_build_object('operacao','vincular_localizacao','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'entidadeId',p_entidade_id,'snapshot',p_snapshot,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into l from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',l.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
  if found then if cmd.ator_id is distinct from ator or cmd.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return cmd.resultado; end if;
  if l.revisao is distinct from p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
  if not found or linha.tipo not in ('area','local','sublocal') or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave)
    or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave)
    or exists(select 1 from pcm.sso_atualizacoes_localizacao where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  if jsonb_typeof(linha.atributos->'nome') is distinct from 'string' or length(btrim(linha.atributos->>'nome')) not between 1 and 200
    or exists(select 1 from jsonb_each(linha.atributos) x where x.key not in ('nome','referenciaPai') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) then raise exception 'atributos_nao_suportados' using errcode='23514'; end if;
  if linha.tipo='area' then perform 1 from pcm.areas where id=p_entidade_id and cliente_id=l.cliente_id for share;
  else perform 1 from pcm.locais x join pcm.areas a on a.id=x.area_id where x.id=p_entidade_id and a.cliente_id=l.cliente_id for share of x,a; end if;
  if not found then raise exception 'localizacao_indisponivel' using errcode='42501'; end if;
  atual:=pcm.sso_snapshot_localizacao_levantamento(l.cliente_id,linha.tipo,p_entidade_id);
  if atual is distinct from p_snapshot or btrim(linha.atributos->>'nome') is distinct from atual->>'nome' then raise exception 'cadastro_ou_nome_divergente' using errcode='40001'; end if;
  referencia:=nullif(btrim(linha.atributos->>'referenciaPai'),'');
  if linha.tipo='area' and referencia is not null then raise exception 'pai_invalido' using errcode='23514'; end if;
  if linha.tipo<>'area' then
    select i.tipo,i.entidade_id into pai_tipo,pai_id from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=referencia;
    if not found then select a.tipo,a.entidade_id into pai_tipo,pai_id from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=referencia; end if;
    if not found or (linha.tipo='local' and (pai_tipo<>'area' or pai_id::text is distinct from atual->>'areaId'))
      or (linha.tipo='sublocal' and (pai_tipo not in ('local','sublocal') or pai_id::text is distinct from atual->>'parentId')) then raise exception 'pai_pendente_ou_divergente' using errcode='23514'; end if;
  end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into l;
  insert into pcm.sso_levantamento_incorporacoes(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values(p_lote_id,p_chave,linha.tipo,p_entidade_id,l.revisao,ator,p_request_id);
  resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',l.revisao,'state','pendente','created',false,'linkedIds',jsonb_build_object('entidadeId',p_entidade_id,'tipo',linha.tipo),'warnings',jsonb_build_array('localizacao_nao_alterada'),'requestId',p_request_id);
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,ator,payload,resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(ator,'levantamento.localizacao_vinculada','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',l.cliente_id,'linhaChave',p_chave,'entidadeId',p_entidade_id,'tipo',linha.tipo,'motivo',btrim(p_motivo),'revision',l.revisao));
  return resultado;
end; $$;
revoke all on function pcm.sso_vincular_localizacao_existente(uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_localizacao_existente(uuid,uuid,integer,text,uuid,jsonb,text) to authenticated;

create or replace function pcm.sso_decisao_linha_autorizada(p_lote_id uuid,p_chave text)
returns table(decisao text,revisao integer,motivo text,tipo text,entidade_id uuid,ator_id uuid,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return query select case when d.decisao='incorporada' and exists(select 1 from pcm.sso_levantamento_incorporacoes i join pcm.sso_levantamento_comandos c on c.request_id=i.request_id where i.lote_id=p_lote_id and i.linha_chave=p_chave and i.revisao=d.revisao and c.payload->>'operacao' in ('vincular_ativo','vincular_localizacao')) then 'vinculada'::text else d.decisao end,
 d.revisao,d.motivo,d.tipo,d.entidade_id,d.ator_id,d.ocorrido_em from pcm.sso_consultar_decisao_linha_levantamento(p_lote_id,p_chave) d;
end; $$;
