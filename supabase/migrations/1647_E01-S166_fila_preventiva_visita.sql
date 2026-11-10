-- ADR-1504. A fila de Visita é isolada da chave de calendário e nasce desabilitada.
create table pcm.sso_fila_visita_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_fila_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_fila_visita_gate enable row level security;
alter table pcm.sso_fila_visita_gate force row level security;
revoke all on pcm.sso_fila_visita_gate from public,anon,authenticated,service_role;

create table pcm.sso_fila_visita (
 ciclo_id uuid primary key references pcm.sso_ciclos_visita_canonicos(id),
 cliente_id uuid not null references pcm.clientes(id), plano_id uuid not null references pcm.planos_manutencao(id),
 preparada_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 estado text not null check(estado in ('aguardando','verificacao','cancelado')),
 revisao integer not null check(revisao>0), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table pcm.sso_fila_visita_comandos (
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 ciclo_id uuid not null references pcm.sso_fila_visita(ciclo_id), payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_fila_visita enable row level security;
alter table pcm.sso_fila_visita force row level security;
alter table pcm.sso_fila_visita_comandos enable row level security;
alter table pcm.sso_fila_visita_comandos force row level security;
revoke all on pcm.sso_fila_visita,pcm.sso_fila_visita_comandos from public,anon,authenticated,service_role;
create trigger sso_fila_visita_comandos_imutaveis before update or delete on pcm.sso_fila_visita_comandos
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Chamada apenas após bloquear as fontes. Vínculo ausente nunca comprova que está aguardando.
create function pcm.sso_estado_fila_visita(p_cliente uuid,p_plano uuid,p_ciclo uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_total integer;v_legada uuid;v_leg pcm.ocorrencias_preventivas%rowtype;v_alvo_tipo text;v_alvo uuid;v_vencimento date;v_os integer;
begin
 if exists(select 1 from pcm.sso_chamados_ciclo_visita where ciclo_id=p_ciclo)
   or exists(select 1 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=cv.preparada_id
       join pcm.sso_vinculos_os_grupo og on og.ocorrencia_grupo_id=g.id where cv.ciclo_id=p_ciclo) then return 'indeterminado'; end if;
 select count(*),min(ponte.ocorrencia_legada_id::text)::uuid into v_total,v_legada
 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_vinculos_visita_legado ponte on ponte.ocorrencia_visita_id=cv.preparada_id
 where cv.ciclo_id=p_ciclo and ponte.cliente_id=p_cliente;
 if v_total=0 then return 'sem_vinculo'; end if;
 if v_total<>1 then return 'indeterminado'; end if;
 select c.alvo_tipo,c.alvo_id,o.vencimento_original into v_alvo_tipo,v_alvo,v_vencimento
 from pcm.sso_ciclos_visita_canonicos c join pcm.sso_ciclo_visita_versoes cv on cv.ciclo_id=c.id
 join pcm.sso_vinculos_visita_legado ponte on ponte.ocorrencia_visita_id=cv.preparada_id
 join pcm.ocorrencias_visita_preparadas o on o.id=cv.preparada_id
 where c.id=p_ciclo and c.plano_id=p_plano and ponte.ocorrencia_legada_id=v_legada and ponte.cliente_id=p_cliente;
 select leg.* into v_leg from pcm.ocorrencias_preventivas leg join pcm.planos_preventivos p on p.id=leg.plano_id
 where leg.id=v_legada and p.cliente_id=p_cliente and leg.vencimento=v_vencimento
 and ((v_alvo_tipo='sistema' and p.sistema_id=v_alvo) or (v_alvo_tipo='componente' and p.equipamento_id=v_alvo));
 if not found then return 'indeterminado'; end if;
 select count(*) into v_os from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada;
 if v_os=0 and v_leg.resultado_estado='pendente' and v_leg.envio_estado='prevista' and v_leg.auvo_task_id is null then return 'candidata'; end if;
 return 'indeterminado';
end; $$;
revoke all on function pcm.sso_estado_fila_visita(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_alterar_fila_visita(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid,p_acao text,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_oc pcm.ocorrencias_visita_preparadas%rowtype;v_ciclo uuid;v_fila pcm.sso_fila_visita%rowtype;
 v_ant pcm.sso_fila_visita_comandos%rowtype;v_estado text;v_payload jsonb;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
  or p_acao not in ('incluir','cancelar','confirmar') or p_acao is null or p_expected_revision is null or p_expected_revision<0
  or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'preparadaId',p_preparada_id,'acao',p_acao,'expectedRevision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-visita-request:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_fila_visita_comandos where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
  return v_ant.resultado;
 end if;
 lock table pcm.planos_manutencao,pcm.plano_versoes,pcm.ocorrencias_visita_preparadas,pcm.sso_ciclo_visita_versoes,
  pcm.sso_vinculos_visita_legado,pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,
  pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_visitas_suprimidas_feriado in share mode nowait;
 select o.* into v_oc from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
 where o.id=p_preparada_id and o.plano_id=p_plano_id and p.cliente_id=p_cliente_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 if p_acao<>'cancelar' and not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id and p.estado in ('aprovado','ativo')) then raise exception 'plano_inativo' using errcode='23514'; end if;
 select cv.ciclo_id into v_ciclo from pcm.sso_ciclo_visita_versoes cv join pcm.sso_ciclos_visita_canonicos c on c.id=cv.ciclo_id
 where cv.preparada_id=v_oc.id and cv.versao_id=v_oc.versao_id and c.plano_id=p_plano_id and c.rotina_logica_id=v_oc.rotina_logica_id
 and c.alvo_tipo=v_oc.alvo_tipo and c.alvo_id=v_oc.alvo_id and c.serie_id=v_oc.serie_id and c.semana_origem=v_oc.semana_origem;
 if v_ciclo is null then raise exception 'identidade_indisponivel' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-visita-ciclo:'||v_ciclo::text,0));
 select * into v_fila from pcm.sso_fila_visita where ciclo_id=v_ciclo for update;
 if p_acao='cancelar' then
  if v_fila.ciclo_id is null or v_fila.cliente_id is distinct from p_cliente_id or v_fila.plano_id is distinct from p_plano_id
   or v_fila.preparada_id is distinct from p_preparada_id or v_fila.estado not in ('aguardando','verificacao') or v_fila.revisao<>p_expected_revision then raise exception 'fila_ou_revisao_indisponivel' using errcode='40001'; end if;
  update pcm.sso_fila_visita set estado='cancelado',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_ciclo returning * into v_fila;
 else
  perform 1 from pcm.visitas v join pcm.visita_origem_contratual origem on origem.visita_id=v.id and origem.cliente_id=v.cliente_id
   where v.id=v_oc.visita_id and v.cliente_id=p_cliente_id and v.estado not in ('cancelada','concluida')
   and origem.serie_id=v_oc.serie_id and origem.semana_origem=v_oc.semana_origem for update of v;
  if not found or exists(select 1 from pcm.sso_visitas_suprimidas_feriado where visita_id=v_oc.visita_id) then raise exception 'visita_indisponivel_ou_suprimida' using errcode='23514'; end if;
  perform pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente_id,p_preparada_id,'visita');
  v_estado:=pcm.sso_estado_fila_visita(p_cliente_id,p_plano_id,v_ciclo);
  if p_acao='incluir' then
   if v_fila.ciclo_id is not null or p_expected_revision<>0 then raise exception 'ciclo_ja_registrado' using errcode='23505'; end if;
   if v_estado not in ('candidata','sem_vinculo') then raise exception 'elegibilidade_nao_comprovada' using errcode='23514'; end if;
   insert into pcm.sso_fila_visita(ciclo_id,cliente_id,plano_id,preparada_id,estado,revisao)
   values(v_ciclo,p_cliente_id,p_plano_id,p_preparada_id,case when v_estado='candidata' then 'aguardando' else 'verificacao' end,1) returning * into v_fila;
  else
   if v_fila.ciclo_id is null or v_fila.cliente_id is distinct from p_cliente_id or v_fila.plano_id is distinct from p_plano_id
    or v_fila.preparada_id is distinct from p_preparada_id or v_fila.estado<>'verificacao' or v_fila.revisao<>p_expected_revision then raise exception 'fila_ou_revisao_indisponivel' using errcode='40001'; end if;
   if v_estado is distinct from 'candidata' then raise exception 'elegibilidade_nao_comprovada' using errcode='23514'; end if;
   update pcm.sso_fila_visita set estado='aguardando',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_ciclo returning * into v_fila;
  end if;
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'planoId',p_plano_id,'preparadaId',p_preparada_id,
 'cicloId',v_ciclo,'estado',v_fila.estado,'revision',v_fila.revisao,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_fila_visita_comandos(request_id,ator_id,cliente_id,ciclo_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,v_ciclo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'preventiva.fila_visita_'||p_acao,'planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_alterar_fila_visita(uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_alterar_fila_visita(uuid,uuid,uuid,uuid,text,integer,text) to authenticated;

create function pcm.sso_consultar_fila_visita(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,atualizado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;
begin
 perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select cv.ciclo_id into v_ciclo from pcm.sso_ciclo_visita_versoes cv join pcm.ocorrencias_visita_preparadas o on o.id=cv.preparada_id and o.versao_id=cv.versao_id
 join pcm.sso_ciclos_visita_canonicos c on c.id=cv.ciclo_id and c.plano_id=o.plano_id and c.rotina_logica_id=o.rotina_logica_id
 and c.alvo_tipo=o.alvo_tipo and c.alvo_id=o.alvo_id and c.serie_id=o.serie_id and c.semana_origem=o.semana_origem
 join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
 where o.id=p_preparada_id and o.plano_id=p_plano_id;
 if v_ciclo is null then raise exception 'identidade_indisponivel' using errcode='23514'; end if;
 return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao,o.vencimento_original,f.atualizado_em
 from pcm.sso_fila_visita f join pcm.ocorrencias_visita_preparadas o on o.id=f.preparada_id
 join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=o.id and cv.ciclo_id=f.ciclo_id
 where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.ciclo_id=v_ciclo;
end; $$;
revoke all on function pcm.sso_consultar_fila_visita(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_fila_visita(uuid,uuid,uuid) to authenticated;
