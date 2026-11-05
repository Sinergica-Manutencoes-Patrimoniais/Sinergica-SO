-- ADR-1570. Base privada: nenhuma operação PCM é exposta nesta etapa.
create table pcm.sso_reservas_ciclo_legado (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 cliente_id uuid not null references pcm.clientes(id), plano_id uuid not null references pcm.planos_manutencao(id),
 legado_id uuid not null references pcm.planos_preventivos(id), indice_legado integer not null check(indice_legado>=0),
 modo text not null check(modo in ('calendario','visita')), ciclo_id uuid not null, preparada_id uuid not null,
 decisao text not null check(decisao in ('somente_sso','somente_legado','integrar_ponte')),
 ativa boolean not null default true, foto jsonb not null, motivo text not null check(length(btrim(motivo)) between 1 and 2000),
 revisao integer not null check(revisao>0), ator_id uuid not null references auth.users(id),
 criado_em timestamptz not null default now()
);
create unique index sso_reserva_legado_ativa on pcm.sso_reservas_ciclo_legado(legado_id,indice_legado) where ativa;
create unique index sso_reserva_ciclo_ativa on pcm.sso_reservas_ciclo_legado(modo,ciclo_id) where ativa;
alter table pcm.sso_reservas_ciclo_legado enable row level security;
alter table pcm.sso_reservas_ciclo_legado force row level security;
revoke all on pcm.sso_reservas_ciclo_legado from public,anon,authenticated,service_role;

-- Fotografia estrutural: não fotografa efeitos que a decisão legitimamente cria.
create function pcm.sso_foto_reserva_ciclo(p_plano uuid,p_legado uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('planoRevisao',p.revisao,'cliente',p.cliente_id,
  'legadoCliente',l.cliente_id,'sistema',l.sistema_id,'equipamento',l.equipamento_id,
  'primeiraData',l.primeira_data,'unidade',l.intervalo_unidade,'intervalo',l.intervalo_n,
  'questionario',l.questionario_id,'tipoTarefa',l.tipo_tarefa_id,'fuso',l.fuso,
  'relacaoAtual',(select jsonb_build_object('requestId',d.request_id,'decisao',d.decisao) from pcm.sso_declaracoes_planos_legados d where d.plano_id=p.id and d.plano_legado_id=l.id order by d.revisao desc limit 1),
  'naoRelacionadoAtual',(select n.request_id from pcm.sso_legados_nao_relacionados n where n.plano_id=p.id and n.legado_id=l.id order by n.criado_em desc,n.request_id desc limit 1))
 from pcm.planos_manutencao p join pcm.planos_preventivos l on l.id=p_legado where p.id=p_plano
$$;
revoke all on function pcm.sso_foto_reserva_ciclo(uuid,uuid) from public,anon,authenticated,service_role;

-- Chamada somente por escritores SECURITY DEFINER; serializa inclusive ausência de reserva.
create function pcm.sso_conferir_execucao_sso_reservada(p_cliente uuid,p_plano uuid,p_preparada uuid,p_modo text) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_res pcm.sso_reservas_ciclo_legado%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_modo='calendario' then
  select c.ciclo_id into v_ciclo from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_preparadas o on o.id=c.preparada_id join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_preparada and o.plano_id=p_plano and p.cliente_id=p_cliente;
 elsif p_modo='visita' then
  select c.ciclo_id into v_ciclo from pcm.sso_ciclo_visita_versoes c join pcm.ocorrencias_visita_preparadas o on o.id=c.preparada_id join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_preparada and o.plano_id=p_plano and p.cliente_id=p_cliente;
 else raise exception 'modo_invalido' using errcode='22023'; end if;
 if v_ciclo is null then raise exception 'ciclo_indisponivel' using errcode='23514'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-reserva-ciclo:'||p_modo||':'||v_ciclo::text,0)) then raise exception 'reserva_em_alteracao' using errcode='55P03'; end if;
 for v_res in select * from pcm.sso_reservas_ciclo_legado where modo=p_modo and ciclo_id=v_ciclo and ativa for share nowait loop
  perform 1 from pcm.planos_manutencao where id=v_res.plano_id for share nowait;
  perform 1 from pcm.planos_preventivos where id=v_res.legado_id for share nowait;
  if v_res.cliente_id is distinct from p_cliente or v_res.plano_id is distinct from p_plano
    or (v_res.foto - 'payload' - 'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(v_res.plano_id,v_res.legado_id) then
    raise exception 'reserva_obsoleta_exige_reconciliacao' using errcode='23514'; end if;
  if v_res.decisao='somente_legado' then raise exception 'ciclo_reservado_ao_legado' using errcode='23514'; end if;
  if v_res.decisao='integrar_ponte' and not (
   (p_modo='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and l.plano_id=v_res.legado_id and l.indice=v_res.indice_legado))
   or (p_modo='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and l.plano_id=v_res.legado_id and l.indice=v_res.indice_legado))
  ) then raise exception 'ponte_reservada_ausente' using errcode='23514'; end if;
 end loop;
end; $$;
revoke all on function pcm.sso_conferir_execucao_sso_reservada(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

-- Retorna verdadeiro somente para o índice específico expressamente reservado ao SSO.
create function pcm.sso_indice_legado_reservado_sso(p_legado uuid,p_indice integer) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare r pcm.sso_reservas_ciclo_legado%rowtype;
begin
 select * into r from pcm.sso_reservas_ciclo_legado where legado_id=p_legado and indice_legado=p_indice and ativa for share nowait;
 if not found then return false; end if;
 perform 1 from pcm.planos_manutencao where id=r.plano_id for share nowait;
 perform 1 from pcm.planos_preventivos where id=r.legado_id for share nowait;
 if (r.foto - 'payload' - 'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(r.plano_id,r.legado_id) then
  raise exception 'reserva_obsoleta_exige_reconciliacao' using errcode='23514'; end if;
 return r.decisao='somente_sso';
end; $$;
revoke all on function pcm.sso_indice_legado_reservado_sso(uuid,integer) from public,anon,authenticated,service_role;

-- Escritores fora do gerador em lote também precisam respeitar a mesma escolha.
create function pcm.sso_guardar_indice_legado_reservado() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 perform 1 from pcm.planos_preventivos where id=new.plano_id for share;
 if pcm.sso_indice_legado_reservado_sso(new.plano_id,new.indice) then
  raise exception 'indice_reservado_ao_sso' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_indice_legado_reservado() from public,anon,authenticated,service_role;
create trigger sso_guardar_indice_legado_reservado before insert or update of plano_id,indice,envio_estado
 on pcm.ocorrencias_preventivas for each row execute function pcm.sso_guardar_indice_legado_reservado();

-- O job do Plano legado ignora apenas o índice explicitamente reservado ao SSO.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.materializar_ocorrencias_preventivas(uuid,date)'::regprocedure);
 a text:='if v_data <= p_ate then';
 b text:='if v_data <= p_ate and not pcm.sso_indice_legado_reservado_sso(p_plano_id,v_indice) then';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'gerador_legado_incompativel' using errcode='55000'; end if;
 execute replace(d,a,b);
end; $migracao$;

-- Contrato privado até revisão e provas: escolhe somente um par explícito.
create function pcm.sso_decidir_reserva_ciclo_legado(
 p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_legado uuid,p_indice integer,
 p_modo text,p_preparada uuid,p_decisao text,p_revisao_plano integer,p_revisao_reserva integer,
 p_confirmado boolean,p_motivo text,p_foto_esperada jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_leg pcm.planos_preventivos%rowtype;v_ant pcm.sso_reservas_ciclo_legado%rowtype;
 v_revisao integer;v_existente uuid;v_foto jsonb;v_payload jsonb;v_resultado jsonb;
 v_motivo text:=nullif(btrim(p_motivo),'');v_vencimento date;v_alvo_tipo text;v_alvo uuid;
begin
 if p_request is null or p_cliente is null or p_plano is null or p_legado is null or p_indice is null or p_indice<0
  or p_modo is null or p_modo not in ('calendario','visita') or p_decisao is null or p_decisao not in ('somente_sso','somente_legado','integrar_ponte')
  or p_preparada is null or p_revisao_plano is null or p_revisao_reserva is null or p_revisao_reserva<0
  or p_confirmado is distinct from true or p_foto_esperada is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'decisao_invalida' using errcode='22023';end if;
 if p_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,true);
 else perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,true);end if;
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'legado',p_legado,'indice',p_indice,'modo',p_modo,
  'preparada',p_preparada,'decisao',p_decisao,'planoRevisao',p_revisao_plano,'reservaRevisao',p_revisao_reserva,'motivo',v_motivo,'fotoEsperada',p_foto_esperada);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-request:'||p_request::text,0));
 select * into v_ant from pcm.sso_reservas_ciclo_legado where request_id=p_request;
 if found then
  if v_ant.ator_id is distinct from p_ator or v_ant.foto->'payload' is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
  return jsonb_build_object('requestId',p_request,'reservaId',v_ant.id,'revisao',v_ant.revisao,'decisao',v_ant.decisao,'replay',true);
 end if;
 if p_modo='calendario' then
  select c.ciclo_id,o.vencimento_original,o.alvo_tipo,o.alvo_id into v_ciclo,v_vencimento,v_alvo_tipo,v_alvo
  from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_preparadas o on o.id=c.preparada_id
  where o.id=p_preparada and o.plano_id=p_plano;
 else
  select c.ciclo_id,o.vencimento_original,o.alvo_tipo,o.alvo_id into v_ciclo,v_vencimento,v_alvo_tipo,v_alvo
  from pcm.sso_ciclo_visita_versoes c join pcm.ocorrencias_visita_preparadas o on o.id=c.preparada_id
  where o.id=p_preparada and o.plano_id=p_plano;
 end if;
 if v_ciclo is null then raise exception 'ciclo_indisponivel' using errcode='23514';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-ciclo:'||p_modo||':'||v_ciclo::text,0)) then raise exception 'ciclo_em_uso' using errcode='55P03';end if;
 select revisao into v_revisao from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 if v_revisao is distinct from p_revisao_plano then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select * into v_leg from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 if not ((v_alvo_tipo='sistema' and v_leg.sistema_id=v_alvo) or (v_alvo_tipo='componente' and v_leg.equipamento_id=v_alvo)) then raise exception 'alvo_incompativel' using errcode='23514';end if;
 -- Mesmo após conferência explícita, ambas datas são apresentadas e não há inferência geral.
 if pcm.sso_vencimento_ciclo_calendario(v_leg.primeira_data,v_leg.intervalo_n,v_leg.intervalo_unidade,p_indice) is distinct from v_vencimento then raise exception 'datas_diferentes_exigem_reconciliacao' using errcode='23514';end if;
 lock table pcm.ordens_servico,pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.os_rotina_vinculos_explicitos,pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;
 select id into v_existente from pcm.ocorrencias_preventivas where plano_id=p_legado and indice=p_indice for update nowait;
 if exists(select 1 from pcm.ocorrencias_preventivas l where l.id=v_existente and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente'))
  or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_existente) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
 if not exists(select 1 from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano and d.plano_legado_id=p_legado and d.cliente_id=p_cliente and d.decisao='declarar' and d.revisao=(select max(x.revisao) from pcm.sso_declaracoes_planos_legados x where x.plano_id=p_plano and x.plano_legado_id=p_legado)) then raise exception 'relacao_positiva_necessaria' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_legados_nao_relacionados n where n.plano_id=p_plano and n.legado_id=p_legado and n.criado_em >= (select d.criado_em from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano and d.plano_legado_id=p_legado order by d.revisao desc limit 1)) then raise exception 'classificacao_negativa_exige_reconciliacao' using errcode='23514'; end if;
 if p_modo='calendario' and (exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.os_rotina_vinculos_explicitos x on x.ocorrencia_preparada_id=c.preparada_id where c.ciclo_id=v_ciclo) or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and (l.plano_id<>p_legado or l.indice<>p_indice))) then raise exception 'efeito_ou_ponte_divergente' using errcode='23514'; end if;
 if p_modo='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and (l.plano_id<>p_legado or l.indice<>p_indice)) then raise exception 'ponte_divergente' using errcode='23514'; end if;
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado);
 if p_foto_esperada is distinct from (v_foto||jsonb_build_object('modo',p_modo,'cicloId',v_ciclo,'preparadaId',p_preparada,'indiceLegado',p_indice,'vencimento',v_vencimento)) then raise exception 'fotografia_obsoleta' using errcode='40001'; end if;
 if p_decisao='somente_sso' and v_existente is not null then raise exception 'legada_existente_exige_reconciliacao' using errcode='23514';end if;
 if (p_modo='calendario' and (exists(select 1 from pcm.sso_chamados_ciclo_preventivo where ciclo_id=v_ciclo)
     or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=c.preparada_id where c.ciclo_id=v_ciclo)))
  or (p_modo='visita' and (exists(select 1 from pcm.sso_chamados_ciclo_visita where ciclo_id=v_ciclo)
     or exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=c.preparada_id where c.ciclo_id=v_ciclo))) then raise exception 'efeito_sso_exige_reconciliacao' using errcode='23514';end if;
 if p_decisao='integrar_ponte' and not (
  (p_modo='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and l.plano_id=p_legado and l.indice=p_indice))
  or (p_modo='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and l.plano_id=p_legado and l.indice=p_indice))
 ) then raise exception 'ponte_necessaria' using errcode='23514';end if;
 select * into v_ant from pcm.sso_reservas_ciclo_legado where legado_id=p_legado and indice_legado=p_indice and ativa for update;
 if found and (v_ant.modo is distinct from p_modo or v_ant.ciclo_id is distinct from v_ciclo or v_ant.cliente_id is distinct from p_cliente) then raise exception 'reserva_conflitante' using errcode='23505';end if;
 if coalesce(v_ant.revisao,0)<>p_revisao_reserva then raise exception 'reserva_obsoleta' using errcode='40001';end if;
 if v_ant.id is not null then update pcm.sso_reservas_ciclo_legado set ativa=false where id=v_ant.id;end if;
 if p_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 else perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false); end if;
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado);
 insert into pcm.sso_reservas_ciclo_legado(request_id,cliente_id,plano_id,legado_id,indice_legado,modo,ciclo_id,preparada_id,decisao,foto,motivo,revisao,ator_id)
  values(p_request,p_cliente,p_plano,p_legado,p_indice,p_modo,v_ciclo,p_preparada,p_decisao,v_foto||jsonb_build_object('payload',v_payload,'confirmacao',p_foto_esperada),v_motivo,p_revisao_reserva+1,p_ator) returning id into v_existente;
 v_resultado:=jsonb_build_object('requestId',p_request,'reservaId',v_existente,'revisao',p_revisao_reserva+1,'decisao',p_decisao,'replay',false);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'calendario.reserva_ciclo_legado','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',v_motivo,'payload',v_payload));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_reserva_ciclo_legado(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,text,integer,integer,boolean,text,jsonb) from public,anon,authenticated,service_role;

-- Exposição somente ao papel autenticado; as capacidades são revalidadas pelo mediador.
grant execute on function pcm.sso_decidir_reserva_ciclo_legado(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,text,integer,integer,boolean,text,jsonb) to authenticated;
