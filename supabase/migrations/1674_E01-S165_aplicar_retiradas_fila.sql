-- ADR-1531: comando explícito, limitado e idempotente; nenhuma escrita na consulta.
create table pcm.sso_aplicacoes_retirada_fila(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_aplicacoes_retirada_fila enable row level security;
alter table pcm.sso_aplicacoes_retirada_fila force row level security;
revoke all on pcm.sso_aplicacoes_retirada_fila from public,anon,authenticated,service_role;
create trigger sso_aplicacao_retirada_fila_imutavel before update or delete on pcm.sso_aplicacoes_retirada_fila for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_aplicar_retiradas_fila(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_limite integer,p_apos_tipo text,p_apos_ciclo uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_aplicacoes_retirada_fila%rowtype;v_payload jsonb;v_resultado jsonb;v_item record;v_estado text;v_foto jsonb;v_canceladas integer:=0;v_pendentes integer:=0;v_sem_permissao integer:=0;v_habilitado boolean;v_visita boolean;v_visitados integer:=0;v_ultimo_tipo text;v_ultimo_ciclo uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_limite is null or p_limite not between 1 and 50 or ((p_apos_tipo is null)<>(p_apos_ciclo is null)) or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 select habilitado into v_habilitado from pcm.sso_continuidade_revisao_gate where id for share;
 if v_habilitado is distinct from true then raise exception 'continuidade_desabilitada' using errcode='55000';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-aplicar-retiradas-fila:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'limite',p_limite,'aposTipo',p_apos_tipo,'aposCiclo',p_apos_ciclo);
 select * into v_ant from pcm.sso_aplicacoes_retirada_fila where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
  return v_ant.resultado;
 end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for share nowait;
 lock table pcm.plano_versoes,pcm.sso_retiradas_impacto_aprovadas,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas,
  pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado,pcm.planos_preventivos,pcm.ocorrencias_preventivas in share mode nowait;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_visita:=config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is true;
 for v_item in
  select * from (
   select 'calendario'::text tipo,f.ciclo_id,f.preparada_id,f.revisao,o.vencimento_original,s.versao_id,s.vigencia,s.resolucao_request_id
    from pcm.sso_fila_preventiva_pcm f join pcm.ocorrencias_rotina_preparadas o on o.id=f.preparada_id and o.plano_id=f.plano_id
    join pcm.sso_retiradas_impacto_aprovadas s on s.tipo='calendario' and s.preparada_id=o.id
    join pcm.plano_versoes v on v.id=s.versao_id and v.plano_id=f.plano_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
    where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.estado='aguardando'
     and o.vencimento_original>=s.vigencia and (v.vigencia_fim is null or o.vencimento_original<=v.vigencia_fim)
     and s.vigencia<=pcm.sso_data_civil_transicao_plano(p_plano_id,v.id,s.vigencia)
     and 1=(select count(*) from pcm.plano_versoes vs where vs.plano_id=p_plano_id and vs.estado='aprovado' and vs.vigencia_inicio<=o.vencimento_original and (vs.vigencia_fim is null or vs.vigencia_fim>=o.vencimento_original))
   union all
   select 'visita',f.ciclo_id,f.preparada_id,f.revisao,o.vencimento_original,s.versao_id,s.vigencia,s.resolucao_request_id
    from pcm.sso_fila_visita f join pcm.ocorrencias_visita_preparadas o on o.id=f.preparada_id and o.plano_id=f.plano_id
    join pcm.sso_retiradas_impacto_aprovadas s on s.tipo='visita' and s.preparada_id=o.id
    join pcm.plano_versoes v on v.id=s.versao_id and v.plano_id=f.plano_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
    where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.estado='aguardando'
     and o.vencimento_original>=s.vigencia and (v.vigencia_fim is null or o.vencimento_original<=v.vigencia_fim)
     and s.vigencia<=pcm.sso_data_civil_transicao_plano(p_plano_id,v.id,s.vigencia)
     and 1=(select count(*) from pcm.plano_versoes vs where vs.plano_id=p_plano_id and vs.estado='aprovado' and vs.vigencia_inicio<=o.vencimento_original and (vs.vigencia_fim is null or vs.vigencia_fim>=o.vencimento_original))
  ) x where p_apos_ciclo is null or (x.tipo,x.ciclo_id)>(p_apos_tipo,p_apos_ciclo) order by x.tipo,x.ciclo_id limit p_limite
 loop
  v_visitados:=v_visitados+1;v_ultimo_tipo:=v_item.tipo;v_ultimo_ciclo:=v_item.ciclo_id;
  if v_item.tipo='visita' and not v_visita then v_sem_permissao:=v_sem_permissao+1;continue;end if;
  if v_item.tipo='calendario' then
   perform 1 from pcm.sso_fila_preventiva_pcm where ciclo_id=v_item.ciclo_id and cliente_id=p_cliente_id and plano_id=p_plano_id and estado='aguardando' and revisao=v_item.revisao for update nowait;
  else
   perform 1 from pcm.sso_fila_visita where ciclo_id=v_item.ciclo_id and cliente_id=p_cliente_id and plano_id=p_plano_id and estado='aguardando' and revisao=v_item.revisao for update nowait;
  end if;
  if not found then raise exception 'fila_alterada' using errcode='40001';end if;
  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente_id,p_plano_id,v_item.preparada_id,v_item.tipo);
  if v_item.tipo='calendario' then v_estado:=pcm.sso_estado_ocorrencia_vinculada(p_cliente_id,p_plano_id,v_item.preparada_id)->>'estado';
  else v_estado:=pcm.sso_estado_fila_visita(p_cliente_id,p_plano_id,v_item.ciclo_id);end if;
  if (v_item.tipo='calendario' and v_estado is distinct from 'candidata_aguardando') or (v_item.tipo='visita' and v_estado is distinct from 'candidata')
    or jsonb_array_length(v_foto->'os')>0 or jsonb_array_length(v_foto->'grupo')>0 or jsonb_array_length(v_foto->'intencoes')>0
    or jsonb_array_length(v_foto->'chamadosCalendario')>0 or jsonb_array_length(v_foto->'chamadosVisita')>0 then
   v_pendentes:=v_pendentes+1;continue;
  end if;
  if v_item.tipo='calendario' then update pcm.sso_fila_preventiva_pcm set estado='cancelado',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_item.ciclo_id;
  else update pcm.sso_fila_visita set estado='cancelado',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_item.ciclo_id;end if;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'plano.retirada_aplicada_fila','planos_manutencao',p_plano_id,
   jsonb_build_object('requestId',p_request_id,'tipo',v_item.tipo,'cicloId',v_item.ciclo_id,'preparadaId',v_item.preparada_id,'resolucaoRequestId',v_item.resolucao_request_id,'vigencia',v_item.vigencia,'revisaoAnterior',v_item.revisao,'osAlteradas',false));
  v_canceladas:=v_canceladas+1;
 end loop;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or (v_visita and config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'planoId',p_plano_id,'canceladas',v_canceladas,'pendentesConferencia',v_pendentes,'visitasSemPermissao',v_sem_permissao,'visitadas',v_visitados,'ultimoTipo',v_ultimo_tipo,'ultimoCiclo',v_ultimo_ciclo,'maisPossivel',v_visitados=p_limite,'osAlteradas',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_aplicacoes_retirada_fila(request_id,ator_id,cliente_id,plano_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,p_plano_id,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid) to authenticated;
