-- ADR-1558: escolha explícita de novo ciclo de calendário. 1045 permanece ativa.
create table pcm.sso_escolhas_nova_data_calendario (
 request_id uuid primary key, cliente_id uuid not null, plano_id uuid not null references pcm.planos_manutencao(id),
 rascunho_id uuid not null references pcm.plano_versoes(id), preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),
 rotina_id uuid not null, indice_novo integer not null check(indice_novo>=0), vencimento_novo date not null,
 revisao_plano integer not null, ator_id uuid not null references auth.users(id), comparacao jsonb not null,
 payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default clock_timestamp()
);
alter table pcm.sso_escolhas_nova_data_calendario enable row level security;
alter table pcm.sso_escolhas_nova_data_calendario force row level security;
revoke all on pcm.sso_escolhas_nova_data_calendario from public,anon,authenticated,service_role;
create trigger sso_escolhas_nova_data_imutaveis before update or delete on pcm.sso_escolhas_nova_data_calendario for each row execute function pcm.sso_proteger_conferencia_levantamento();
create table pcm.sso_substituicoes_calendario_aprovadas (
 versao_id uuid not null references pcm.plano_versoes(id), preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),
 escolha_request_id uuid not null references pcm.sso_escolhas_nova_data_calendario(request_id), vigencia date not null,
 rotina_id uuid not null, indice_novo integer not null, vencimento_novo date not null, primary key(versao_id,preparada_id),
 unique(versao_id,rotina_id,vencimento_novo)
);
alter table pcm.sso_substituicoes_calendario_aprovadas enable row level security;
alter table pcm.sso_substituicoes_calendario_aprovadas force row level security;
revoke all on pcm.sso_substituicoes_calendario_aprovadas from public,anon,authenticated,service_role;
create trigger sso_substituicoes_calendario_imutaveis before update or delete on pcm.sso_substituicoes_calendario_aprovadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_escolher_nova_data_calendario(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao_plano integer,p_revisao_decisao integer,p_indice_novo integer,p_data_confirmada date,p_motivo text,p_comparacao jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_escolhas_nova_data_calendario%rowtype;v_payload jsonb;v_nova jsonb;v_anterior jsonb;v_data date;v_rotina uuid;v_foto jsonb;v_resultado jsonb;
begin
 if p_request is null or p_indice_novo is null or p_indice_novo<0 or p_indice_novo>3660000 or p_data_confirmada is null or not isfinite(p_data_confirmada) or jsonb_typeof(p_comparacao) is distinct from 'object' or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,false);
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('decisao-impacto:'||p_request::text,0)) then raise exception 'decisao_em_andamento' using errcode='55P03';end if;
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'rascunho',p_rascunho,'preparada',p_preparada,'revisaoPlano',p_revisao_plano,'revisaoDecisao',p_revisao_decisao,'indiceNovo',p_indice_novo,'dataConfirmada',p_data_confirmada,'motivo',btrim(p_motivo),'comparacao',p_comparacao);
 select * into v_ant from pcm.sso_escolhas_nova_data_calendario where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 if exists(select 1 from pcm.sso_decisoes_impacto_ocorrencia where request_id=p_request union all select 1 from pcm.sso_decisoes_impacto_visita where request_id=p_request) then raise exception 'decisao_anterior_sem_escolha' using errcode='23514';end if;
 v_anterior:=p_comparacao->'anterior';v_nova:=p_comparacao->'rascunho';
 if jsonb_typeof(v_anterior) is distinct from 'object' or jsonb_typeof(v_nova) is distinct from 'object' or v_anterior->>'modo' is distinct from 'calendario' or v_nova->>'modo' is distinct from 'calendario'
  or v_anterior->>'alvo_tipo' is distinct from v_nova->>'alvo_tipo' or coalesce(v_anterior->>'sistema_id',v_anterior->>'equipamento_id',v_anterior->>'grupo_id') is distinct from coalesce(v_nova->>'sistema_id',v_nova->>'equipamento_id',v_nova->>'grupo_id') then raise exception 'identidade_ou_alvo_incompativel' using errcode='23514';end if;
 v_rotina:=(v_nova->>'id')::uuid;
 v_data:=pcm.sso_vencimento_ciclo_calendario((v_nova->>'data_base')::date,(v_nova->>'intervalo_n')::integer,v_nova->>'intervalo_unidade',p_indice_novo);
 if v_data is null or v_data is distinct from p_data_confirmada or v_data is not distinct from (p_comparacao->>'vencimentoOriginal')::date then raise exception 'nova_data_invalida' using errcode='23514';end if;
 v_resultado:=pcm.sso_decidir_impacto_comparado(p_ator,p_request,p_cliente,p_plano,p_rascunho,p_preparada,p_revisao_plano,p_revisao_decisao,'exige_reconciliacao',p_motivo,'calendario',p_comparacao);
 -- Somente escolhas ainda vigentes reservam o candidato; o histórico não impede nova decisão.
 if exists(select 1 from pcm.sso_escolhas_nova_data_calendario e
   join lateral (select d.request_id from pcm.sso_decisoes_impacto_ocorrencia d where d.cliente_id=e.cliente_id and d.plano_id=e.plano_id and d.rascunho_id=e.rascunho_id and d.preparada_id=e.preparada_id order by d.revisao desc limit 1) ultima on ultima.request_id=e.request_id
   where e.cliente_id=p_cliente and e.plano_id=p_plano and e.rascunho_id=p_rascunho and e.revisao_plano=p_revisao_plano and e.rotina_id=v_rotina and e.vencimento_novo=v_data and e.preparada_id<>p_preparada) then raise exception 'candidato_ja_escolhido' using errcode='23505';end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 if exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano and o.rotina_logica_id=(p_comparacao->>'rotinaLogicaId')::uuid and o.alvo_tipo=p_comparacao->>'alvoOcorrenciaTipo' and o.alvo_id=(p_comparacao->>'alvoOcorrenciaId')::uuid and o.vencimento_original=v_data) then raise exception 'candidato_existente_exige_reconciliacao' using errcode='23514';end if;
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,'calendario');
 if jsonb_typeof(p_comparacao->'osImpacto') is distinct from 'array' or jsonb_array_length(p_comparacao->'osImpacto')>0 or p_comparacao->>'osOutroCliente' is distinct from 'false'
  or coalesce(jsonb_array_length(v_foto->'os'),0)>0 or coalesce(jsonb_array_length(v_foto->'grupo'),0)>0 or coalesce(jsonb_array_length(v_foto->'intencoes'),0)>0
  or coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)>0 then raise exception 'execucao_ou_vinculo_exige_reconciliacao' using errcode='23514';end if;
 v_resultado:=v_resultado||jsonb_build_object('novaDataEscolhida',v_data,'indiceNovo',p_indice_novo,'substituicaoAplicada',false);
 insert into pcm.sso_escolhas_nova_data_calendario values(p_request,p_cliente,p_plano,p_rascunho,p_preparada,v_rotina,p_indice_novo,v_data,p_revisao_plano,p_ator,p_comparacao,v_payload,v_resultado,clock_timestamp());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'plano.nova_data_escolhida','planos_manutencao',p_plano,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_escolher_nova_data_calendario(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,date,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_escolher_nova_data_calendario(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,date,text,jsonb) to authenticated;

create function pcm.sso_escolha_nova_data_calendario_atual(p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_revisao integer)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_escolhas_nova_data_calendario%rowtype;v_ultima uuid;v_foto jsonb;v_atual jsonb;
begin
 select * into v from pcm.sso_escolhas_nova_data_calendario where request_id=p_request and cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and revisao_plano=p_revisao;
 if not found then return false;end if;
 select request_id into v_ultima from pcm.sso_decisoes_impacto_ocorrencia where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=v.preparada_id order by revisao desc limit 1;
 if v_ultima is distinct from p_request then return false;end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_atual:=pcm.sso_comparar_rotina_impacto_v3(auth.uid(),p_cliente,p_plano,p_revisao,p_rascunho,v.preparada_id,'calendario');
 if v_atual is distinct from v.comparacao then return false;end if;
 if exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano and o.rotina_logica_id=(v.comparacao->>'rotinaLogicaId')::uuid and o.alvo_tipo=v.comparacao->>'alvoOcorrenciaTipo' and o.alvo_id=(v.comparacao->>'alvoOcorrenciaId')::uuid and o.vencimento_original=v.vencimento_novo) then return false;end if;
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,v.preparada_id,'calendario');
 return jsonb_typeof(v_atual->'osImpacto')='array' and jsonb_array_length(v_atual->'osImpacto')=0 and v_atual->>'osOutroCliente'='false'
  and coalesce(jsonb_array_length(v_foto->'os'),0)=0 and coalesce(jsonb_array_length(v_foto->'grupo'),0)=0 and coalesce(jsonb_array_length(v_foto->'intencoes'),0)=0
  and coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)=0 and coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)=0;
end; $$;
revoke all on function pcm.sso_escolha_nova_data_calendario_atual(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)'::regprocedure);
 a text:=$antes$and not pcm.sso_escolha_alteracao_atual('calendario',itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano))$antes$;
 b text:=$depois$and not pcm.sso_escolha_alteracao_atual('calendario',itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano) and not pcm.sso_escolha_nova_data_calendario_atual(itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano))$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_avaliacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

create function pcm.sso_selar_nova_data_calendario() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;v_item record;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;if not found then return new;end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null or (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514';end if;
 for v_item in select e.* from pcm.sso_escolhas_nova_data_calendario e where e.cliente_id=v_plano.cliente_id and e.plano_id=new.plano_id and e.rascunho_id=v_rascunho and e.revisao_plano=v_plano.revisao loop
  if pcm.sso_escolha_nova_data_calendario_atual(v_item.request_id,v_item.cliente_id,v_item.plano_id,v_item.rascunho_id,v_item.revisao_plano) then
   if (v_item.comparacao->>'vencimentoOriginal')::date<new.vigencia_inicio or v_item.vencimento_novo<new.vigencia_inicio then raise exception 'substituicao_anterior_vigencia' using errcode='23514';end if;
   insert into pcm.sso_substituicoes_calendario_aprovadas values(v_item.rascunho_id,v_item.preparada_id,v_item.request_id,new.vigencia_inicio,v_item.rotina_id,v_item.indice_novo,v_item.vencimento_novo);
  end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_selar_nova_data_calendario() from public,anon,authenticated,service_role;
create trigger sso_selar_nova_data_calendario after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_selar_nova_data_calendario();

-- O mesmo comando explícito 1674 trata a antiga entrada aguardando, sem tocar OS.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid)'::regprocedure);
 a text:=$antes$join pcm.sso_retiradas_impacto_aprovadas s on s.tipo='calendario' and s.preparada_id=o.id$antes$;
 b text:=$depois$join (select tipo,versao_id,preparada_id,resolucao_request_id,vigencia from pcm.sso_retiradas_impacto_aprovadas union all select 'calendario'::text,versao_id,preparada_id,escolha_request_id,vigencia from pcm.sso_substituicoes_calendario_aprovadas) s on s.tipo='calendario' and s.preparada_id=o.id$depois$;
 c text:='pcm.plano_versoes,pcm.sso_retiradas_impacto_aprovadas,pcm.ocorrencias_rotina_preparadas';
 e text:='pcm.plano_versoes,pcm.sso_retiradas_impacto_aprovadas,pcm.sso_substituicoes_calendario_aprovadas,pcm.ocorrencias_rotina_preparadas';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1 then raise exception 'definicao_fila_incompativel' using errcode='55000';end if;
 execute replace(replace(d,a,b),c,e);
end; $migracao$;

-- Vínculo auditável surge apenas quando o candidato explicitamente escolhido é materializado.
create table pcm.sso_substituicoes_calendario_materializadas (
 escolha_request_id uuid primary key references pcm.sso_escolhas_nova_data_calendario(request_id),
 preparada_antiga_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),
 preparada_nova_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),
 ciclo_novo_id uuid not null references pcm.sso_ciclos_calendario_canonicos(id), versao_id uuid not null references pcm.plano_versoes(id),
 criado_em timestamptz not null default clock_timestamp(), unique(preparada_nova_id), check(preparada_antiga_id<>preparada_nova_id)
);
alter table pcm.sso_substituicoes_calendario_materializadas enable row level security;
alter table pcm.sso_substituicoes_calendario_materializadas force row level security;
revoke all on pcm.sso_substituicoes_calendario_materializadas from public,anon,authenticated,service_role;
create trigger sso_substituicoes_calendario_materializadas_imutaveis before update or delete on pcm.sso_substituicoes_calendario_materializadas for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_vincular_nova_data_calendario() returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record;v_foto jsonb;v_cliente uuid;
begin
 for v_item in
  select s.*,p.cliente_id from pcm.sso_substituicoes_calendario_aprovadas s
  join pcm.plano_versoes v on v.id=s.versao_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
  join pcm.planos_manutencao p on p.id=v.plano_id
  join pcm.ocorrencias_rotina_preparadas o on o.id=new.preparada_id and o.plano_id=v.plano_id
  join pcm.sso_ciclos_calendario_canonicos c on c.id=new.ciclo_id and c.indice=s.indice_novo and c.vencimento_original=s.vencimento_novo
  where s.versao_id=new.versao_id and s.rotina_id=new.rotina_id and o.vencimento_original=s.vencimento_novo
 loop
  if v_item.vigencia>pcm.sso_data_civil_transicao_plano((select plano_id from pcm.plano_versoes where id=v_item.versao_id),v_item.versao_id,v_item.vigencia) then raise exception 'substituicao_ainda_nao_vigente' using errcode='23514';end if;
  if v_item.preparada_id=new.preparada_id then raise exception 'substituicao_reutilizou_ocorrencia' using errcode='23514';end if;
  lock table pcm.sso_fila_preventiva_pcm,pcm.ocorrencias_rotina_vinculos,pcm.ocorrencias_preventivas,pcm.planos_preventivos in share mode nowait;
  perform pcm.sso_travar_fontes_impacto_grupo();
  if exists(select 1 from pcm.sso_fila_preventiva_pcm f where f.estado<>'cancelado' and (f.preparada_id=v_item.preparada_id or f.ciclo_id in (select ciclo_id from pcm.sso_ciclo_calendario_versoes where preparada_id=v_item.preparada_id))) then raise exception 'fila_anterior_exige_reconciliacao' using errcode='23514';end if;
  if exists(select 1 from pcm.ocorrencias_rotina_vinculos ponte join pcm.ocorrencias_preventivas leg on leg.id=ponte.ocorrencia_legada_id
    where (ponte.ocorrencia_preparada_id=v_item.preparada_id or ponte.ocorrencia_preparada_id in (select outra.preparada_id from pcm.sso_ciclo_calendario_versoes atual join pcm.sso_ciclo_calendario_versoes outra on outra.ciclo_id=atual.ciclo_id where atual.preparada_id=v_item.preparada_id))
     and (leg.envio_estado is distinct from 'prevista' or leg.auvo_task_id is not null or leg.resultado_estado is distinct from 'pendente' or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=leg.id))) then raise exception 'execucao_anterior_exige_reconciliacao' using errcode='23514';end if;
  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(v_item.cliente_id,(select plano_id from pcm.plano_versoes where id=v_item.versao_id),v_item.preparada_id,'calendario');
  if coalesce(jsonb_array_length(v_foto->'os'),0)>0 or coalesce(jsonb_array_length(v_foto->'grupo'),0)>0 or coalesce(jsonb_array_length(v_foto->'intencoes'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)>0 then raise exception 'execucao_anterior_exige_reconciliacao' using errcode='23514';end if;
  insert into pcm.sso_substituicoes_calendario_materializadas(escolha_request_id,preparada_antiga_id,preparada_nova_id,ciclo_novo_id,versao_id)
   values(v_item.escolha_request_id,v_item.preparada_id,new.preparada_id,new.ciclo_id,new.versao_id);
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_vincular_nova_data_calendario() from public,anon,authenticated,service_role;
create trigger sso_vincular_nova_data_calendario after insert on pcm.sso_ciclo_canonico_usos_versao for each row execute function pcm.sso_vincular_nova_data_calendario();

-- Prévia sem efeitos a partir da comparação que o PCM conferiu, em janela explícita.
create function pcm.sso_prever_novas_datas_calendario(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao integer,p_inicio date,p_fim date,p_comparacao jsonb)
returns table(indice integer,vencimento date) language plpgsql volatile security definer set search_path='' as $$
declare v_nova jsonb;v_base date;v_passo integer;v_unidade text;v_indice integer;v_meses integer;v_iter integer:=0;
begin
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_inicio<date '0001-01-01' or p_fim>date '9999-12-31' or p_fim<p_inicio or p_fim-p_inicio>89 then raise exception 'janela_invalida' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,false);
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao for share nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if pcm.sso_comparar_rotina_impacto_v3(p_ator,p_cliente,p_plano,p_revisao,p_rascunho,p_preparada,'calendario') is distinct from p_comparacao then raise exception 'comparacao_obsoleta' using errcode='40001';end if;
 v_nova:=p_comparacao->'rascunho';
 if jsonb_typeof(v_nova) is distinct from 'object' or v_nova->>'modo' is distinct from 'calendario' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 v_base:=(v_nova->>'data_base')::date;v_passo:=(v_nova->>'intervalo_n')::integer;v_unidade:=v_nova->>'intervalo_unidade';
 if v_base is null or v_passo is null or v_passo<1 or v_unidade not in ('dias','semanas','meses','anos') then raise exception 'regra_invalida' using errcode='23514';end if;
 v_meses:=(extract(year from p_inicio)::integer-extract(year from v_base)::integer)*12+extract(month from p_inicio)::integer-extract(month from v_base)::integer;
 v_indice:=greatest(0,(case v_unidade when 'dias' then floor((p_inicio-v_base)::numeric/v_passo) when 'semanas' then floor((p_inicio-v_base)::numeric/(v_passo::numeric*7)) when 'meses' then floor(v_meses::numeric/v_passo) else floor(v_meses::numeric/(v_passo::numeric*12)) end)::integer-1);
 loop
  exit when v_iter>=102 or v_indice>3660000;
  begin vencimento:=pcm.sso_vencimento_ciclo_calendario(v_base,v_passo,v_unidade,v_indice);exception when invalid_parameter_value then exit;end;
  exit when vencimento>p_fim;
  if vencimento>=p_inicio and vencimento is distinct from (p_comparacao->>'vencimentoOriginal')::date then indice:=v_indice;return next;end if;
  v_indice:=v_indice+1;v_iter:=v_iter+1;
 end loop;
end; $$;
revoke all on function pcm.sso_prever_novas_datas_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_novas_datas_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) to authenticated;

create function pcm.sso_consultar_nova_data_calendario(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao_plano integer,p_revisao_decisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_request uuid;v_revisao integer;v_plano integer;v_escolha pcm.sso_escolhas_nova_data_calendario%rowtype;v_atual boolean:=false;
begin
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,false);
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao_plano for share nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select request_id,revisao,revisao_plano into v_request,v_revisao,v_plano from pcm.sso_decisoes_impacto_ocorrencia where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=p_preparada order by revisao desc limit 1;
 if v_request is null or v_revisao is distinct from p_revisao_decisao or v_plano is distinct from p_revisao_plano then raise exception 'decisao_obsoleta' using errcode='40001';end if;
 select * into v_escolha from pcm.sso_escolhas_nova_data_calendario where request_id=v_request and cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=p_preparada and revisao_plano=p_revisao_plano;
 if found then v_atual:=pcm.sso_escolha_nova_data_calendario_atual(v_request,p_cliente,p_plano,p_rascunho,p_revisao_plano);end if;
 return jsonb_build_object('preparadaId',p_preparada,'revisaoDecisao',v_revisao,'registrada',v_escolha.request_id is not null,'atual',coalesce(v_atual,false),'data',v_escolha.vencimento_novo,'indice',v_escolha.indice_novo);
end; $$;
revoke all on function pcm.sso_consultar_nova_data_calendario(uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_nova_data_calendario(uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;
