-- ADR-0246: histórico privado; sem apagar decisão histórica ou reverter cadastro.
create table pcm.sso_rejeicoes_reabertas(id uuid primary key default gen_random_uuid(),lote_id uuid not null,linha_chave text not null,
  rejeicao_revision integer not null,rejeicao_motivo text not null,rejeicao_ator uuid not null,rejeicao_request_id uuid not null unique,rejeicao_em timestamptz not null,
  reabertura_revision integer not null,ciclo integer not null,reabertura_motivo text not null,reabertura_ator uuid not null references auth.users(id),reabertura_request_id uuid not null unique,reabertura_em timestamptz not null default now(),
  foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_rejeicoes_reabertas enable row level security;alter table pcm.sso_rejeicoes_reabertas force row level security;
revoke all on pcm.sso_rejeicoes_reabertas from public,anon,authenticated,service_role;
create function pcm.sso_rejeicoes_reabertas_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514';end; $$;
revoke all on function pcm.sso_rejeicoes_reabertas_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_rejeicoes_reabertas_imutaveis before update or delete on pcm.sso_rejeicoes_reabertas for each row execute function pcm.sso_rejeicoes_reabertas_imutaveis();
create function pcm.sso_reabrir_rejeicao_linha(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_r pcm.sso_levantamento_rejeicoes%rowtype;v_hist pcm.sso_rejeicoes_reabertas%rowtype;v_ciclo integer;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_conferencia_lote_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reabertura-rejeicao:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_hist from pcm.sso_rejeicoes_reabertas where reabertura_request_id=p_request_id;
  if found then
    if v_hist.reabertura_ator is distinct from v_ator or v_hist.lote_id is distinct from p_lote_id or v_hist.linha_chave is distinct from p_chave or v_hist.reabertura_revision<>p_expected_revision+1 or v_hist.reabertura_motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_hist.reabertura_revision,'ciclo',v_hist.ciclo,'requestId',p_request_id);
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id) then raise exception 'lote_ja_incorporado' using errcode='23514'; end if;
  select * into v_r from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave for update;
  if not found then raise exception 'rejeicao_indisponivel' using errcode='23514'; end if;
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1)+1 into v_ciclo;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_rejeicoes_reabertas(lote_id,linha_chave,rejeicao_revision,rejeicao_motivo,rejeicao_ator,rejeicao_request_id,rejeicao_em,reabertura_revision,ciclo,reabertura_motivo,reabertura_ator,reabertura_request_id)
    values(p_lote_id,p_chave,v_r.revisao,v_r.motivo,v_r.ator_id,v_r.request_id,v_r.ocorrido_em,v_lote.revisao,v_ciclo,btrim(p_motivo),v_ator,p_request_id);
  delete from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave;
  insert into pcm.sso_conferencia_ciclos(lote_id,ciclo,ultima_reabertura_revision) values(p_lote_id,v_ciclo,v_lote.revisao) on conflict(lote_id) do update set ciclo=excluded.ciclo,ultima_reabertura_revision=excluded.ultima_reabertura_revision;
  insert into pcm.sso_conferencia_reaberturas(lote_id,ciclo,revisao,motivo,ator_id,request_id) values(p_lote_id,v_ciclo,v_lote.revisao,btrim(p_motivo),v_ator,gen_random_uuid());
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'ciclo',v_ciclo,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.rejeicao_reaberta','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id,'motivo',btrim(p_motivo),'rejeicaoRevision',v_r.revisao));return v_resultado;
end;
$$;
revoke all on function pcm.sso_reabrir_rejeicao_linha(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_historico_rejeicao_linha(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(rejeicao_revision integer,rejeicao_motivo text,rejeicao_ator uuid,rejeicao_em timestamptz,reabertura_revision integer,reabertura_motivo text,reabertura_ator uuid,reabertura_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select h.rejeicao_revision,h.rejeicao_motivo,h.rejeicao_ator,h.rejeicao_em,h.reabertura_revision,h.reabertura_motivo,h.reabertura_ator,h.reabertura_em
    from pcm.sso_rejeicoes_reabertas h where h.lote_id=p_lote_id and h.linha_chave=p_chave and (p_apos is null or h.reabertura_revision>p_apos) order by h.reabertura_revision limit p_limite;
end;
$$;
revoke all on function pcm.sso_historico_rejeicao_linha(uuid,text,integer,integer) from public,anon,authenticated,service_role;
