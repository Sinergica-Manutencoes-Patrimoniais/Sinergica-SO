-- ADR-0259: aprovação de revisão no staging apenas, sem incorporação.
create table pcm.sso_cronograma_aprovacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_cronograma_aprovacao_gate enable row level security;
alter table pcm.sso_cronograma_aprovacao_gate force row level security;
revoke all on pcm.sso_cronograma_aprovacao_gate from public,anon,authenticated,service_role;
insert into pcm.sso_cronograma_aprovacao_gate(id,habilitado) values(true,false);
create table pcm.sso_cronograma_aprovacoes (
 id uuid primary key default gen_random_uuid(), lote_id uuid not null references pcm.sso_levantamentos(id),
 revisao_conferida integer not null check(revisao_conferida>0), revisao_aprovacao integer not null check(revisao_aprovacao>revisao_conferida),
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000), ator_id uuid not null references auth.users(id),
 criado_em timestamptz not null default now(), unique(lote_id,revisao_conferida),unique(lote_id,revisao_aprovacao)
);
alter table pcm.sso_cronograma_aprovacoes enable row level security;
alter table pcm.sso_cronograma_aprovacoes force row level security;
revoke all on pcm.sso_cronograma_aprovacoes from public,anon,authenticated,service_role;
create trigger sso_cronograma_aprovacao_imutavel before update or delete on pcm.sso_cronograma_aprovacoes for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_aprovar_lote_cronograma_staging(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_revision integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_lote pcm.sso_levantamentos%rowtype; v_cmd pcm.sso_levantamento_comandos%rowtype;
 v_payload jsonb; v_resultado jsonb; v_id uuid; v_linha record; v_mapeamento pcm.sso_cronograma_mapeamentos%rowtype;
 v_apos text:=null; v_cont integer; v_elegiveis integer:=0;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'aprovacao_cronograma_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'aprovacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','aprovarCronogramaStaging','clienteId',p_cliente_id,'loteId',p_lote_id,'expectedRevision',p_expected_revision,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then
  if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_cmd.resultado;
 end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 loop
  v_cont:=0;
  for v_linha in select * from pcm.sso_conferir_alvos_cronograma(p_cliente_id,p_lote_id,v_apos,100) loop
   v_cont:=v_cont+1; v_apos:=v_linha.chave;
   if cardinality(v_linha.pendencias)>0 then raise exception 'linha_com_pendencia' using errcode='23514'; end if;
   if v_linha.tipo_linha='dado' and v_linha.situacao is distinct from 'rejeitada' then
    if v_linha.situacao='em_revisao' then raise exception 'linha_em_revisao' using errcode='23514'; end if;
    select * into v_mapeamento from pcm.sso_cronograma_mapeamentos where id=v_linha.mapeamento_id;
    if not found then raise exception 'mapeamento_inexistente' using errcode='23514'; end if;
    if v_mapeamento.alvo_tipo='sistema' then perform 1 from pcm.sistemas where id=v_mapeamento.alvo_id and cliente_id=p_cliente_id and ativo and deleted_at is null for share;
    elsif v_mapeamento.alvo_tipo='componente' then perform 1 from pcm.equipamentos where id=v_mapeamento.alvo_id and client_id=p_cliente_id and ativo and deleted_at is null for share;
    elsif v_mapeamento.alvo_tipo='grupo' then perform 1 from pcm.grupos_quantitativos where id=v_mapeamento.alvo_id and cliente_id=p_cliente_id and ativo and deleted_at is null for share;
    else raise exception 'alvo_invalido' using errcode='23514'; end if;
    if not found then raise exception 'alvo_indisponivel' using errcode='23514'; end if;
    v_elegiveis:=v_elegiveis+1;
   end if;
  end loop;
  exit when v_cont<100;
 end loop;
 if v_elegiveis=0 then raise exception 'lote_sem_dados_elegiveis' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_cronograma_aprovacoes(lote_id,revisao_conferida,revisao_aprovacao,justificativa,ator_id) values(p_lote_id,p_expected_revision,v_lote.revisao,btrim(p_justificativa),v_actor) returning id into v_id;
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','aprovado_staging','aprovacaoId',v_id,'requestId',p_request_id,'linhasElegiveis',v_elegiveis);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.lote_aprovado_staging','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'aprovacaoId',v_id,'revision',v_lote.revisao,'linhasElegiveis',v_elegiveis));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_lote_cronograma_staging(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
