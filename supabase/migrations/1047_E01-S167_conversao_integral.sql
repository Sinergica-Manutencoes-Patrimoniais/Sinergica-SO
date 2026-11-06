-- ADR-0858: núcleo privado e bloqueado até transição legada e mediação integral.
create function pcm.sso_converter_chamado_integral(p_request_id uuid,p_expected_revision bigint,p_chamado_id uuid,p_cliente_id uuid,p_os_id uuid,p_campos jsonb,p_destino text,p_status_hub text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_c pcm.chamados%rowtype; v_os pcm.ordens_servico%rowtype;
 v_anterior pcm.chamado_os_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_numero text;
 v_chaves text[]:=array['titulo','descricao','categoria','prioridade','gravidade','urgencia','tendencia','dor_cliente','observacao','local_descricao','solicitante','origem','tipo_tarefa_id','tecnico_funcionario_id','data_agendada','tipo_os','pmoc_schedule_id','origem_inspecao_item_id','equipamento_id','foto_urls'];
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) then raise exception 'criacao_multipla_bloqueada' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.chamado_os_gate where id for share;
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) then raise exception 'criacao_multipla_bloqueada' using errcode='55000'; end if;
 if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is not null or exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.ordens_servico'::regclass and tgname='trg_ordens_servico_numero_chamado' and not tgisinternal) then raise exception 'transicao_legada_incompleta' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_os_id is null or p_expected_revision is null or p_expected_revision<1 or p_destino not in ('backlog','convertido_os') or p_destino is null or (p_status_hub is not null and p_status_hub not in ('corretiva','backlog','planejamento','em_execucao','finalizado','cancelado')) or pg_catalog.jsonb_typeof(p_campos) is distinct from 'object' then raise exception 'comando_invalido' using errcode='22023'; end if;
 if not (p_campos ?& v_chaves) or exists(select 1 from pg_catalog.jsonb_object_keys(p_campos) k where not (k=any(v_chaves))) or pg_catalog.jsonb_typeof(p_campos->'foto_urls') is distinct from 'array' then raise exception 'campos_incompletos_ou_invalidos' using errcode='22023'; end if;
 v_payload:=pg_catalog.jsonb_build_object('versao','conversao-integral-v1','clienteId',p_cliente_id,'chamadoId',p_chamado_id,'osId',p_os_id,'expectedRevision',p_expected_revision,'campos',p_campos,'destino',p_destino,'statusHub',p_status_hub);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.chamado_os_comandos where request_id=p_request_id;
 if found then
  if v_anterior.actor_id is distinct from v_actor or v_anterior.cliente_id is distinct from p_cliente_id then raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_anterior.resultado;
 end if;
 select * into v_c from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found then raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if v_c.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_c.status not in ('aberto','convertido_os') or v_c.sso_encerrado_em is not null then raise exception 'chamado_nao_editavel' using errcode='23514'; end if;
 perform o.id from pcm.ordens_servico o where (o.chamado_id=p_chamado_id or o.id=v_c.ordem_servico_id) and o.deleted_at is null order by o.id for share;
 perform pcm.sso_exigir_vinculo_chamado_consistente(p_cliente_id,p_chamado_id);
 v_os:=pg_catalog.jsonb_populate_record(null::pcm.ordens_servico,p_campos);
 if v_os.titulo is null or length(btrim(v_os.titulo)) not between 1 and 200 or btrim(v_os.titulo) is distinct from btrim(v_c.titulo) or v_os.descricao is distinct from nullif(btrim(v_c.descricao),'') or v_os.foto_urls is distinct from to_jsonb(v_c.foto_urls) or v_os.categoria is null or v_os.categoria not in ('corretiva','preventiva','melhoria','inspecao','emergencial','outro') or v_os.prioridade is null or v_os.prioridade not in ('baixa','normal','media','alta','critica') or v_os.origem is null or v_os.origem not in ('manual','solicitacao_cliente','telefone','vistoria','ze','portal','pmoc') or v_os.gravidade is null or v_os.urgencia is null or v_os.tendencia is null or (v_os.tecnico_funcionario_id is not null or v_os.data_agendada is not null) and v_os.tipo_tarefa_id is null then raise exception 'campos_inconsistentes' using errcode='23514'; end if;
 if v_os.tipo_os is distinct from (case when v_os.categoria='emergencial' then 'C1' when v_os.categoria='corretiva' then 'C2' when v_os.categoria='preventiva' and v_os.pmoc_schedule_id is not null then 'P1' when v_os.categoria='preventiva' then 'P2' when v_os.categoria='inspecao' then 'IN' else null end) then raise exception 'tipo_os_inconsistente' using errcode='23514'; end if;
 perform 1 from pcm.equipamentos where id=v_os.equipamento_id for share;
 perform 1 from pcm.inspecao_itens where id=v_os.origem_inspecao_item_id for share;
 perform n.id from pcm.inspecoes n join pcm.inspecao_itens i on i.inspecao_id=n.id where i.id=v_os.origem_inspecao_item_id for share of n;
 perform 1 from pcm.pmoc_schedules where id=v_os.pmoc_schedule_id for share;
 perform p.id from pcm.pmoc_properties p join pcm.pmoc_schedules s on s.property_id=p.id where s.id=v_os.pmoc_schedule_id for share of p;
 perform c.id from pcm.pmoc_contracts c join pcm.pmoc_schedules s on s.contract_id=c.id where s.id=v_os.pmoc_schedule_id for share of c;
 perform r.id from pcm.pmoc_records r join pcm.pmoc_schedules s on s.record_id=r.id where s.id=v_os.pmoc_schedule_id for share of r;
 perform 1 from pcm.funcionarios where id=v_os.tecnico_funcionario_id for share;
 perform 1 from pcm.tipos_tarefa where id=v_os.tipo_tarefa_id for share;
 if v_os.equipamento_id is not null and not exists(select 1 from pcm.equipamentos e where e.id=v_os.equipamento_id and e.client_id=p_cliente_id and e.deleted_at is null) then raise exception 'vinculo_cliente_invalido' using errcode='23514'; end if;
 if v_os.origem_inspecao_item_id is not null and not exists(select 1 from pcm.inspecao_itens i join pcm.inspecoes n on n.id=i.inspecao_id and n.client_id=i.client_id and n.deleted_at is null where i.id=v_os.origem_inspecao_item_id and i.client_id=p_cliente_id) then raise exception 'vinculo_cliente_invalido' using errcode='23514'; end if;
 if v_os.pmoc_schedule_id is not null and not exists(select 1 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts c on c.id=s.contract_id and c.property_id=s.property_id and c.deleted_at is null left join pcm.pmoc_records r on r.id=s.record_id and r.property_id=s.property_id and r.contract_id=s.contract_id where s.id=v_os.pmoc_schedule_id and (s.record_id is null or r.id is not null)) then raise exception 'vinculo_cliente_invalido' using errcode='23514'; end if;
 if v_os.tecnico_funcionario_id is not null and not exists(select 1 from pcm.funcionarios f where f.id=v_os.tecnico_funcionario_id and f.ativo and f.deleted_at is null) then raise exception 'tecnico_indisponivel' using errcode='23514'; end if;
 if v_os.tipo_tarefa_id is not null and not exists(select 1 from pcm.tipos_tarefa t where t.id=v_os.tipo_tarefa_id and t.ativo and t.deleted_at is null) then raise exception 'tipo_tarefa_indisponivel' using errcode='23514'; end if;
 v_numero:=v_c.numero||'-OS-'||p_os_id::text;
 insert into pcm.ordens_servico(id,client_id,chamado_id,numero,titulo,descricao,categoria,status,prioridade,gravidade,urgencia,tendencia,dor_cliente,observacao,local_descricao,solicitante,origem,created_by,tipo_tarefa_id,tecnico_funcionario_id,data_agendada,tipo_os,pmoc_schedule_id,origem_inspecao_item_id,equipamento_id,foto_urls)
 values(p_os_id,p_cliente_id,p_chamado_id,v_numero,btrim(v_os.titulo),v_os.descricao,v_os.categoria,'solicitacao',v_os.prioridade,v_os.gravidade,v_os.urgencia,v_os.tendencia,v_os.dor_cliente,v_os.observacao,v_os.local_descricao,v_os.solicitante,v_os.origem,v_actor,v_os.tipo_tarefa_id,v_os.tecnico_funcionario_id,v_os.data_agendada,v_os.tipo_os,v_os.pmoc_schedule_id,v_os.origem_inspecao_item_id,v_os.equipamento_id,v_os.foto_urls);
 update pcm.chamados set ordem_servico_id=coalesce(ordem_servico_id,p_os_id),status=p_destino,updated_at=now(),updated_by=v_actor where id=p_chamado_id returning * into v_c;
 insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(p_chamado_id,'os_gerada',pg_catalog.jsonb_build_object('ordemServicoId',p_os_id,'requestId',p_request_id),v_actor);
 if p_status_hub is not null then update pcm.ordens_servico set status=p_status_hub,updated_at=now(),updated_by=v_actor where id=p_os_id; end if;
 v_resultado:=pg_catalog.jsonb_build_object('chamadoId',p_chamado_id,'osId',p_os_id,'numero',v_numero,'revision',v_c.sso_revisao,'requestId',p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'chamado.os_criada','chamados',p_chamado_id,v_resultado);
 insert into pcm.chamado_os_comandos(request_id,actor_id,cliente_id,chamado_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,p_chamado_id,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated,service_role;
