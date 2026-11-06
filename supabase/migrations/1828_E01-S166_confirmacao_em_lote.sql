-- ADR-1683: reduzir consultas repetidas sem alterar atomicidade, contrato ou gates.
do $$ begin
 if not has_function_privilege(current_user,'pcm.sso_lock_escritor_composicao(uuid,uuid)','EXECUTE')
   or not has_table_privilege(current_user,'pcm.visita_composicao_conferencia_gate','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_comandos','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_comandos','INSERT')
   or not has_table_privilege(current_user,'audit.events','INSERT') then
   raise exception 'owner_sem_privilegios_confirmacao_lote_v2' using errcode='42501';
 end if;
end $$;

create or replace function pcm.sso_confirmar_mudanca_dia_v2(p_ator uuid,p_mudanca_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_actor uuid:=auth.uid();v_head pcm.sso_mudancas_dia_v2%rowtype;v_gate pcm.sso_mudanca_dia_v2_gate%rowtype;
 v_serie pcm.calendario_contratual_series%rowtype;v_regra pcm.regras_visita_contratual%rowtype;
 v_item record;v_recebido jsonb;v_result jsonb;v_diff boolean;v_data date;v_cancelar boolean;
 v_supressao_id uuid;v_movidas integer:=0;v_suprimidas integer:=0;
 v_total_edicoes integer:=0;v_batch jsonb;v_composicao_habilitada boolean;
begin
 if v_actor is null or v_actor is distinct from p_ator or p_mudanca_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
   then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id;
 if not found or v_head.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||v_head.serie_id::text,0))
   then raise exception 'mudanca_dia_em_conflito' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id for update;
 if v_head.estado='aplicada' then return v_head.recibo; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||v_head.request_id::text,0));
 if exists(select 1 from pcm.calendario_contratual_comandos c where c.request_id=v_head.request_id) then
   raise exception 'request_id_conflitante' using errcode='23505'; end if;
 select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
 if not found or not v_gate.habilitado then raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if v_head.estado<>'pronta' or v_head.expira_em<=now() then raise exception 'fotografia_indisponivel' using errcode='55000'; end if;
 if v_head.total_itens>least(v_head.max_itens_snapshot,v_gate.max_itens)
   or v_head.total_bytes>least(v_head.max_bytes_snapshot,v_gate.max_bytes) then raise exception 'fotografia_excede_orcamento' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-geracao-visita-feriados-v1',0))
   or not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||v_head.cliente_id::text,0))
   then raise exception 'feriado_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- A composição segue o protocolo escritor -> Visita. Segure a configuração e
 -- adquira os advisory locks em ordem estável antes dos locks de tabela/linha;
 -- assim um escritor ativo não pode formar ciclo de espera com esta transação.
 select habilitado into v_composicao_habilitada
   from pcm.visita_composicao_conferencia_gate where id for share;
 if not found then raise exception 'composicao_gate_indisponivel' using errcode='55000'; end if;
 if v_composicao_habilitada then
   for v_item in select i.visita_id from pcm.sso_mudanca_dia_v2_itens i
     where i.mudanca_id=p_mudanca_id order by i.visita_id loop
     perform pcm.sso_lock_escritor_composicao(gen_random_uuid(),v_item.visita_id);
   end loop;
 end if;
 -- Match 1525's relation-lock order. NOWAIT means a writer already holding
 -- RowExclusive aborts this attempt before any source row or operational write.
 lock table pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_intencoes_os_grupo,
   pcm.sso_atestados_declarados_grupo,pcm.sso_fotos_atestado_grupo,pcm.sso_decisoes_foto_grupo,
   pcm.sso_quantidades_declaradas_grupo,pcm.sso_pendencias_tecnicas in share mode nowait;
 select * into v_serie from pcm.calendario_contratual_series s
   where s.id=v_head.serie_id and s.cliente_id=v_head.cliente_id for update;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 select * into v_regra from pcm.regras_visita_contratual r where r.id=v_head.regra_id and r.serie_id=v_head.serie_id for update;
 if not found or v_regra.numero is distinct from v_head.revisao_esperada then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_head.dia_semana=v_regra.dia_semana or v_head.vigencia<=v_regra.vigencia_inicio
   or v_head.vigencia<=(now() at time zone v_regra.fuso)::date
   or (v_regra.vigencia_fim is not null and v_head.vigencia>v_regra.vigencia_fim)
   then raise exception 'vigencia_ou_dia_invalido' using errcode='22023'; end if;
 -- Lock the candidate aggregates before comparing the snapshot. Writers in
 -- 0723/0796/0742/0744 lock prepared rows FOR UPDATE; 0815 uses FOR SHARE.
 -- NOWAIT preserves fail-closed behavior and avoids lock-order deadlocks.
 perform v.id from pcm.visitas v join pcm.sso_mudanca_dia_v2_itens i on i.visita_id=v.id
   where i.mudanca_id=p_mudanca_id order by v.id for update of v nowait;
 perform o.id from pcm.ocorrencias_visita_preparadas o
   join pcm.sso_mudanca_dia_v2_itens i on i.visita_id=o.visita_id
   where i.mudanca_id=p_mudanca_id order by o.id for update of o nowait;
 select exists(
   with atual as materialized (
     select c.* from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c
   ), fotografia as materialized (
     select i.visita_id,i.revisao_visita,i.semana_origem,i.inicio_original,i.fim_original,
       i.inicio_proposto,i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada
     from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id
   )
   select 1 from atual c full join fotografia i using (visita_id)
   where c.visita_id is null or i.visita_id is null
      or row(c.revisao_visita,c.semana_origem,c.inicio_original,c.fim_original,c.inicio_proposto,
        c.data_proposta,c.feriado_id,c.feriado_revisao,c.ocorrencia_esperada)
        is distinct from
         row(i.revisao_visita,i.semana_origem,i.inicio_original,i.fim_original,i.inicio_proposto,
        i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada)
 ) into v_diff;
 if v_diff then
   raise exception 'fotografia_visitas_alterada' using errcode='40001';
 end if;
 if config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- Validate the complete set before writes. One set-based pass replaces repeated
 -- per-Visit gate reads and nested existence queries on the 501-item path.
 if exists (
   select 1 from pcm.sso_mudanca_dia_v2_itens i join pcm.visitas v on v.id=i.visita_id
   where i.mudanca_id=p_mudanca_id and v.revisao is distinct from i.revisao_visita
 ) then raise exception 'fotografia_visitas_alterada' using errcode='40001'; end if;

 if exists (select 1 from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id and i.ocorrencia_esperada) then
   perform 1 from pcm.sso_ocorrencia_visita_suprimivel_gate where id and habilitado for share;
   if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;

   if exists(select 1 from pcm.sso_mudanca_dia_v2_itens i
     where i.mudanca_id=p_mudanca_id and i.ocorrencia_esperada and i.feriado_id is null) then
     perform 1 from pcm.sso_mudanca_dia_ocorrencia_gate where id and habilitado for share;
     if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
     if exists(select 1 from pcm.sso_mudanca_dia_v2_itens i
       join pcm.visita_ordens_servico vo on vo.visita_id=i.visita_id
       where i.mudanca_id=p_mudanca_id and i.ocorrencia_esperada and i.feriado_id is null) then
       raise exception 'ocorrencia_vinculada_exige_reconciliacao' using errcode='23514'; end if;
   end if;

   if exists(
     select 1 from pcm.sso_mudanca_dia_v2_itens i
     join pcm.ocorrencias_visita_preparadas o on o.visita_id=i.visita_id
     where i.mudanca_id=p_mudanca_id and i.ocorrencia_esperada and (
       exists(select 1 from pcm.sso_vinculos_visita_legado l where l.ocorrencia_visita_id=o.id)
       or exists(select 1 from pcm.sso_materializacoes_visita_legado m where m.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ciclo_visita_versoes c where c.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ciclo_visita_usos_versao c where c.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ocorrencias_grupo g where g.visita_preparada_id=o.id)
     )
   ) then raise exception 'ocorrencia_vinculada_exige_reconciliacao' using errcode='23514'; end if;
 end if;

 if exists(select 1 from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id and i.feriado_id is not null) then
   perform 1 from pcm.sso_supressao_visita_preexistente_gate where id and habilitado for share;
   if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
   perform 1 from pcm.sso_supressao_semana_gate where id and habilitado for share;
   if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
   if config.sso_autorizar_acao('visita.cancelar',v_head.cliente_id) is distinct from true then
     raise exception 'sem_acesso' using errcode='42501'; end if;
   for v_item in select distinct i.semana_origem from pcm.sso_mudanca_dia_v2_itens i
     where i.mudanca_id=p_mudanca_id and i.feriado_id is not null order by i.semana_origem loop
     if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||v_head.serie_id::text||':'||v_item.semana_origem::text,0))
       then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
   end loop;
   if exists(select 1 from pcm.sso_mudanca_dia_v2_itens i
     join pcm.visita_ordens_servico vo on vo.visita_id=i.visita_id
     where i.mudanca_id=p_mudanca_id and i.feriado_id is not null)
     or exists(select 1 from pcm.sso_mudanca_dia_v2_itens i
       join pcm.sso_supressoes_semana_feriado s on s.serie_id=v_head.serie_id and s.semana_origem=i.semana_origem
       where i.mudanca_id=p_mudanca_id and i.feriado_id is not null
         and not exists(select 1 from pcm.sso_revogacoes_supressao_semana r where r.supressao_id=s.id)) then
     raise exception 'semana_exige_reconciliacao' using errcode='23514'; end if;
   if exists(select 1 from pcm.sso_mudanca_dia_v2_itens i left join pcm.feriados_declarados f
       on f.id=i.feriado_id and f.cliente_id=v_head.cliente_id and f.ativo and f.revisao=i.feriado_revisao
     where i.mudanca_id=p_mudanca_id and i.feriado_id is not null and f.id is null) then
     raise exception 'impactos_alterados' using errcode='40001'; end if;
 end if;

 update pcm.regras_visita_contratual set vigencia_fim=v_head.vigencia-1 where id=v_regra.id;
 insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,
   deslocamento_minutos,fuso,vigencia_inicio,vigencia_fim,created_by)
 values(v_head.regra_nova_id,v_head.serie_id,v_regra.numero+1,v_regra.ancora_semana,v_head.dia_semana,
   v_regra.intervalo_semanas,v_regra.hora_inicio,v_regra.duracao_minutos,v_regra.deslocamento_minutos,
   v_regra.fuso,v_head.vigencia,v_regra.vigencia_fim,v_actor);

 -- A fotografia contém os dados antigos completos para auditoria equivalente ao
 -- comando individual. Só linhas sem feriado passam pelo caminho em conjunto.
 select coalesce(jsonb_agg(jsonb_build_object('visita_id',v.id,'request_id',gen_random_uuid(),'antes',to_jsonb(v)) order by v.id),'[]'::jsonb)
 into v_batch
 from pcm.sso_mudanca_dia_v2_itens i join pcm.visitas v on v.id=i.visita_id
 where i.mudanca_id=p_mudanca_id and i.feriado_id is null;
 v_total_edicoes:=jsonb_array_length(v_batch);

 if exists (
   select 1 from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
   join pcm.visitas v on v.id=b.visita_id
   where v.revisao is distinct from (b.antes->>'revisao')::integer
      or v.estado not in ('rascunho','planejada')
 ) then raise exception 'fotografia_visitas_alterada' using errcode='40001'; end if;
 if exists (
   select 1 from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
   join pcm.visitas v on v.id=b.visita_id
   where v.responsavel_id is not null and not exists (
     select 1 from pcm.funcionarios f where f.id=v.responsavel_id and f.ativo and f.deleted_at is null
   )
 ) then raise exception 'responsavel_invalido' using errcode='23514'; end if;
 perform f.id from pcm.funcionarios f
 join pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
   on f.id=(b.antes->>'responsavel_id')::uuid
 where f.ativo and f.deleted_at is null order by f.id for share of f;
 if exists (
   select 1 from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
   join pcm.visitas v on v.id=b.visita_id
   where v.local_id is not null and not exists (
     select 1 from pcm.locais l join pcm.areas a on a.id=l.area_id
     where l.id=v.local_id and l.area_id=v.area_id and a.cliente_id=v.cliente_id
       and l.deleted_at is null and a.deleted_at is null
   )
 ) then raise exception 'posicao_invalida_ou_de_outro_cliente' using errcode='23514'; end if;
 perform l.id from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
 join pcm.visitas v on v.id=b.visita_id
 join pcm.locais l on l.id=v.local_id and l.area_id=v.area_id
 join pcm.areas a on a.id=l.area_id and a.cliente_id=v.cliente_id
 where v.local_id is not null and l.deleted_at is null and a.deleted_at is null
 order by l.id for share of l,a;

 update pcm.visitas v set
   area_id=v.area_id,
   local_id=v.local_id,
   inicio_em=i.inicio_proposto,
   fim_em=i.inicio_proposto+(i.fim_original-i.inicio_original),
   fuso=v_regra.fuso,
   responsavel_id=v.responsavel_id,
   deslocamento_minutos=v.deslocamento_minutos,
   revisao=v.revisao+1,updated_at=now(),updated_by=v_actor
 from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
 join pcm.sso_mudanca_dia_v2_itens i on i.mudanca_id=p_mudanca_id and i.visita_id=b.visita_id
 where v.id=b.visita_id and v.revisao=i.revisao_visita and v.estado in ('rascunho','planejada');
 get diagnostics v_movidas = row_count;
 if v_movidas<>v_total_edicoes then raise exception 'edicao_divergente' using errcode='23514'; end if;

 insert into audit.events(actor_id,action,entity,entity_id,payload)
 select v_actor,'visita.editada','visitas',v.id,
   jsonb_build_object('requestId',b.request_id,'antes',b.antes,'depois',to_jsonb(v))
 from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
 join pcm.visitas v on v.id=b.visita_id;
 insert into pcm.visita_comandos(request_id,actor_id,cliente_id,payload,resultado)
 select b.request_id,v_actor,v.cliente_id,
   jsonb_build_object('tipo','editarVisita','expectedRevision',i.revisao_visita,'visitaId',v.id,
     'areaId',v.area_id,'localId',v.local_id,'inicioEm',v.inicio_em,'fimEm',v.fim_em,'fuso',v.fuso,
     'responsavelId',v.responsavel_id,'deslocamentoMinutos',v.deslocamento_minutos),
   jsonb_build_object('aggregateId',v.id,'revision',v.revisao,'state',v.estado,'created',false,
     'linkedIds',jsonb_build_object('clienteId',v.cliente_id),'warnings',jsonb_build_array(),'requestId',b.request_id)
 from pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb)
 join pcm.visitas v on v.id=b.visita_id
 join pcm.sso_mudanca_dia_v2_itens i on i.mudanca_id=p_mudanca_id and i.visita_id=b.visita_id;
 insert into pcm.sso_visita_regra_transicoes(visita_id,revisao_visita,serie_id,regra_anterior_id,regra_nova_id,
   inicio_anterior,fim_anterior,inicio_novo,fim_novo,request_id,ator_id)
 select i.visita_id,i.revisao_visita+1,v_head.serie_id,v_regra.id,v_head.regra_nova_id,
   i.inicio_original,i.fim_original,i.inicio_proposto,i.inicio_proposto+(i.fim_original-i.inicio_original),v_head.request_id,v_actor
 from pcm.sso_mudanca_dia_v2_itens i
 join pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb) on b.visita_id=i.visita_id
 where i.mudanca_id=p_mudanca_id;
 insert into pcm.sso_movimentos_ocorrencias_dia(request_id,ocorrencia_id,visita_id,cliente_id,vencimento_original,
   inicio_anterior,inicio_novo,revisao_visita,ator_id)
 select v_head.request_id,o.id,i.visita_id,v_head.cliente_id,o.vencimento_original,
   i.inicio_original,i.inicio_proposto,i.revisao_visita+1,v_actor
 from pcm.sso_mudanca_dia_v2_itens i
 join pg_catalog.jsonb_to_recordset(v_batch) as b(visita_id uuid,request_id uuid,antes jsonb) on b.visita_id=i.visita_id
 join pcm.ocorrencias_visita_preparadas o on o.visita_id=i.visita_id
 where i.mudanca_id=p_mudanca_id;

 -- Supressões por feriado seguem produtor/transição canônicos e regras próprias.
 for v_item in select i.*,v.revisao from pcm.sso_mudanca_dia_v2_itens i
   join pcm.visitas v on v.id=i.visita_id where i.mudanca_id=p_mudanca_id and i.feriado_id is not null
   order by v.id loop
   v_recebido:=pcm.sso_transicionar_visita_preparada(gen_random_uuid(),v_item.visita_id,v_item.revisao_visita,
     'cancelar',null,null,'Supressão por feriado na mudança de dia contratual');
   if v_recebido->>'aggregateId' is distinct from v_item.visita_id::text or v_recebido->>'state' is distinct from 'cancelada'
     or v_recebido->>'revision' is distinct from (v_item.revisao_visita+1)::text
     then raise exception 'cancelamento_divergente' using errcode='23514'; end if;
   insert into pcm.sso_supressoes_semana_feriado(request_id,cliente_id,serie_id,regra_id,semana_origem,data_contratual,feriado_id,feriado_revisao,ator_id)
     values(gen_random_uuid(),v_head.cliente_id,v_head.serie_id,v_head.regra_nova_id,v_item.semana_origem,v_item.data_proposta,
       v_item.feriado_id,v_item.feriado_revisao,v_actor) returning id into v_supressao_id;
   insert into pcm.sso_visitas_suprimidas_feriado(visita_id,supressao_id,cliente_id,ator_id)
     values(v_item.visita_id,v_supressao_id,v_head.cliente_id,v_actor);
   v_suprimidas:=v_suprimidas+1;
 end loop;
 v_result:=jsonb_build_object('requestId',v_head.request_id,'mudancaId',v_head.id,'serieId',v_head.serie_id,
   'regraId',v_head.regra_nova_id,'revision',v_regra.numero+1,'visitasMovidas',v_movidas,
   'visitasSuprimidas',v_suprimidas,'efeitoRemoto',false,'digest',v_head.digest_fotografia);
 insert into audit.events(actor_id,action,entity,entity_id,payload)
 values(v_actor,'calendario.dia_alterado_com_visitas_v2','calendario_contratual_series',v_head.serie_id,v_result);
 update pcm.sso_mudancas_dia_v2 set estado='aplicada',recibo=v_result,aplicada_em=now(),atualizado_em=now()
 where id=v_head.id;
 return v_result;
end $$;
revoke all on function pcm.sso_confirmar_mudanca_dia_v2(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_confirmar_mudanca_dia_v2(uuid,uuid) to authenticated;
