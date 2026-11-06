-- ADR-0670: transferência de seleção sem alterar Pendências ou gerar execução.
create table pcm.sso_divisao_backlog_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_divisao_backlog_gate enable row level security;alter table pcm.sso_divisao_backlog_gate force row level security;
revoke all on pcm.sso_divisao_backlog_gate from public,anon,authenticated,service_role;
insert into pcm.sso_divisao_backlog_gate(id,habilitado) values(true,false);
create table pcm.sso_divisoes_backlog(request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),origem_id uuid not null references pcm.sso_backlog_composicoes(id),destino_id uuid not null unique references pcm.sso_backlog_composicoes(id),revisao_origem integer not null,itens jsonb not null,motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_divisoes_backlog enable row level security;alter table pcm.sso_divisoes_backlog force row level security;
revoke all on pcm.sso_divisoes_backlog from public,anon,authenticated,service_role;
create trigger sso_divisao_backlog_imutavel before update or delete on pcm.sso_divisoes_backlog for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_dividir_composicao_backlog(p_request_id uuid,p_cliente_id uuid,p_origem_id uuid,p_expected_revision integer,p_destino_id uuid,p_itens jsonb,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_divisoes_backlog%rowtype;v_origem pcm.sso_backlog_composicoes%rowtype;v_item jsonb;v_p pcm.sso_pendencias_tecnicas%rowtype;v_b pcm.sso_backlog_pendencias%rowtype;v_itens jsonb;v_movimentos jsonb:='[]'::jsonb;v_prioridade_anterior jsonb;v_total integer;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_divisao_backlog_gate where id),false) then raise exception 'divisao_backlog_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_origem_id is null or p_destino_id is null or p_destino_id=p_origem_id or p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_itens) is distinct from 'array' or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if jsonb_array_length(p_itens) not between 1 and 99 or exists(select 1 from jsonb_array_elements(p_itens) x(item) where jsonb_typeof(item) is distinct from 'string' or (item #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'itens_invalidos' using errcode='22023'; end if;
 if (select count(distinct (item #>> '{}')::uuid) from jsonb_array_elements(p_itens) x(item))<>jsonb_array_length(p_itens) then raise exception 'itens_duplicados' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select jsonb_agg(to_jsonb((item #>> '{}')::uuid) order by (item #>> '{}')::uuid) into v_itens from jsonb_array_elements(p_itens) x(item);
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'origemId',p_origem_id,'expectedRevision',p_expected_revision,'destinoId',p_destino_id,'itens',v_itens,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('divisao-backlog:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_divisoes_backlog where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 select * into v_origem from pcm.sso_backlog_composicoes where id=p_origem_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'composicao_indisponivel' using errcode='42501'; end if;
 if v_origem.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_prioridade_anterior:=jsonb_build_object('gravidade',v_origem.gravidade,'urgencia',v_origem.urgencia,'tendencia',v_origem.tendencia,'dorCliente',v_origem.dor_cliente);
 if exists(select 1 from pcm.sso_backlog_chamado_vinculos where composicao_id=p_origem_id) or exists(select 1 from pcm.sso_backlog_parcelas where composicao_id=p_origem_id) then raise exception 'composicao_vinculada' using errcode='23514'; end if;
 select count(*) into v_total from pcm.sso_backlog_pendencias where composicao_id=p_origem_id;
 if v_total<=jsonb_array_length(v_itens) or v_total>100 then raise exception 'divisao_nao_parcial' using errcode='23514'; end if;
 for v_item in select item from jsonb_array_elements(v_itens) x(item) order by (item #>> '{}')::uuid loop
   select * into v_p from pcm.sso_pendencias_tecnicas where id=(v_item #>> '{}')::uuid and cliente_id=p_cliente_id for update;
   select * into v_b from pcm.sso_backlog_pendencias where composicao_id=p_origem_id and pendencia_id=(v_item #>> '{}')::uuid for update;
   if v_p.id is null or v_b.pendencia_id is null or v_p.estado<>'aberta' or v_p.revisao<>v_b.revisao_origem or v_p.alvo_tipo is distinct from v_origem.alvo_tipo or v_p.alvo_id is distinct from v_origem.alvo_id or exists(select 1 from pcm.sso_backlog_parcelas where pendencia_id=v_p.id) then raise exception 'item_indisponivel' using errcode='23514'; end if;
   v_movimentos:=v_movimentos||jsonb_build_array(jsonb_build_object('pendenciaId',v_p.id,'revisaoOrigem',v_b.revisao_origem));
 end loop;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_backlog_composicoes(id,cliente_id,alvo_tipo,alvo_id,criado_por) values(p_destino_id,p_cliente_id,v_origem.alvo_tipo,v_origem.alvo_id,v_actor);
 for v_item in select item from jsonb_array_elements(v_itens) x(item) order by (item #>> '{}')::uuid loop
   select * into v_b from pcm.sso_backlog_pendencias where composicao_id=p_origem_id and pendencia_id=(v_item #>> '{}')::uuid;
   delete from pcm.sso_backlog_pendencias where composicao_id=p_origem_id and pendencia_id=v_b.pendencia_id;
   insert into pcm.sso_backlog_pendencias(composicao_id,pendencia_id,revisao_origem) values(p_destino_id,v_b.pendencia_id,v_b.revisao_origem);
 end loop;
 update pcm.sso_backlog_composicoes set gravidade=null,urgencia=null,tendencia=null,dor_cliente=null,revisao=revisao+1 where id=p_origem_id returning * into v_origem;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'origemId',p_origem_id,'origemRevision',v_origem.revisao,'destinoId',p_destino_id,'destinoRevision',1,'itens',v_itens,'chamadoCriado',false,'osCriada',false);
 insert into pcm.sso_divisoes_backlog(request_id,cliente_id,origem_id,destino_id,revisao_origem,itens,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_origem_id,p_destino_id,v_origem.revisao,v_movimentos,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'backlog.composicao_dividida','sso_backlog_composicoes',p_origem_id,v_resultado||jsonb_build_object('motivo',v_motivo,'prioridadeAnterior',v_prioridade_anterior));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_dividir_composicao_backlog(uuid,uuid,uuid,integer,uuid,jsonb,text) from public,anon,authenticated,service_role;
