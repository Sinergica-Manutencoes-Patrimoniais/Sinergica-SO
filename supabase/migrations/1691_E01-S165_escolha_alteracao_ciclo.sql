-- ADR-1544: escolha específica de alteração de conteúdo, ainda sujeita à aprovação.
-- Não altera ocorrência, OS ou tarefa externa; 1045 permanece incondicional.
create table pcm.sso_escolhas_alteracao_ciclo (
 request_id uuid primary key, tipo text not null check(tipo in ('calendario','visita')),
 cliente_id uuid not null, plano_id uuid not null references pcm.planos_manutencao(id),
 rascunho_id uuid not null references pcm.plano_versoes(id), preparada_id uuid not null,
 rotina_id uuid not null, revisao_plano integer not null, ator_id uuid not null references auth.users(id),
 comparacao jsonb not null, payload jsonb not null, resultado jsonb not null,
 criado_em timestamptz not null default clock_timestamp()
);
alter table pcm.sso_escolhas_alteracao_ciclo enable row level security;
alter table pcm.sso_escolhas_alteracao_ciclo force row level security;
revoke all on pcm.sso_escolhas_alteracao_ciclo from public,anon,authenticated,service_role;
create trigger sso_escolhas_alteracao_ciclo_imutaveis before update or delete on pcm.sso_escolhas_alteracao_ciclo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- A escolha usa o mesmo comando comparado e request ID da decisão de reconciliação.
create function pcm.sso_escolher_alteracao_ciclo(
 p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,
 p_revisao_plano integer,p_revisao_decisao integer,p_tipo text,p_motivo text,p_comparacao jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_escolhas_alteracao_ciclo%rowtype;v_payload jsonb;v_foto jsonb;v_resultado jsonb;
 v_rotina uuid;v_antes jsonb;v_depois jsonb;v_campo text;
begin
 if p_request is null or p_tipo is null or p_tipo not in ('calendario','visita') or jsonb_typeof(p_comparacao) is distinct from 'object'
  or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,p_tipo='visita');
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-escolha-alteracao:'||p_request::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(case when p_tipo='visita' then 'decisao-impacto-visita:' else 'decisao-impacto:' end||p_request::text,0)) then raise exception 'decisao_em_andamento' using errcode='55P03';end if;
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'rascunho',p_rascunho,'preparada',p_preparada,'revisaoPlano',p_revisao_plano,'revisaoDecisao',p_revisao_decisao,'tipo',p_tipo,'motivo',btrim(p_motivo),'comparacao',p_comparacao);
 select * into v_ant from pcm.sso_escolhas_alteracao_ciclo where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 -- Não atribuir escolha nova a um recibo de decisão histórico.
 if exists(select 1 from pcm.sso_decisoes_impacto_ocorrencia where request_id=p_request
   union all select 1 from pcm.sso_decisoes_impacto_visita where request_id=p_request) then
  raise exception 'decisao_anterior_sem_escolha' using errcode='23514';end if;
 v_antes:=p_comparacao->'anterior';v_depois:=p_comparacao->'rascunho';
 if jsonb_typeof(v_antes) is distinct from 'object' or jsonb_typeof(v_depois) is distinct from 'object'
  or v_antes->>'modo' is distinct from p_tipo or v_depois->>'modo' is distinct from p_tipo
  or v_antes->>'alvo_tipo' is distinct from v_depois->>'alvo_tipo'
  or coalesce(v_antes->>'sistema_id',v_antes->>'equipamento_id',v_antes->>'grupo_id') is distinct from coalesce(v_depois->>'sistema_id',v_depois->>'equipamento_id',v_depois->>'grupo_id')
  or coalesce(v_depois->>'id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'identidade_ou_alvo_incompativel' using errcode='23514';end if;
 -- A presente fatia nunca tenta decidir equivalência de data após alteração de regra.
 foreach v_campo in array array['data_base','intervalo_n','intervalo_unidade'] loop
  if v_antes->v_campo is distinct from v_depois->v_campo then raise exception 'mudanca_regra_exige_reconciliacao' using errcode='23514';end if;
 end loop;
 v_rotina:=(v_depois->>'id')::uuid;
 -- A decisão e fotografia existentes serão escritas atomicamente; erro posterior reverte ambas.
 v_resultado:=pcm.sso_decidir_impacto_comparado(p_ator,p_request,p_cliente,p_plano,p_rascunho,p_preparada,p_revisao_plano,p_revisao_decisao,'exige_reconciliacao',p_motivo,p_tipo,p_comparacao);
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 if coalesce(jsonb_array_length(v_foto->'os'),0)>0 or coalesce(jsonb_array_length(v_foto->'grupo'),0)>0
  or coalesce(jsonb_array_length(v_foto->'intencoes'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)>0
  or coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)>0
  or jsonb_typeof(p_comparacao->'osImpacto') is distinct from 'array' or coalesce(jsonb_array_length(p_comparacao->'osImpacto'),0)>0
  or p_comparacao->>'osOutroCliente' is distinct from 'false'
  then raise exception 'execucao_ou_vinculo_exige_reconciliacao' using errcode='23514';end if;
 v_resultado:=v_resultado||jsonb_build_object('alteracaoEscolhida',true,'versaoOperacionalAplicada',false);
 insert into pcm.sso_escolhas_alteracao_ciclo values(p_request,p_tipo,p_cliente,p_plano,p_rascunho,p_preparada,v_rotina,p_revisao_plano,p_ator,p_comparacao,v_payload,v_resultado,clock_timestamp());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'plano.alteracao_ciclo_escolhida','planos_manutencao',p_plano,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_escolher_alteracao_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb) from public,anon,authenticated,service_role;
-- Comando acessível apenas ao usuário autenticado; autorização por Cliente é verificada no servidor.
grant execute on function pcm.sso_escolher_alteracao_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb) to authenticated;

-- Revalidação transacional: decisão ainda precisa ser a última e a foto permanecer igual.
create function pcm.sso_escolha_alteracao_atual(p_tipo text,p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_revisao integer)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_escolhas_alteracao_ciclo%rowtype;v_ultima uuid;v_foto jsonb;v_atual jsonb;
begin
 select * into v from pcm.sso_escolhas_alteracao_ciclo where request_id=p_request and tipo=p_tipo and cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and revisao_plano=p_revisao;
 if not found then return false;end if;
 if p_tipo='calendario' then
  select request_id into v_ultima from pcm.sso_decisoes_impacto_ocorrencia where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=v.preparada_id order by revisao desc limit 1;
 elsif p_tipo='visita' then
  select request_id into v_ultima from pcm.sso_decisoes_impacto_visita where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=v.preparada_id order by revisao desc limit 1;
 else return false;end if;
 if v_ultima is distinct from p_request then return false;end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_atual:=pcm.sso_comparar_rotina_impacto_v3(auth.uid(),p_cliente,p_plano,p_revisao,p_rascunho,v.preparada_id,p_tipo);
 if v_atual is distinct from v.comparacao then return false;end if;
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,v.preparada_id,p_tipo);
 return jsonb_typeof(v_atual->'osImpacto')='array' and jsonb_array_length(v_atual->'osImpacto')=0 and v_atual->>'osOutroCliente'='false'
  and coalesce(jsonb_array_length(v_foto->'os'),0)=0 and coalesce(jsonb_array_length(v_foto->'grupo'),0)=0
  and coalesce(jsonb_array_length(v_foto->'intencoes'),0)=0 and coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)=0
  and coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)=0;
end; $$;
revoke all on function pcm.sso_escolha_alteracao_atual(text,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

-- Não reduzir reconciliação enquanto a escolha não for a última e sua foto atual.
do $migracao$
declare v_assinatura text;v_tipo text;v_def text;v_antes text;v_depois text;
begin
 for v_assinatura,v_tipo in select * from (values
  ('pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)','calendario'),
  ('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)','visita')) t(assinatura,tipo)
 loop
  v_def:=pg_catalog.pg_get_functiondef(v_assinatura::regprocedure);
  v_antes:='and pcm.sso_escopo_impacto_retirado(rr.cliente_id,rr.plano_id,rr.rascunho_id,rr.preparada_id,rr.tipo)))';
  v_depois:='and pcm.sso_escopo_impacto_retirado(rr.cliente_id,rr.plano_id,rr.rascunho_id,rr.preparada_id,rr.tipo)) and not pcm.sso_escolha_alteracao_atual('||quote_literal(v_tipo)||',itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano))';
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_avaliacao_incompativel: %',v_assinatura using errcode='55000';end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;

-- Criação de selo apenas no mesmo token de aprovação e após reconferência.
create function pcm.sso_selar_alteracoes_ciclo_aprovadas() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;v_item record;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;if not found then return new;end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null or (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514';end if;
 for v_item in select e.* from pcm.sso_escolhas_alteracao_ciclo e where e.cliente_id=v_plano.cliente_id and e.plano_id=new.plano_id and e.rascunho_id=v_rascunho and e.revisao_plano=v_plano.revisao loop
  -- Escolhas substituídas por outra decisão não são seladas.
  if pcm.sso_escolha_alteracao_atual(v_item.tipo,v_item.request_id,v_item.cliente_id,v_item.plano_id,v_item.rascunho_id,v_item.revisao_plano) then
   if (v_item.comparacao->>'vencimentoOriginal')::date<new.vigencia_inicio then raise exception 'alteracao_anterior_vigencia' using errcode='23514';end if;
   insert into pcm.sso_versoes_operacionais_ciclo(tipo,cliente_id,plano_id,preparada_id,versao_id,rotina_id,vigencia,decisao_request_id)
   values(v_item.tipo,v_item.cliente_id,v_item.plano_id,v_item.preparada_id,v_item.rascunho_id,v_item.rotina_id,new.vigencia_inicio,v_item.request_id);
  end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_selar_alteracoes_ciclo_aprovadas() from public,anon,authenticated,service_role;
create trigger sso_selar_alteracoes_ciclo_aprovadas after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_selar_alteracoes_ciclo_aprovadas();

-- Continuidade da mesma ocorrência selecionada: o caminho histórico permanece preservado.
alter function pcm.sso_continuidade_ciclo_autorizada(uuid,uuid,uuid,uuid,uuid,date) rename to sso_continuidade_ciclo_anterior_1691;
revoke all on function pcm.sso_continuidade_ciclo_anterior_1691(uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
create function pcm.sso_continuidade_ciclo_autorizada(p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_preparada uuid,p_vencimento date)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;
begin
 if pcm.sso_continuidade_ciclo_anterior_1691(p_cliente,p_plano,p_versao,p_rotina,p_preparada,p_vencimento) then return true;end if;
 if not exists(select 1 from pcm.sso_continuidade_revisao_gate where id and habilitado) then return false;end if;
 if not exists(select 1 from pcm.ocorrencias_rotina_preparadas where id=p_preparada and plano_id=p_plano and vencimento_original=p_vencimento)
  or not exists(select 1 from pcm.sso_versoes_operacionais_ciclo where tipo='calendario' and cliente_id=p_cliente and plano_id=p_plano and preparada_id=p_preparada and versao_id=p_versao and rotina_id=p_rotina) then return false;end if;
 v:=pcm.sso_versao_operacional_ciclo(p_cliente,p_plano,p_preparada,'calendario');
 return v->>'versaoId'=p_versao::text and v->>'rotinaId'=p_rotina::text;
end; $$;
revoke all on function pcm.sso_continuidade_ciclo_autorizada(uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;

alter function pcm.sso_continuidade_visita_autorizada(uuid,uuid,uuid,uuid,uuid,uuid,date) rename to sso_continuidade_visita_anterior_1691;
revoke all on function pcm.sso_continuidade_visita_anterior_1691(uuid,uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
create function pcm.sso_continuidade_visita_autorizada(p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_preparada uuid,p_visita uuid,p_vencimento date)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;
begin
 if pcm.sso_continuidade_visita_anterior_1691(p_cliente,p_plano,p_versao,p_rotina,p_preparada,p_visita,p_vencimento) then return true;end if;
 if not exists(select 1 from pcm.sso_continuidade_revisao_gate where id and habilitado) then return false;end if;
 if not exists(select 1 from pcm.ocorrencias_visita_preparadas where id=p_preparada and plano_id=p_plano and visita_id=p_visita and vencimento_original=p_vencimento)
  or not exists(select 1 from pcm.sso_versoes_operacionais_ciclo where tipo='visita' and cliente_id=p_cliente and plano_id=p_plano and preparada_id=p_preparada and versao_id=p_versao and rotina_id=p_rotina) then return false;end if;
 v:=pcm.sso_versao_operacional_ciclo(p_cliente,p_plano,p_preparada,'visita');
 return v->>'versaoId'=p_versao::text and v->>'rotinaId'=p_rotina::text;
end; $$;
revoke all on function pcm.sso_continuidade_visita_autorizada(uuid,uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
