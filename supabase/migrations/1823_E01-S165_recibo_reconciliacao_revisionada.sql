-- ADR-1681: recibo paginado, read-only e fail-closed da revisão S165.
create function pcm.sso_recibo_reconciliacao_revisao_mediado(
 p_ator uuid,p_cliente uuid,p_plano uuid,p_revisao integer,p_vigencia date,p_apos text default null,p_limite integer default 20
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 v_prev jsonb; v_anterior uuid; v_rascunho uuid; v_plano pcm.planos_manutencao%rowtype;
 v_preflight jsonb; v_calendario jsonb; v_visitas jsonb; v_os jsonb; v_grupos jsonb; v_reasons jsonb; v_block boolean;
 v_gate_preflight boolean; v_gate_impacto boolean; v_gate_decisoes boolean; v_gate_decisao_mediada boolean; v_gate_os boolean;
 v_itens jsonb; v_next text; v_total bigint; v_manter bigint; v_alterar bigint; v_retirar bigint; v_indeterminadas bigint;
 v_sem_ponte bigint; v_os_abertas bigint; v_os_divergentes bigint; v_more boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null
   or p_revisao is null or p_revisao<1 or p_limite is null or p_limite not between 1 and 50
   or (p_apos is not null and p_apos !~ '^(calendario|visita):[0-9a-fA-F-]{36}$') then
   raise exception 'consulta_invalida' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if v_plano.revisao<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_prev:=pcm.sso_previa_revisao_revisionada(p_plano,p_revisao,1,null);
 v_anterior:=(v_prev->>'versaoAnteriorId')::uuid; v_rascunho:=(v_prev->>'versaoRascunhoId')::uuid;

 v_gate_preflight:=coalesce((select habilitado from pcm.sso_guardar_impacto_aprovacao_gate where id),false);
 v_gate_impacto:=coalesce((select habilitado from pcm.sso_avaliacao_impacto_revisao_gate where id),false);
 v_gate_decisoes:=coalesce((select habilitado from pcm.sso_decisao_impacto_revisao_gate where id),false);
 v_gate_decisao_mediada:=coalesce((select habilitado from pcm.sso_decisao_impacto_mediada_gate where id),false);
 v_gate_os:=coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false);
 if v_gate_preflight then v_preflight:=pcm.sso_preflight_aprovacao_revisao(p_cliente,p_plano,p_revisao,p_vigencia);
 else v_preflight:=jsonb_build_object('status','bloqueado','motivoBloqueio','preflight_aprovacao_bloqueado','aprovacaoAutorizada',false); end if;
 if v_gate_impacto and v_gate_decisoes then
   v_calendario:=pcm.sso_avaliar_decisoes_impacto(p_cliente,p_plano,p_revisao);
   v_visitas:=pcm.sso_avaliar_fontes_impacto_visita_legado(p_cliente,p_plano,p_revisao);
 else
   v_calendario:=jsonb_build_object('status','bloqueado','motivoBloqueio','avaliacao_impacto_bloqueada','impactoIntegralComprovado',false,'aprovacaoAutorizada',false);
   v_visitas:=jsonb_build_object('status','bloqueado','motivoBloqueio','avaliacao_impacto_bloqueada','fontesCompletas',false,'aprovacaoAutorizada',false);
 end if;
 if v_gate_os then v_os:=pcm.sso_diagnosticar_os_revisao_plano(p_cliente,p_plano,p_revisao);
 else v_os:=jsonb_build_object('status','bloqueado','motivoBloqueio','impacto_revisao_bloqueado','fontesIncompletas',true,'ausenciaDeImpactoComprovada',false); end if;
 if v_gate_impacto and v_gate_decisoes and v_gate_decisao_mediada then v_grupos:=pcm.sso_avaliar_fotografias_grupo_mediada(p_ator,p_cliente,p_plano,p_revisao);
 else v_grupos:=jsonb_build_object('status','bloqueado','motivoBloqueio','decisao_impacto_mediada_bloqueada','fontesCompletas',false); end if;

 with anterior as (
   select x.item dados from pcm.plano_versoes v cross join lateral jsonb_array_elements(v.snapshot->'rotinas') x(item)
   where v.id=v_anterior
 ), nova as (
   -- A versão em rascunho ainda não tem snapshot aprovado. Suas rotinas
   -- canônicas estão nas linhas copiadas/editadas da própria versão.
   select to_jsonb(r) dados from pcm.rotinas_manutencao r
   where r.plano_id=p_plano and r.versao_id=v_rascunho
 ), preparadas as (
   select 'calendario'::text modo,o.id,o.rotina_logica_id,o.rotina_id,o.alvo_tipo,o.alvo_id,
     o.ciclo ciclo,o.vencimento_original,o.vencimento_original semana_origem,o.versao_id,
     (select a.dados from anterior a where a.dados->>'id'=o.rotina_id::text limit 1) rotina_anterior,
     (select count(*) from anterior a where a.dados->>'id'=o.rotina_id::text) n_anterior,
     (select count(*) from nova n where n.dados->>'rotina_logica_id'=o.rotina_logica_id::text) n_nova,
     (select min(n.dados::text)::jsonb from nova n where n.dados->>'rotina_logica_id'=o.rotina_logica_id::text) rotina_nova
   from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano and o.versao_id=v_anterior
   union all
   select 'visita',o.id,o.rotina_logica_id,o.rotina_id,o.alvo_tipo,o.alvo_id,null::integer,o.vencimento_original,o.semana_origem,o.versao_id,
     (select a.dados from anterior a where a.dados->>'id'=o.rotina_id::text limit 1),
     (select count(*) from anterior a where a.dados->>'id'=o.rotina_id::text),
     (select count(*) from nova n where n.dados->>'rotina_logica_id'=o.rotina_logica_id::text),
     (select min(n.dados::text)::jsonb from nova n where n.dados->>'rotina_logica_id'=o.rotina_logica_id::text)
   from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano and o.versao_id=v_anterior
 ), avaliadas as (
   select p.*,
     case when nullif(p.rotina_anterior->>'questionario_id','') is null and nullif(p.rotina_nova->>'questionario_id','') is null then 'sem_questionario'
       when not v_gate_os then 'comparacao_questionario_bloqueada'
       else coalesce(pcm.sso_comparar_questionario_revisao(p_cliente,p_plano,p_revisao,p.rotina_logica_id)->>'estadoComparacao','historico_indeterminado') end status_questionario,
     case when p.rotina_nova is null then null
       when p.rotina_nova->>'alvo_tipo'='sistema' then (p.rotina_nova->>'sistema_id')::uuid
       when p.rotina_nova->>'alvo_tipo'='componente' then (p.rotina_nova->>'equipamento_id')::uuid
       when p.rotina_nova->>'alvo_tipo'='grupo' then (p.rotina_nova->>'grupo_id')::uuid end novo_alvo,
     case when p.modo='calendario' and p.n_nova=1 and p.rotina_nova->>'modo'='calendario'
       and nullif(p.rotina_nova->>'data_base','') is not null and nullif(p.rotina_nova->>'intervalo_n','') is not null
       and p.rotina_nova->>'intervalo_unidade' in ('dias','semanas','meses','anos') and p.ciclo is not null
       then pcm.sso_vencimento_ciclo_calendario((p.rotina_nova->>'data_base')::date,
         (p.rotina_nova->>'intervalo_n')::integer,p.rotina_nova->>'intervalo_unidade',p.ciclo) end novo_vencimento
   from preparadas p
 ), linhas as (
   select a.*,
     case when n_anterior<>1 or n_nova>1 then 'indeterminada'
       when n_nova=0 then 'retirar'
       when status_questionario in ('historico_indeterminado','fonte_atual_indisponivel','nao_comparavel','comparacao_questionario_bloqueada') then 'indeterminada'
       when status_questionario in ('referencia_alterada','conteudo_integral_diferente') then 'alterar'
       when n_nova=1 and rotina_anterior is not null and rotina_nova is not null
         and rotina_anterior->>'alvo_tipo'=rotina_nova->>'alvo_tipo' and novo_alvo=alvo_id
         and pcm.sso_campos_rotina_previa(rotina_anterior,null) is not distinct from pcm.sso_campos_rotina_previa(rotina_nova,null)
         and (modo='visita' or novo_vencimento is not distinct from vencimento_original) then 'manter'
       else 'alterar' end classificacao,
     (modo='calendario' and not exists(select 1 from pcm.ocorrencias_rotina_vinculos b where b.ocorrencia_preparada_id=a.id))
       or (modo='visita' and not exists(select 1 from pcm.sso_vinculos_visita_legado b where b.ocorrencia_visita_id=a.id and b.cliente_id=p_cliente))
       or n_anterior<>1 or n_nova>1
       or status_questionario in ('historico_indeterminado','fonte_atual_indisponivel','nao_comparavel','comparacao_questionario_bloqueada')
       or (modo='calendario' and rotina_nova is not null and rotina_nova->>'modo'='calendario' and novo_vencimento is null) fonte_desconhecida,
     case when modo='calendario' then (select b.ocorrencia_legada_id from pcm.ocorrencias_rotina_vinculos b where b.ocorrencia_preparada_id=a.id)
       else (select b.ocorrencia_legada_id from pcm.sso_vinculos_visita_legado b where b.ocorrencia_visita_id=a.id and b.cliente_id=p_cliente) end legada_id
   from avaliadas a
 ), com_os as (
   select l.*,
     foto.efeitos,
     (select coalesce(jsonb_agg(jsonb_build_object('osId',s.id,'status',s.status,'atualizadaEm',s.updated_at) order by s.id),'[]'::jsonb)
       from (select distinct os.id,os.status,os.updated_at from pcm.ordens_servico os
         where os.deleted_at is null and os.status not in ('finalizado','cancelado') and os.client_id=p_cliente
           and (os.ocorrencia_preventiva_id=l.legada_id or exists(select 1 from jsonb_array_elements(coalesce(foto.efeitos->'os','[]'::jsonb)) e(item) where e.item->>'id'=os.id::text))
         order by os.id limit 101) s) os_abertas,
     exists(select 1 from pcm.ordens_servico os where os.deleted_at is null and os.client_id is distinct from p_cliente
       and (os.ocorrencia_preventiva_id=l.legada_id or exists(select 1 from jsonb_array_elements(coalesce(foto.efeitos->'os','[]'::jsonb)) e(item) where e.item->>'id'=os.id::text))) os_cliente_divergente,
     l.modo||':'||l.id::text chave
   from linhas l left join lateral (select pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,l.id,l.modo) efeitos) foto on true
 ), numeradas as (
   select *,count(*) over() total,
     count(*) filter(where classificacao='manter') over() n_manter,
     count(*) filter(where classificacao='alterar') over() n_alterar,
     count(*) filter(where classificacao='retirar') over() n_retirar,
     count(*) filter(where classificacao='indeterminada') over() n_indeterminada,
     count(*) filter(where fonte_desconhecida or jsonb_array_length(os_abertas)>100) over() n_desconhecida,
     count(*) filter(where os_cliente_divergente) over() n_divergente,
     sum(jsonb_array_length(os_abertas)) over() n_os
   from com_os
 ), selecionadas as (
   select *,row_number() over(order by chave) rn from numeradas where p_apos is null or chave>p_apos
 )
 select coalesce(jsonb_agg(jsonb_build_object('chave',chave,'modo',modo,'ocorrenciaId',id,'rotinaLogicaId',rotina_logica_id,
     'rotinaAnteriorId',rotina_id,'alvoAnterior',jsonb_build_object('tipo',alvo_tipo,'id',alvo_id),
     'alvoNovo',case when rotina_nova is null then null else jsonb_build_object('tipo',rotina_nova->>'alvo_tipo','id',novo_alvo) end,
     'ciclo',ciclo,'semanaOrigem',semana_origem,'vencimentoOriginal',vencimento_original,'novoVencimento',novo_vencimento,'estadoQuestionario',status_questionario,
     'classificacao',classificacao,'ponteLegadaComprovada',legada_id is not null,'ocorrenciaLegadaId',legada_id,
     'osAbertasComPonteComprovada',os_abertas,'fontesDesconhecidas',fonte_desconhecida or jsonb_array_length(os_abertas)>100,'osClienteDivergente',os_cliente_divergente)
     order by chave) filter(where rn<=p_limite),'[]'::jsonb),
   max(chave) filter(where rn=p_limite),max(total),max(n_manter),max(n_alterar),max(n_retirar),max(n_indeterminada),max(n_desconhecida),max(n_divergente),max(n_os),count(*)>p_limite
 into v_itens,v_next,v_total,v_manter,v_alterar,v_retirar,v_indeterminadas,v_sem_ponte,v_os_divergentes,v_os_abertas,v_more
 from selecionadas where rn<=p_limite+1;

 v_block:=not v_gate_preflight or not v_gate_impacto or not v_gate_decisoes or not v_gate_decisao_mediada or not v_gate_os
   or coalesce((v_preflight->>'snapshotAnteriorDisponivel')::boolean,false) is not true
   or coalesce((v_preflight->>'fusoPlanoDefinido')::boolean,false) is not true
   or coalesce((v_calendario->>'decisoesAusentes')::bigint,1)<>0
   or coalesce((v_calendario->>'decisoesObsoletas')::bigint,1)<>0
   or coalesce((v_calendario->>'exigemReconciliacao')::bigint,1)<>0
   or coalesce((v_calendario->>'fontesIndividuaisIncompletas')::bigint,1)<>0
   or coalesce((v_calendario->>'comOsClienteDivergente')::bigint,1)<>0
   or coalesce((v_visitas->>'visitasSemIdentidade')::bigint,1)<>0
   or coalesce((v_visitas->>'decisoesVisitaAusentes')::bigint,1)<>0
   or coalesce((v_visitas->>'decisoesVisitaObsoletas')::bigint,1)<>0
   or coalesce((v_visitas->>'visitasExigemReconciliacao')::bigint,1)<>0
   or coalesce((v_visitas->>'visitasSemPonteLegada')::bigint,1)<>0
   or coalesce((v_visitas->>'planosClienteSemRelacaoDeclarada')::bigint,1)<>0
   or coalesce((v_visitas->>'legadasSemPonteObservada')::bigint,1)<>0
   or coalesce((v_grupos->>'fotografiasAusentes')::bigint,1)<>0
   or coalesce((v_grupos->>'fotografiasObsoletas')::bigint,1)<>0
   or coalesce((v_os->>'osClienteDivergente')::bigint,1)<>0
   or coalesce(v_indeterminadas,0)>0 or coalesce(v_sem_ponte,0)>0 or coalesce(v_os_divergentes,0)>0 or coalesce(v_more,false);
 select coalesce(jsonb_agg(motivo),'[]'::jsonb) into v_reasons from (values
   ('preflight_aprovacao_bloqueado',not v_gate_preflight),('avaliacao_impacto_bloqueada',not v_gate_impacto or not v_gate_decisoes),
   ('decisao_impacto_mediada_bloqueada',not v_gate_decisao_mediada),
   ('diagnostico_os_bloqueado',not v_gate_os),('snapshot_ou_fuso_indisponivel',coalesce((v_preflight->>'snapshotAnteriorDisponivel')::boolean,false) is not true or coalesce((v_preflight->>'fusoPlanoDefinido')::boolean,false) is not true),
   ('ocorrencias_sem_decisao_atual',coalesce((v_calendario->>'decisoesAusentes')::bigint,1)<>0 or coalesce((v_calendario->>'decisoesObsoletas')::bigint,1)<>0 or coalesce((v_visitas->>'decisoesVisitaAusentes')::bigint,1)<>0 or coalesce((v_visitas->>'decisoesVisitaObsoletas')::bigint,1)<>0),
   ('fontes_ou_pontes_desconhecidas',coalesce(v_indeterminadas,0)>0 or coalesce(v_sem_ponte,0)>0 or coalesce((v_visitas->>'planosClienteSemRelacaoDeclarada')::bigint,1)<>0 or coalesce((v_visitas->>'legadasSemPonteObservada')::bigint,1)<>0),
   ('os_de_cliente_divergente',coalesce(v_os_divergentes,0)>0 or coalesce((v_calendario->>'comOsClienteDivergente')::bigint,1)<>0 or coalesce((v_os->>'osClienteDivergente')::bigint,1)<>0),
   ('fotografias_de_grupo_pendentes',coalesce((v_grupos->>'fotografiasAusentes')::bigint,1)<>0 or coalesce((v_grupos->>'fotografiasObsoletas')::bigint,1)<>0),
   ('recibo_paginado_incompleto',coalesce(v_more,false))
 ) bloqueios(motivo,bloqueado) where bloqueado;

 return jsonb_build_object('revision',p_revisao,'versaoAnteriorId',v_anterior,'versaoRascunhoId',v_rascunho,
   'nextCursor',case when v_more then v_next end,
   'limite',p_limite,'ocorrencias',v_itens,'ocorrenciasObservadas',coalesce(v_total,0),'aManter',coalesce(v_manter,0),
   'aAlterar',coalesce(v_alterar,0),'aRetirar',coalesce(v_retirar,0),'indeterminadas',coalesce(v_indeterminadas,0),
   'comFontesDesconhecidas',coalesce(v_sem_ponte,0),'osAbertasComPonteComprovada',coalesce(v_os_abertas,0),
   'osClienteDivergente',coalesce(v_os_divergentes,0),
   'visitasSemPonteLegada',nullif(v_visitas->>'visitasSemPonteLegada','')::integer,
   'planosLegadosSemRelacaoDeclarada',nullif(v_visitas->>'planosClienteSemRelacaoDeclarada','')::integer,
   'legadasSemPonteObservada',nullif(v_visitas->>'legadasSemPonteObservada','')::integer,
   'preflight',v_preflight,'impactoCalendario',v_calendario,
   'impactoVisitaLegado',v_visitas,'impactoGrupos',v_grupos,'diagnosticoOs',v_os,'fontesIncompletas',v_block,'impactoIntegralComprovado',not v_block,
   'confirmacaoBloqueada',v_block,'motivosBloqueio',v_reasons,
   'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_recibo_reconciliacao_revisao_mediado(uuid,uuid,uuid,integer,date,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_reconciliacao_revisao_mediado(uuid,uuid,uuid,integer,date,text,integer) to authenticated;
