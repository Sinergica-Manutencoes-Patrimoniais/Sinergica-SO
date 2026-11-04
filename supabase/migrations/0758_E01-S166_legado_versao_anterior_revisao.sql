-- ADR-0533: mesma autorização e prova de versão anterior da 0755.
create or replace function pcm.sso_materializar_ciclo_legado(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_plano_legado_id uuid,p_relacao_request_id uuid,p_ciclo_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_plano pcm.planos_manutencao%rowtype;v_legado pcm.planos_preventivos%rowtype;v_versao pcm.plano_versoes%rowtype;v_rel pcm.sso_declaracoes_planos_legados%rowtype;v_ant pcm.sso_materializacoes_ciclo_legado%rowtype;v_rotina jsonb;v_n integer;v_distancia integer;v_passo integer;v_indice integer;v_legada uuid;v_criada boolean;v_payload jsonb;v_resultado jsonb;v_integracao jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_materializar_ciclo_legado_gate where id),false) or not coalesce((select habilitado from pcm.sso_integrar_ciclo_existente_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_plano_legado_id is null or p_relacao_request_id is null or p_ciclo_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id,'planoLegadoId',p_plano_legado_id,'relacaoRequestId',p_relacao_request_id,'cicloId',p_ciclo_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('materializar-ciclo-legado:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_materializacoes_ciclo_legado where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'preparada_indisponivel' using errcode='42501';end if;
 select * into v_plano from pcm.planos_manutencao where id=v_prep.plano_id and cliente_id=p_cliente_id for update;
 if not found or not pcm.sso_plano_permite_gerar_versao(v_plano.id,v_prep.versao_id) then raise exception 'plano_inativo' using errcode='23514';end if;
 if v_prep.vencimento_original<current_date then raise exception 'vencido_exige_decisao_pcm' using errcode='23514';end if;
 select * into v_legado from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id for update;
 if not found or v_legado.estado<>'ativo' then raise exception 'plano_legado_indisponivel' using errcode='23514';end if;
 select * into v_rel from pcm.sso_declaracoes_planos_legados where request_id=p_relacao_request_id and cliente_id=p_cliente_id and plano_id=v_plano.id and plano_legado_id=v_legado.id and decisao='declarar';
 if not found or (select request_id from pcm.sso_declaracoes_planos_legados where plano_id=v_plano.id and plano_legado_id=v_legado.id order by revisao desc limit 1) is distinct from p_relacao_request_id then raise exception 'relacao_nao_atual' using errcode='23514';end if;
 if not ((v_prep.alvo_tipo='sistema' and v_legado.sistema_id=v_prep.alvo_id) or (v_prep.alvo_tipo='componente' and v_legado.equipamento_id=v_prep.alvo_id)) then raise exception 'alvo_nao_comprovado' using errcode='23514';end if;
 select * into v_versao from pcm.plano_versoes where id=v_prep.versao_id and plano_id=v_plano.id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=v_prep.rotina_id::text;
 if v_n<>1 or v_rotina->>'questionario_id' is distinct from v_legado.questionario_id::text then raise exception 'questionario_nao_comprovado' using errcode='23514';end if;
 if v_legado.intervalo_unidade='semanas' then v_distancia:=v_prep.vencimento_original-v_legado.primeira_data;v_passo:=7*v_legado.intervalo_n;
 else v_distancia:=(extract(year from v_prep.vencimento_original)::integer-extract(year from v_legado.primeira_data)::integer)*12+extract(month from v_prep.vencimento_original)::integer-extract(month from v_legado.primeira_data)::integer;v_passo:=v_legado.intervalo_n;end if;
 if v_distancia<0 or mod(v_distancia,v_passo)<>0 then raise exception 'ciclo_legado_incompativel' using errcode='23514';end if;
 v_indice:=v_distancia/v_passo;
 if pcm.sso_vencimento_ciclo_calendario(v_legado.primeira_data,v_legado.intervalo_n,v_legado.intervalo_unidade,v_indice) is distinct from v_prep.vencimento_original then raise exception 'ciclo_legado_incompativel' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 insert into pcm.ocorrencias_preventivas(plano_id,indice,vencimento,chave_externa) values(v_legado.id,v_indice,v_prep.vencimento_original,'PREV-'||v_legado.id||'-'||v_indice) on conflict(plano_id,indice) do nothing returning id into v_legada;
 v_criada:=found;
 if not v_criada then select id into v_legada from pcm.ocorrencias_preventivas where plano_id=v_legado.id and indice=v_indice;end if;
 if v_legada is null then raise exception 'ciclo_legado_indisponivel' using errcode='23514';end if;
 v_integracao:=pcm.sso_integrar_ciclo_legado_existente(gen_random_uuid(),p_cliente_id,p_preparada_id,v_legada,p_ciclo_id,p_relacao_request_id,v_motivo);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'legadaId',v_legada,'cicloId',p_ciclo_id,'ocorrenciaLegadaCriada',v_criada,'osCriada',false,'tarefaAuvoCriada',false,'dataReferenciaUtc',current_date,'equivalenciaGeralComprovada',false);
 insert into pcm.sso_materializacoes_ciclo_legado(request_id,cliente_id,preparada_id,legada_id,ciclo_id,relacao_request_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_preparada_id,v_legada,p_ciclo_id,p_relacao_request_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_legado_materializado','planos_manutencao',v_plano.id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;

