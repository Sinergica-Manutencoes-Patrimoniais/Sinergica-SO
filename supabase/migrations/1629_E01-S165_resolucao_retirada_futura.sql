-- ADR-1486: resolução humana não altera ocorrência ou OS antes da aprovação.
create table pcm.sso_resolucoes_impacto_revisao(
 request_id uuid primary key,tipo text not null check(tipo in ('calendario','visita')),
 cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),rascunho_id uuid not null references pcm.plano_versoes(id),
 preparada_id uuid not null,decisao_request_id uuid not null,revisao_plano integer not null,revisao_decisao integer not null,
 motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
 unique(tipo,decisao_request_id)
);
alter table pcm.sso_resolucoes_impacto_revisao enable row level security;
alter table pcm.sso_resolucoes_impacto_revisao force row level security;
revoke all on pcm.sso_resolucoes_impacto_revisao from public,anon,authenticated,service_role;
create trigger sso_resolucao_impacto_imutavel before update or delete on pcm.sso_resolucoes_impacto_revisao for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_resolver_impacto_retirada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_tipo text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb;v_resultado jsonb;v_ant pcm.sso_resolucoes_impacto_revisao%rowtype;v_decisao uuid;v_rev integer;v_rev_plano integer;v_estado text;v_previa jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if p_request_id is null or p_tipo is null or p_tipo not in ('calendario','visita') or p_rascunho_id is null or p_preparada_id is null or p_expected_plano is null or p_expected_plano<1 or p_expected_decisao is null or p_expected_decisao<1 or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,p_tipo='visita');
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-resolucao-impacto:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'rascunhoId',p_rascunho_id,'preparadaId',p_preparada_id,'revisaoPlano',p_expected_plano,'revisaoDecisao',p_expected_decisao,'tipo',p_tipo,'motivo',v_motivo);
 select * into v_ant from pcm.sso_resolucoes_impacto_revisao where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for update nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);
 if v_previa->>'versaoRascunhoId' is distinct from p_rascunho_id::text then raise exception 'rascunho_indisponivel' using errcode='23514'; end if;
 if p_tipo='calendario' then
  select d.request_id,d.revisao,d.revisao_plano,d.decisao into v_decisao,v_rev,v_rev_plano,v_estado from pcm.sso_decisoes_impacto_ocorrencia d where d.cliente_id=p_cliente_id and d.plano_id=p_plano_id and d.rascunho_id=p_rascunho_id and d.preparada_id=p_preparada_id order by d.revisao desc limit 1;
 else
  select d.request_id,d.revisao,d.revisao_plano,d.decisao into v_decisao,v_rev,v_rev_plano,v_estado from pcm.sso_decisoes_impacto_visita d where d.cliente_id=p_cliente_id and d.plano_id=p_plano_id and d.rascunho_id=p_rascunho_id and d.preparada_id=p_preparada_id order by d.revisao desc limit 1;
 end if;
 if v_decisao is null or v_rev is distinct from p_expected_decisao or v_rev_plano is distinct from p_expected_plano or v_estado is distinct from 'exige_reconciliacao' then raise exception 'decisao_obsoleta_ou_incompativel' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_impacto_grupo_fotografias f where f.tipo=p_tipo and f.request_id=v_decisao and f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.preparada_id=p_preparada_id) then raise exception 'fotografia_ausente' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or (p_tipo='visita' and config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'revisaoPlano',p_expected_plano,'revisaoDecisao',p_expected_decisao,'decisao','retirar_geracao','resolucaoRegistrada',true,'aprovacaoAutorizada',false,'ocorrenciaAlterada',false,'osAlteradas',false);
 insert into pcm.sso_resolucoes_impacto_revisao(request_id,tipo,cliente_id,plano_id,rascunho_id,preparada_id,decisao_request_id,revisao_plano,revisao_decisao,motivo,ator_id,payload,resultado) values(p_request_id,p_tipo,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,v_decisao,p_expected_plano,p_expected_decisao,v_motivo,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'plano.impacto_retirada_resolvido','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_impacto_retirada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_impacto_retirada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) to authenticated;

create function pcm.sso_consultar_resolucao_impacto(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_decisao uuid;v_resolucao pcm.sso_resolucoes_impacto_revisao%rowtype;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_expected_decisao is null or p_expected_decisao<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,p_tipo='visita');
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if p_tipo='calendario' then select request_id into v_decisao from pcm.sso_decisoes_impacto_ocorrencia where cliente_id=p_cliente_id and plano_id=p_plano_id and rascunho_id=p_rascunho_id and preparada_id=p_preparada_id and revisao=p_expected_decisao;
 else select request_id into v_decisao from pcm.sso_decisoes_impacto_visita where cliente_id=p_cliente_id and plano_id=p_plano_id and rascunho_id=p_rascunho_id and preparada_id=p_preparada_id and revisao=p_expected_decisao; end if;
 if v_decisao is null then raise exception 'decisao_indisponivel' using errcode='23514'; end if;
 select * into v_resolucao from pcm.sso_resolucoes_impacto_revisao where tipo=p_tipo and decisao_request_id=v_decisao and cliente_id=p_cliente_id and plano_id=p_plano_id;
 return jsonb_build_object('preparadaId',p_preparada_id,'revisaoDecisao',p_expected_decisao,'resolvida',v_resolucao.request_id is not null,'motivo',v_resolucao.motivo);
end; $$;
revoke all on function pcm.sso_consultar_resolucao_impacto(uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_resolucao_impacto(uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;

-- Somente decisão específica resolvida deixa de contar como reconciliação pendente.
do $migracao$
declare v_item record;v_def text;v_antes text:=$antes$count(*) filter(where decisao='exige_reconciliacao')$antes$;v_depois text;
begin
 for v_item in select * from (values ('pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)','calendario'),('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)','visita')) t(assinatura,tipo) loop
  v_def:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  v_depois:=$depois$count(*) filter(where decisao='exige_reconciliacao' and not exists(select 1 from pcm.sso_resolucoes_impacto_revisao rr where rr.tipo='$depois$||v_item.tipo||$depois$' and rr.decisao_request_id=itens.request_id and rr.cliente_id=p_cliente_id and rr.plano_id=p_plano_id and rr.rascunho_id=v_rascunho))$depois$;
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_avaliacao_incompativel: %',v_item.assinatura using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;

create table pcm.sso_retiradas_impacto_aprovadas(tipo text not null check(tipo in ('calendario','visita')),versao_id uuid not null references pcm.plano_versoes(id),preparada_id uuid not null,resolucao_request_id uuid not null references pcm.sso_resolucoes_impacto_revisao(request_id),vigencia date not null,primary key(tipo,versao_id,preparada_id));
alter table pcm.sso_retiradas_impacto_aprovadas enable row level security;
alter table pcm.sso_retiradas_impacto_aprovadas force row level security;
revoke all on pcm.sso_retiradas_impacto_aprovadas from public,anon,authenticated,service_role;
create trigger sso_retiradas_impacto_imutaveis before update or delete on pcm.sso_retiradas_impacto_aprovadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_retiradas_aprovadas() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rascunho uuid;v_previa jsonb;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return new; end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_resolucoes_impacto_revisao rr join pcm.ocorrencias_rotina_preparadas o on rr.tipo='calendario' and o.id=rr.preparada_id where rr.rascunho_id=v_rascunho and rr.revisao_plano=v_plano.revisao and o.vencimento_original<new.vigencia_inicio and rr.decisao_request_id=(select d.request_id from pcm.sso_decisoes_impacto_ocorrencia d where d.rascunho_id=v_rascunho and d.preparada_id=o.id order by d.revisao desc limit 1))
  or exists(select 1 from pcm.sso_resolucoes_impacto_revisao rr join pcm.ocorrencias_visita_preparadas o on rr.tipo='visita' and o.id=rr.preparada_id where rr.rascunho_id=v_rascunho and rr.revisao_plano=v_plano.revisao and o.vencimento_original<new.vigencia_inicio and rr.decisao_request_id=(select d.request_id from pcm.sso_decisoes_impacto_visita d where d.rascunho_id=v_rascunho and d.preparada_id=o.id order by d.revisao desc limit 1)) then raise exception 'retirada_anterior_vigencia' using errcode='23514'; end if;
 insert into pcm.sso_retiradas_impacto_aprovadas(tipo,versao_id,preparada_id,resolucao_request_id,vigencia)
 select rr.tipo,v_rascunho,rr.preparada_id,rr.request_id,new.vigencia_inicio from pcm.sso_resolucoes_impacto_revisao rr
 where rr.rascunho_id=v_rascunho and rr.cliente_id=v_plano.cliente_id and rr.plano_id=new.plano_id and rr.revisao_plano=v_plano.revisao
  and ((rr.tipo='calendario' and rr.decisao_request_id=(select d.request_id from pcm.sso_decisoes_impacto_ocorrencia d where d.rascunho_id=v_rascunho and d.preparada_id=rr.preparada_id order by d.revisao desc limit 1))
    or (rr.tipo='visita' and rr.decisao_request_id=(select d.request_id from pcm.sso_decisoes_impacto_visita d where d.rascunho_id=v_rascunho and d.preparada_id=rr.preparada_id order by d.revisao desc limit 1)));
 return new;
end; $$;
revoke all on function pcm.sso_registrar_retiradas_aprovadas() from public,anon,authenticated,service_role;
create trigger sso_retiradas_na_aprovacao after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_registrar_retiradas_aprovadas();
