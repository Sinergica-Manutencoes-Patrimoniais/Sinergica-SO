-- ADR-1538: recuperação explícita sem criar ocorrência ou alterar OS.
create table pcm.sso_reaberturas_fila_grupo (
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 plano_id uuid not null references pcm.planos_manutencao(id), tipo text not null check(tipo in ('calendario','visita')),
 ciclo_id uuid not null, preparada_id uuid not null, payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_reaberturas_fila_grupo enable row level security;
alter table pcm.sso_reaberturas_fila_grupo force row level security;
revoke all on pcm.sso_reaberturas_fila_grupo from public,anon,authenticated,service_role;
create trigger sso_reaberturas_fila_grupo_imutaveis before update or delete on pcm.sso_reaberturas_fila_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_prever_fila_grupo_v2(p_ator uuid,p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;v_atual boolean;
begin
 v:=pcm.sso_prever_fila_grupo(p_ator,p_cliente,p_plano,p_preparada,p_tipo);
 v_atual:=pcm.sso_declaracao_fila_grupo_atual(p_cliente,p_plano,p_preparada,p_tipo);
 return v||jsonb_build_object('declaracaoAtual',v_atual,'podeReabrir',v->>'filaEstado'='aguardando' and not v_atual);
end; $$;
revoke all on function pcm.sso_prever_fila_grupo_v2(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_fila_grupo_v2(uuid,uuid,uuid,uuid,text) to authenticated;

create function pcm.sso_reabrir_fila_grupo(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text,p_fila_revisao integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_revisao integer;v_estado text;v_payload jsonb;v_resultado jsonb;v_ant pcm.sso_reaberturas_fila_grupo%rowtype;
begin
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 if p_request is null or p_preparada is null or p_fila_revisao is null or p_fila_revisao<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente,'planoId',p_plano,'preparadaId',p_preparada,'tipo',p_tipo,'filaRevisao',p_fila_revisao,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-grupo-reabertura:'||p_request::text,0));
 select * into v_ant from pcm.sso_reaberturas_fila_grupo where request_id=p_request;
 if found then
  if v_ant.ator_id is distinct from p_ator or v_ant.cliente_id is distinct from p_cliente or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505';end if;
  return v_ant.resultado;
 end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 if p_tipo='calendario' then
  select q.ciclo_id into v_ciclo from pcm.sso_fila_preventiva_pcm q join pcm.ocorrencias_rotina_preparadas o on o.id=q.preparada_id and o.plano_id=q.plano_id
   where q.cliente_id=p_cliente and q.plano_id=p_plano and q.preparada_id=p_preparada and o.alvo_tipo='grupo';
 else
  select q.ciclo_id into v_ciclo from pcm.sso_fila_visita q join pcm.ocorrencias_visita_preparadas o on o.id=q.preparada_id and o.plano_id=q.plano_id
   where q.cliente_id=p_cliente and q.plano_id=p_plano and q.preparada_id=p_preparada and o.alvo_tipo='grupo';
 end if;
 if v_ciclo is null then raise exception 'fila_ou_grupo_indisponivel' using errcode='42501';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(case when p_tipo='calendario' then 'fila-preventiva-ciclo:' else 'fila-visita-ciclo:' end||v_ciclo::text,0)) then raise exception 'fila_em_alteracao' using errcode='55P03';end if;
 if p_tipo='calendario' then
  select q.estado,q.revisao into v_estado,v_revisao from pcm.sso_fila_preventiva_pcm q where q.ciclo_id=v_ciclo and q.cliente_id=p_cliente and q.plano_id=p_plano and q.preparada_id=p_preparada for update nowait;
 else
  select q.estado,q.revisao into v_estado,v_revisao from pcm.sso_fila_visita q where q.ciclo_id=v_ciclo and q.cliente_id=p_cliente and q.plano_id=p_plano and q.preparada_id=p_preparada for update nowait;
 end if;
 if not found or v_estado<>'aguardando' or v_revisao<>p_fila_revisao then raise exception 'fila_ou_revisao_indisponivel' using errcode='40001';end if;
 if pcm.sso_declaracao_fila_grupo_atual(p_cliente,p_plano,p_preparada,p_tipo) then raise exception 'declaracao_ainda_atual' using errcode='23514';end if;
 if p_tipo='calendario' then update pcm.sso_fila_preventiva_pcm set estado='verificacao',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_ciclo returning revisao into v_revisao;
 else update pcm.sso_fila_visita set estado='verificacao',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_ciclo returning revisao into v_revisao;end if;
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 v_resultado:=jsonb_build_object('requestId',p_request,'clienteId',p_cliente,'planoId',p_plano,'preparadaId',p_preparada,'tipo',p_tipo,'cicloId',v_ciclo,'estado','verificacao','revision',v_revisao,'ocorrenciaCriada',false,'osAlteradas',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_reaberturas_fila_grupo(request_id,ator_id,cliente_id,plano_id,tipo,ciclo_id,preparada_id,payload,resultado) values(p_request,p_ator,p_cliente,p_plano,p_tipo,v_ciclo,p_preparada,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'preventiva.fila_grupo_reaberta','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reabrir_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reabrir_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text) to authenticated;

-- Bloqueia novo Chamado de Grupo quando fila existente ou declaração estão obsoletas.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_criar_chamado_ciclo_preventivo(uuid,uuid,uuid,uuid)'::regprocedure);
 v_antes text:=$antes$   if exists(select 1 from pcm.sso_fila_preventiva_pcm where ciclo_id=v_ciclo and estado='cancelado')$antes$;
 v_depois text:=$depois$   if v_oc.alvo_tipo='grupo' then
    perform 1 from pcm.sso_fila_preventiva_pcm_gate where id and habilitado for share;
    if found then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-preventiva-ciclo:'||v_ciclo::text,0));
    if exists(select 1 from pcm.sso_fila_preventiva_pcm q where q.ciclo_id=v_ciclo and q.estado<>'aguardando') then raise exception 'fila_grupo_nao_aguardando' using errcode='23514';end if;
    if exists(select 1 from pcm.sso_fila_preventiva_pcm q where q.ciclo_id=v_ciclo and q.estado='aguardando')
      and not pcm.sso_declaracao_fila_grupo_atual(p_cliente_id,p_plano_id,p_preparada_id,'calendario') then raise exception 'fila_grupo_declaracao_obsoleta' using errcode='23514';end if;
    end if;
   end if;
   if exists(select 1 from pcm.sso_fila_preventiva_pcm where ciclo_id=v_ciclo and estado='cancelado')$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_chamado_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
