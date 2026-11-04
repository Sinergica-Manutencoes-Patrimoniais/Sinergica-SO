-- ADR-1152: origem explícita, somente intenção interna; sem chamada ao Auvo.
create table pcm.sso_intencao_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_intencao_material_gate(id,habilitado) values(true,false);
create table pcm.sso_intencao_material_origens(
 request_id uuid primary key, intencao_id uuid not null unique references pcm.reprogramacao_os_intencoes(id),
 cliente_id uuid not null references pcm.clientes(id), os_id uuid not null references pcm.ordens_servico(id),
 lista_id uuid not null, evento_revisao integer not null, ator_id uuid not null references auth.users(id),
 resultado jsonb not null, criado_em timestamptz not null default now(),
 foreign key(lista_id,evento_revisao) references pcm.sso_lista_materiais_eventos(lista_id,revisao)
);
alter table pcm.sso_intencao_material_gate enable row level security;
alter table pcm.sso_intencao_material_gate force row level security;
alter table pcm.sso_intencao_material_origens enable row level security;
alter table pcm.sso_intencao_material_origens force row level security;
revoke all on pcm.sso_intencao_material_gate,pcm.sso_intencao_material_origens from public,anon,authenticated,service_role;
create trigger sso_intencao_material_origens_imutaveis before update or delete on pcm.sso_intencao_material_origens
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_propor_intencao_por_material(p_request_id uuid,p_intencao_id uuid,p_origem_id uuid,p_destino_id uuid,
 p_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,p_motivo text,p_lista_id uuid,p_evento_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_cliente uuid; v_os uuid; v_lista pcm.listas_materiais%rowtype;
 v_existente pcm.sso_intencao_material_origens%rowtype; v_resultado jsonb;
begin
 if v_actor is null or p_request_id is null or p_lista_id is null or p_evento_revisao is null or p_evento_revisao<2 then
  raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_intencao_material_gate where id and habilitado for share;
 if not found then raise exception 'intencao_material_desabilitada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
 select * into v_existente from pcm.sso_intencao_material_origens where request_id=p_request_id;
 if found then
  if v_existente.ator_id is distinct from v_actor or v_existente.lista_id is distinct from p_lista_id
   or v_existente.evento_revisao is distinct from p_evento_revisao or v_existente.intencao_id is distinct from p_intencao_id
   or config.sso_autorizar_acao('material.gerir',v_existente.cliente_id) is distinct from true then
   raise exception 'request_id_conflitante_ou_sem_acesso' using errcode='42501'; end if;
  -- O comando de Visita compara integralmente seus próprios parâmetros também no replay.
  perform pcm.sso_propor_intencao_os_mediada(p_request_id,p_intencao_id,p_origem_id,p_destino_id,p_vinculo_id,p_revisao_origem,p_revisao_destino,p_motivo);
  return v_existente.resultado;
 end if;
 if exists(select 1 from pcm.visita_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 v_resultado:=pcm.sso_propor_intencao_os_mediada(p_request_id,p_intencao_id,p_origem_id,p_destino_id,p_vinculo_id,p_revisao_origem,p_revisao_destino,p_motivo);
 select i.cliente_id,i.os_id into v_cliente,v_os from pcm.reprogramacao_os_intencoes i where i.id=p_intencao_id and i.request_id=p_request_id;
 if not found or config.sso_autorizar_acao('material.gerir',v_cliente) is distinct from true then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=v_cliente and ordem_servico_id=v_os for share nowait;
 if not found then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_lista_materiais_eventos e where e.lista_id=p_lista_id and e.revisao=p_evento_revisao and e.tipo='excecao' for share nowait;
 if not found or config.sso_autorizar_acao('material.gerir',v_cliente) is distinct from true then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 v_resultado:=v_resultado||jsonb_build_object('listaId',p_lista_id,'eventoRevisao',p_evento_revisao,'excecaoAtualComprovada',false);
 insert into pcm.sso_intencao_material_origens(request_id,intencao_id,cliente_id,os_id,lista_id,evento_revisao,ator_id,resultado)
  values(p_request_id,p_intencao_id,v_cliente,v_os,p_lista_id,p_evento_revisao,v_actor,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'material.intencao_reprogramacao','ordens_servico',v_os,
  jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'listaId',p_lista_id,'eventoRevisao',p_evento_revisao));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_propor_intencao_por_material(uuid,uuid,uuid,uuid,uuid,integer,integer,text,uuid,integer) from public,anon,authenticated,service_role;
