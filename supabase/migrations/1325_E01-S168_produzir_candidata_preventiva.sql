-- ADR-1158: produtor privado e desativado; não autoriza rede.
create table pcm.sso_t24_produtor_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_produtor_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_produtor_recibos(request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 visita_id uuid not null references pcm.visitas(id),os_id uuid not null references pcm.ordens_servico(id),revisao integer not null,
 protocolo text not null default 'preventiva' check(protocolo in ('preventiva','corretiva')),
 tentativa_id uuid not null unique references pcm.sso_t24_tentativas(id),resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_t24_produtor_gate enable row level security;alter table pcm.sso_t24_produtor_gate force row level security;
alter table pcm.sso_t24_produtor_recibos enable row level security;alter table pcm.sso_t24_produtor_recibos force row level security;
revoke all on pcm.sso_t24_produtor_gate,pcm.sso_t24_produtor_recibos from public,anon,authenticated,service_role;
create trigger sso_t24_produtor_recibos_imutaveis before update or delete on pcm.sso_t24_produtor_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_t24_produzir_preventiva(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.visitas%rowtype; o pcm.ordens_servico%rowtype; f pcm.funcionarios%rowtype;
 b pcm.os_rotina_vinculos_explicitos%rowtype; ev pcm.os_rotina_vinculo_eventos%rowtype;
 q pcm.questionarios%rowtype; cliente pcm.clientes%rowtype; tipo pcm.tipos_tarefa%rowtype; anterior pcm.sso_t24_produtor_recibos%rowtype;
 snap jsonb; alvo_id uuid; alvo_tipo text; alvo_auvo bigint; questionario_id uuid;
 tentativa uuid:=gen_random_uuid(); outbox uuid:=gen_random_uuid(); resultado jsonb; esperado jsonb; despacho jsonb; operacao text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or p_request_id is null or p_visita_id is null or p_os_id is null or p_revisao is null or p_revisao<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_produtor_gate where id and habilitado for share;
 if not found then raise exception 'produtor_desabilitado' using errcode='55000'; end if;
 perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
 select * into anterior from pcm.sso_t24_produtor_recibos where request_id=p_request_id;
 if found then
  if anterior.protocolo<>'preventiva' or anterior.ator_id is distinct from auth.uid() or anterior.visita_id<>p_visita_id or anterior.os_id<>p_os_id or anterior.revisao<>p_revisao
   or config.sso_autorizar_acao('visita.confirmar',anterior.cliente_id) is distinct from true then raise exception 'request_id_conflitante_ou_sem_acesso' using errcode='42501'; end if;
  return anterior.resultado;
 end if;
 -- O replay de intenção local retorna recibo sem conferir novamente suas fontes.
 -- Não promover uma intenção antiga por este caminho: exige revalidação própria.
 if exists(select 1 from pcm.visita_comandos where request_id=p_request_id) then
  raise exception 'intencao_preexistente_exige_revalidacao' using errcode='23505';
 end if;
 -- A intenção existente aplica confirmação, ciência, conteúdo e vínculo preventivo.
 perform pcm.sso_registrar_intencao_envio_local(p_request_id,p_visita_id,p_os_id,p_revisao);
 select * into v from pcm.visitas where id=p_visita_id and revisao=p_revisao and estado='confirmada' for share;
 if not found then raise exception 'visita_obsoleta' using errcode='40001'; end if;
 select * into o from pcm.ordens_servico where id=p_os_id and client_id=v.cliente_id and deleted_at is null and categoria='preventiva' for share;
 if not found or o.status in ('finalizado','cancelado') then raise exception 'os_indisponivel' using errcode='23514'; end if;
 select * into cliente from pcm.clientes where id=v.cliente_id and ativo and deleted_at is null and auvo_id>0 for share;
 if not found then raise exception 'cliente_sem_vinculo_auvo' using errcode='23514'; end if;
 select * into tipo from pcm.tipos_tarefa where id=o.tipo_tarefa_id and ativo and deleted_at is null and auvo_id>0 for share;
 if not found then raise exception 'tipo_tarefa_sem_vinculo_auvo' using errcode='23514'; end if;
 if exists(select 1 from pcm.visita_confirmacoes c where c.visita_id=v.id and c.cliente_id=v.cliente_id and c.revisao=v.revisao and c.politica_modo='obrigatoria') then
  perform pub.id from pcm.portal_confirmacoes_cliente x join pcm.portal_visita_publicacoes pub on pub.id=x.publicacao_id
   join pcm.visita_confirmacoes c on c.id=x.confirmacao_pcm_id
   where c.visita_id=v.id and c.cliente_id=v.cliente_id and c.revisao=v.revisao and pub.visita_id=v.id and pub.os_id=o.id
    and pub.cliente_id=v.cliente_id and pub.revisao_visita=v.revisao and pub.revogado_em is null for share of pub nowait;
  if not found then raise exception 'ciencia_os_ausente' using errcode='23514'; end if;
 end if;
 select * into f from pcm.funcionarios where id=v.responsavel_id and ativo and deleted_at is null and auvo_user_id>0 for share;
 if not found then raise exception 'responsavel_sem_vinculo_auvo' using errcode='23514'; end if;
 select * into b from pcm.os_rotina_vinculos_explicitos where os_id=o.id and cliente_id=v.cliente_id;
 if not found then raise exception 'vinculo_rotina_indisponivel' using errcode='23514'; end if;
 select * into ev from pcm.os_rotina_vinculo_eventos where os_id=o.id order by revisao desc limit 1;
 if ev.acao='invalidar' then raise exception 'vinculo_rotina_invalidado' using errcode='23514'; end if;
 snap:=case when ev.acao='retificar' then ev.rotina_snapshot else b.rotina_snapshot end;
 if jsonb_typeof(snap->'alvo') is distinct from 'object' or coalesce(snap->'alvo'->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'alvo_invalido' using errcode='23514'; end if;
 alvo_id:=(snap->'alvo'->>'id')::uuid; alvo_tipo:=snap->'alvo'->>'tipo';
 if alvo_tipo='sistema' then select auvo_equipment_id into alvo_auvo from pcm.sistemas where id=alvo_id and cliente_id=v.cliente_id and ativo and deleted_at is null for share;
 elsif alvo_tipo='componente' then select auvo_equipment_id into alvo_auvo from pcm.equipamentos where id=alvo_id and client_id=v.cliente_id and ativo and deleted_at is null for share;
 else raise exception 'tipo_alvo_nao_suportado' using errcode='23514'; end if;
 if alvo_auvo is null or alvo_auvo<=0 then raise exception 'alvo_sem_vinculo_auvo' using errcode='23514'; end if;
 if snap->>'questionario_id' is not null then
  if snap->>'questionario_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'questionario_invalido' using errcode='23514'; end if;
  questionario_id:=(snap->>'questionario_id')::uuid;
  select * into q from pcm.questionarios where id=questionario_id and ativo and auvo_id>0 for share;
  if not found or snap->'questionario'->>'auvo_id' is distinct from q.auvo_id::text then raise exception 'questionario_divergente' using errcode='23514'; end if;
 end if;
 perform 1 from pcm.preventiva_auvo_contrato where id and estado='validado' for share;
 if not found then raise exception 'contrato_nao_validado' using errcode='55000'; end if;
 operacao:=case when o.auvo_task_id is null then 'criar' else 'atualizar' end;
 if o.auvo_task_id is not null and o.auvo_task_id<=0 then raise exception 'tarefa_invalida' using errcode='23514'; end if;
 -- O contrato preparado para o Auvo serializa até segundos; não criar candidata que não poderá ser representada.
 if v.inicio_em is distinct from date_trunc('second',v.inicio_em) then raise exception 'precisao_inicio_nao_suportada' using errcode='23514'; end if;
 esperado:=jsonb_build_object('tecnicoId',f.auvo_user_id::text,'inicio',to_char(v.inicio_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'alvoId',alvo_auvo::text,'questionarioId',case when questionario_id is null then null else q.auvo_id::text end);
 despacho:=jsonb_build_object('clienteId',cliente.id,'clienteAuvoId',cliente.auvo_id::text,'tipoTarefaId',tipo.id,'tipoTarefaAuvoId',tipo.auvo_id::text,'titulo',o.titulo,'descricao',o.descricao,'prioridade',o.prioridade);
 insert into pcm.auvo_sync_outbox(id,entity,row_id,op) values(outbox,'ordens_servico_t24',o.id,case operacao when 'criar' then 'create' else 'update' end);
 insert into pcm.sso_t24_tentativas(id,cliente_id,visita_id,os_id,revisao_visita,operacao,tarefa_id,esperado,questionario_obrigatorio,elegivel_em,outbox_id,despacho)
  values(tentativa,v.cliente_id,v.id,o.id,v.revisao,operacao,o.auvo_task_id::text,esperado,questionario_id is not null,v.inicio_em-interval '24 hours',outbox,despacho);
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(tentativa,1,0,'aguardando','candidata_preventiva_registrada');
 resultado:=jsonb_build_object('requestId',p_request_id,'tentativaId',tentativa,'outboxId',outbox,'visitaId',v.id,'osId',o.id,'revision',v.revisao,'protocolo','preventiva','autorizaEnvio',false);
 insert into pcm.sso_t24_produtor_recibos(request_id,ator_id,cliente_id,visita_id,os_id,revisao,tentativa_id,resultado) values(p_request_id,auth.uid(),v.cliente_id,v.id,o.id,v.revisao,tentativa,resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'integracao.t24_preventiva_preparada','ordens_servico',o.id,jsonb_build_object('requestId',p_request_id,'visitaId',v.id,'revision',v.revisao,'tentativaId',tentativa));
 return resultado;
end; $$;
revoke all on function pcm.sso_t24_produzir_preventiva(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
