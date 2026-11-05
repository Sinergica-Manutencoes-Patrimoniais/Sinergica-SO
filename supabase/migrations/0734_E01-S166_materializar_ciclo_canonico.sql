-- ADR-0509: adaptação conservadora por ciclo, sem excluir ou reescrever legados.
create table pcm.sso_materializar_ciclo_canonico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_materializar_ciclo_canonico_gate enable row level security;alter table pcm.sso_materializar_ciclo_canonico_gate force row level security;
revoke all on pcm.sso_materializar_ciclo_canonico_gate from public,anon,authenticated,service_role;
insert into pcm.sso_materializar_ciclo_canonico_gate(id,habilitado) values(true,false);
create table pcm.sso_ciclo_canonico_usos_versao(ciclo_id uuid not null references pcm.sso_ciclos_calendario_canonicos(id),versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),primary key(ciclo_id,versao_id));
alter table pcm.sso_ciclo_canonico_usos_versao enable row level security;alter table pcm.sso_ciclo_canonico_usos_versao force row level security;
revoke all on pcm.sso_ciclo_canonico_usos_versao from public,anon,authenticated,service_role;
create trigger sso_ciclo_uso_versao_imutavel before update or delete on pcm.sso_ciclo_canonico_usos_versao for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_materializar_ciclo_canonico(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_vencimento date)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_comando pcm.calendario_contratual_comandos%rowtype;v_n integer;v_logica uuid;v_tipo text;v_alvo uuid;v_ancora date;v_intervalo integer;v_unidade text;v_ciclo integer;v_preparada uuid;v_identidade jsonb;v_canonico uuid;v_serie uuid;v_previa record;v_payload jsonb;v_resultado jsonb;v_criada boolean:=false;v_existente pcm.sso_ciclo_canonico_usos_versao%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_materializar_ciclo_canonico_gate where id),false) or not coalesce((select habilitado from pcm.sso_identidade_ciclo_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) or not coalesce((select habilitado from pcm.sso_guarda_ciclo_canonico_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_expected_revision is null or p_expected_revision<1 or p_vencimento is null or not isfinite(p_vencimento) or p_vencimento<current_date or p_vencimento>current_date+30 then raise exception 'janela_invalida' using errcode='22023';end if;
 v_payload:=jsonb_build_object('tipo','materializarCicloCanonico','clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'expectedRevision',p_expected_revision,'vencimento',p_vencimento);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request_id;
 if found then if v_comando.actor_id is distinct from v_actor or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_comando.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or v_plano.estado not in ('aprovado','ativo') then raise exception 'plano_indisponivel' using errcode='23514';end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'calendario' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 v_logica:=(v_rotina->>'rotina_logica_id')::uuid;v_tipo:=v_rotina->>'alvo_tipo';v_alvo:=case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;v_ancora:=(v_rotina->>'data_base')::date;v_intervalo:=(v_rotina->>'intervalo_n')::integer;v_unidade:=v_rotina->>'intervalo_unidade';
 if v_logica is null or v_alvo is null or not exists(select 1 from pcm.rotina_origem_geracao where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo and origem='plano') then raise exception 'origem_nao_comprovada' using errcode='23514';end if;
 select * into v_previa from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento);
 if not found then raise exception 'vencimento_nao_e_ciclo' using errcode='23514';end if;v_ciclo:=v_previa.ciclo;
 select s.id into v_serie from pcm.sso_series_ciclo_calendario s where s.plano_id=p_plano_id and s.rotina_logica_id=v_logica and s.alvo_tipo=v_tipo and s.alvo_id=v_alvo and s.ancora=v_ancora and s.intervalo_n=v_intervalo and s.intervalo_unidade=v_unidade;
 if v_serie is not null then select id into v_canonico from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=v_ciclo and vencimento_original=p_vencimento;end if;
 if v_canonico is not null then select preparada_id into v_preparada from pcm.sso_ciclo_calendario_versoes where ciclo_id=v_canonico order by criado_em limit 1;end if;
 if v_preparada is null then
  select id into v_preparada from pcm.ocorrencias_rotina_preparadas where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo and vencimento_original=p_vencimento;
  if v_preparada is not null then
   v_identidade:=pcm.sso_identificar_ciclo_calendario(gen_random_uuid(),p_cliente_id,v_preparada);v_canonico:=(v_identidade->>'cicloCanonicoId')::uuid;
   if not exists(select 1 from pcm.sso_ciclos_calendario_canonicos c join pcm.sso_series_ciclo_calendario s on s.id=c.serie_id where c.id=v_canonico and c.indice=v_ciclo and s.plano_id=p_plano_id and s.rotina_logica_id=v_logica and s.alvo_tipo=v_tipo and s.alvo_id=v_alvo and s.ancora=v_ancora and s.intervalo_n=v_intervalo and s.intervalo_unidade=v_unidade) then raise exception 'coincidencia_data_exige_reconciliacao' using errcode='23514';end if;
  else
   insert into pcm.sso_materializacao_canonica_tokens(txid,plano_id,versao_id,rotina_id,vencimento) values(pg_catalog.txid_current(),p_plano_id,p_versao_id,p_rotina_id,p_vencimento);
   perform pcm.sso_materializar_rotina_calendario(gen_random_uuid(),p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_vencimento,p_vencimento);
   delete from pcm.sso_materializacao_canonica_tokens where txid=pg_catalog.txid_current() and plano_id=p_plano_id and versao_id=p_versao_id and rotina_id=p_rotina_id and vencimento=p_vencimento;
   select id into v_preparada from pcm.ocorrencias_rotina_preparadas where plano_id=p_plano_id and versao_id=p_versao_id and rotina_id=p_rotina_id and vencimento_original=p_vencimento;
   if v_preparada is null then raise exception 'ocorrencia_nao_materializada' using errcode='23514';end if;
   v_identidade:=pcm.sso_identificar_ciclo_calendario(gen_random_uuid(),p_cliente_id,v_preparada);v_canonico:=(v_identidade->>'cicloCanonicoId')::uuid;v_criada:=true;
  end if;
 end if;
 insert into pcm.sso_ciclo_canonico_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id) values(v_canonico,p_versao_id,p_rotina_id,v_preparada,v_actor) on conflict(ciclo_id,versao_id) do nothing;
 select * into v_existente from pcm.sso_ciclo_canonico_usos_versao where ciclo_id=v_canonico and versao_id=p_versao_id;
 if v_existente.rotina_id is distinct from p_rotina_id or v_existente.preparada_id is distinct from v_preparada then raise exception 'uso_versao_conflitante' using errcode='23505';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',v_preparada,'cicloCanonicoId',v_canonico,'indice',v_ciclo,'vencimentoOriginal',p_vencimento,'criada',v_criada,'osCriada',false,'tarefaAuvoCriada',false,'dataReferenciaUtc',current_date);
 insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_canonico_materializado','planos_manutencao',p_plano_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
