-- ADR-1082: base privada, com bloqueio para feriados e ocorrências existentes.
create table pcm.sso_mudanca_dia_atomica_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_mudanca_dia_atomica_gate(id,habilitado) values(true,false);
alter table pcm.sso_mudanca_dia_atomica_gate enable row level security;
alter table pcm.sso_mudanca_dia_atomica_gate force row level security;
revoke all on pcm.sso_mudanca_dia_atomica_gate from public,anon,authenticated,service_role;

create function pcm.sso_alterar_dia_com_visitas(
 p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_serie_id uuid,p_regra_nova_id uuid,
 p_expected_revision integer,p_dia_semana integer,p_vigencia date,p_revisoes jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_actor uuid:=auth.uid();v_serie pcm.calendario_contratual_series%rowtype;
 v_regra pcm.regras_visita_contratual%rowtype;v_comando pcm.calendario_contratual_comandos%rowtype;
 v_linha record;v_payload jsonb;v_resultado jsonb;v_recebido jsonb;v_data date;v_inicio timestamptz;v_fim timestamptz;
 v_total integer:=0;v_suprimidas integer:=0;v_informadas integer;v_itens jsonb:='[]'::jsonb;v_feriado pcm.feriados_declarados%rowtype;v_cancelar boolean;v_tem_ocorrencia boolean;v_revisao_informada jsonb;v_supressao_id uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if v_actor is null or v_actor is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_serie_id is null
   or p_regra_nova_id is null or p_expected_revision is null or p_expected_revision<1 or p_dia_semana is null or p_dia_semana not between 1 and 7
   or p_vigencia is null or not isfinite(p_vigencia) or jsonb_typeof(p_revisoes) is distinct from 'array'
   or jsonb_array_length(p_revisoes)>500 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_mudanca_dia_atomica_gate where id and habilitado for share;
 if not found then raise exception 'mudanca_atomica_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.calendario_alteracao_gate where id and habilitado for share;
 if not found then raise exception 'alteracao_calendario_bloqueada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if exists(select 1 from jsonb_array_elements(p_revisoes) x where jsonb_typeof(x)<>'object'
   or not (x ? 'visitaId' and x ? 'revisao') or (select count(*) from jsonb_object_keys(x)) not in (2,4)
   or exists(select 1 from jsonb_object_keys(x) k where k not in ('visitaId','revisao','feriadoEsperado','ocorrenciaEsperada'))
   or ((x ? 'feriadoEsperado')<>(x ? 'ocorrenciaEsperada'))
   or (x ? 'feriadoEsperado' and (jsonb_typeof(x->'feriadoEsperado') is distinct from 'boolean' or jsonb_typeof(x->'ocorrenciaEsperada') is distinct from 'boolean'))
   or coalesce(x->>'visitaId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or coalesce(x->>'revisao','') !~ '^[1-9][0-9]{0,8}$')
   or (select count(distinct x->>'visitaId') from jsonb_array_elements(p_revisoes) x)<>jsonb_array_length(p_revisoes)
   then raise exception 'revisoes_invalidas' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','alterarDiaComVisitas','clienteId',p_cliente_id,'serieId',p_serie_id,'regraNovaId',p_regra_nova_id,
   'expectedRevision',p_expected_revision,'diaSemana',p_dia_semana,'vigencia',p_vigencia,'revisoes',p_revisoes);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request_id;
 if found then
   if v_comando.actor_id is distinct from v_actor or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_comando.resultado;
 end if;
 select * into v_serie from pcm.calendario_contratual_series where id=p_serie_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 select * into v_regra from pcm.regras_visita_contratual where serie_id=p_serie_id order by numero desc limit 1 for update;
 if not found or v_regra.numero is distinct from p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if p_dia_semana=v_regra.dia_semana or p_vigencia<=v_regra.vigencia_inicio or p_vigencia<=(now() at time zone v_regra.fuso)::date
   or (v_regra.vigencia_fim is not null and p_vigencia>v_regra.vigencia_fim) then raise exception 'vigencia_ou_dia_invalido' using errcode='22023'; end if;
 for v_linha in
   select v.*,o.semana_origem from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id
   where o.serie_id=p_serie_id and o.cliente_id=p_cliente_id and v.estado in ('rascunho','planejada') and v.inicio_em>now()
     and pcm.sso_regra_efetiva_visita(v.id)=v_regra.id and v.fuso=v_regra.fuso
     and (v.inicio_em at time zone v_regra.fuso)::date=o.semana_origem+(v_regra.dia_semana-1)
     and (v.inicio_em at time zone v_regra.fuso)::time=v_regra.hora_inicio
     and not exists(select 1 from pcm.visita_transicoes_historico h where h.visita_id=v.id and h.acao='reprogramar')
     and greatest(o.semana_origem+(v_regra.dia_semana-1),o.semana_origem+(p_dia_semana-1))>=p_vigencia
   order by v.id for update of v
 loop
   if exists(select 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id
     where vo.visita_id=v_linha.id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null and (os.auvo_task_id is not null or os.auvo_sync_status is not null)) then continue; end if;
   v_data:=v_linha.semana_origem+(p_dia_semana-1);
   if v_data<p_vigencia then continue; end if;
   select x into v_revisao_informada from jsonb_array_elements(p_revisoes) x where (x->>'visitaId')::uuid=v_linha.id and (x->>'revisao')::integer=v_linha.revisao;
   if not found then raise exception 'fotografia_visitas_alterada' using errcode='40001'; end if;
   select * into v_feriado from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.ativo and f.data=v_data
     and (f.contrato_id is null or f.contrato_id=v_serie.contrato_id) order by f.id limit 1;
   v_cancelar:=found;
   select exists(select 1 from pcm.ocorrencias_visita_preparadas where visita_id=v_linha.id) into v_tem_ocorrencia;
   if v_revisao_informada ? 'feriadoEsperado' and ((v_revisao_informada->>'feriadoEsperado')::boolean is distinct from v_cancelar
     or (v_revisao_informada->>'ocorrenciaEsperada')::boolean is distinct from v_tem_ocorrencia) then raise exception 'impactos_alterados' using errcode='40001'; end if;
   if (v_cancelar or v_tem_ocorrencia) and not (v_revisao_informada ? 'feriadoEsperado') then raise exception 'impactos_exigem_confirmacao' using errcode='23514'; end if;
   if v_tem_ocorrencia then
     perform 1 from pcm.sso_ocorrencia_visita_suprimivel_gate where id and habilitado for share;
     if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
     if not v_cancelar then
       perform 1 from pcm.sso_mudanca_dia_ocorrencia_gate where id and habilitado for share;
       if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
       if exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v_linha.id) then raise exception 'ocorrencia_vinculada_exige_reconciliacao' using errcode='23514'; end if;
     end if;
     perform o.id from pcm.ocorrencias_visita_preparadas o where o.visita_id=v_linha.id order by o.id for update nowait;
     if exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.visita_id=v_linha.id and (
       exists(select 1 from pcm.sso_vinculos_visita_legado l where l.ocorrencia_visita_id=o.id)
       or exists(select 1 from pcm.sso_materializacoes_visita_legado m where m.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ciclo_visita_versoes c where c.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ciclo_visita_usos_versao c where c.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ocorrencias_grupo g where g.visita_preparada_id=o.id))) then
       raise exception 'ocorrencia_vinculada_exige_reconciliacao' using errcode='23514';
     end if;
   end if;
   if v_cancelar then
     perform 1 from pcm.sso_supressao_visita_preexistente_gate where id and habilitado for share;
     if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
     perform 1 from pcm.sso_supressao_semana_gate where id and habilitado for share;
     if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
     if config.sso_autorizar_acao('visita.cancelar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
     if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||p_serie_id::text||':'||v_linha.semana_origem::text,0)) then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
     if exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v_linha.id)
       or exists(select 1 from pcm.sso_supressoes_semana_feriado s where s.serie_id=p_serie_id and s.semana_origem=v_linha.semana_origem
         and not exists(select 1 from pcm.sso_revogacoes_supressao_semana r where r.supressao_id=s.id)) then raise exception 'semana_exige_reconciliacao' using errcode='23514'; end if;
   end if;
   if v_cancelar then v_inicio:=null;
   else
     v_inicio:=(v_data+v_regra.hora_inicio) at time zone v_regra.fuso;
     if (v_inicio at time zone v_regra.fuso)<>(v_data+v_regra.hora_inicio) then raise exception 'horario_civil_inexistente' using errcode='23514'; end if;
   end if;
   v_itens:=v_itens||jsonb_build_array(jsonb_build_object('visitaId',v_linha.id,'revision',v_linha.revisao,'inicio',v_inicio,
     'semana',v_linha.semana_origem,'dataProposta',v_data,'feriadoId',case when v_cancelar then v_feriado.id else null end,
     'feriadoRevision',case when v_cancelar then v_feriado.revisao else null end));
   if v_cancelar then v_suprimidas:=v_suprimidas+1; end if;
   v_total:=v_total+1;
 end loop;
 v_informadas:=jsonb_array_length(p_revisoes);
 if v_total<>v_informadas then raise exception 'fotografia_visitas_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.regras_visita_contratual set vigencia_fim=p_vigencia-1 where id=v_regra.id;
 insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,deslocamento_minutos,fuso,vigencia_inicio,vigencia_fim,created_by)
 values(p_regra_nova_id,p_serie_id,v_regra.numero+1,v_regra.ancora_semana,p_dia_semana,v_regra.intervalo_semanas,v_regra.hora_inicio,v_regra.duracao_minutos,v_regra.deslocamento_minutos,v_regra.fuso,p_vigencia,v_regra.vigencia_fim,v_actor);
 for v_linha in select v.*,(i->>'inicio')::timestamptz as novo_inicio,(i->>'semana')::date as semana_origem,(i->>'dataProposta')::date as data_proposta,
   (i->>'feriadoId')::uuid as feriado_id,(i->>'feriadoRevision')::integer as feriado_revision
   from jsonb_array_elements(v_itens) i join pcm.visitas v on v.id=(i->>'visitaId')::uuid order by v.id loop
   if v_linha.feriado_id is not null then
     v_recebido:=pcm.sso_transicionar_visita_preparada(gen_random_uuid(),v_linha.id,v_linha.revisao,'cancelar',null,null,'Supressão por feriado na mudança de dia contratual');
     if v_recebido->>'aggregateId' is distinct from v_linha.id::text or v_recebido->>'state' is distinct from 'cancelada'
       or v_recebido->>'revision' is distinct from (v_linha.revisao+1)::text then raise exception 'cancelamento_divergente' using errcode='23514'; end if;
     insert into pcm.sso_supressoes_semana_feriado(request_id,cliente_id,serie_id,regra_id,semana_origem,data_contratual,feriado_id,feriado_revisao,ator_id)
       values(gen_random_uuid(),p_cliente_id,p_serie_id,p_regra_nova_id,v_linha.semana_origem,v_linha.data_proposta,
         v_linha.feriado_id,v_linha.feriado_revision,v_actor) returning id into v_supressao_id;
     insert into pcm.sso_visitas_suprimidas_feriado(visita_id,supressao_id,cliente_id,ator_id)
       values(v_linha.id,v_supressao_id,p_cliente_id,v_actor);
     continue;
   end if;
   v_fim:=v_linha.novo_inicio+(v_linha.fim_em-v_linha.inicio_em);
   v_recebido:=pcm.sso_editar_visita(gen_random_uuid(),v_linha.revisao,v_linha.id,v_linha.area_id,v_linha.local_id,v_linha.novo_inicio,v_fim,v_linha.fuso,v_linha.responsavel_id,v_linha.deslocamento_minutos);
   insert into pcm.sso_visita_regra_transicoes(visita_id,revisao_visita,serie_id,regra_anterior_id,regra_nova_id,inicio_anterior,fim_anterior,inicio_novo,fim_novo,request_id,ator_id)
     values(v_linha.id,v_linha.revisao+1,p_serie_id,v_regra.id,p_regra_nova_id,v_linha.inicio_em,v_linha.fim_em,v_linha.novo_inicio,v_fim,p_request_id,v_actor);
   insert into pcm.sso_movimentos_ocorrencias_dia(request_id,ocorrencia_id,visita_id,cliente_id,vencimento_original,inicio_anterior,inicio_novo,revisao_visita,ator_id)
     select p_request_id,o.id,v_linha.id,p_cliente_id,o.vencimento_original,v_linha.inicio_em,v_linha.novo_inicio,v_linha.revisao+1,v_actor
     from pcm.ocorrencias_visita_preparadas o where o.visita_id=v_linha.id;
 end loop;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'serieId',p_serie_id,'regraId',p_regra_nova_id,'revision',v_regra.numero+1,'visitasMovidas',v_total-v_suprimidas,'visitasSuprimidas',v_suprimidas,'efeitoRemoto',false);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.dia_alterado_com_visitas','calendario_contratual_series',p_serie_id,v_resultado||jsonb_build_object('regraAnteriorId',v_regra.id,'vigencia',p_vigencia));
 insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb) from public,anon,authenticated,service_role;
