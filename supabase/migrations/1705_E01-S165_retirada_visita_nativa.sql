-- ADR-1561: prova local restrita à retirada explícita de substituição já aprovada.
create function pcm.sso_visita_nativa_sem_execucao_sso(p_cliente uuid,p_plano uuid,p_preparada uuid,p_ciclo uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_foto jsonb;
begin
 lock table pcm.visitas,pcm.visita_origem_contratual,pcm.visita_ordens_servico,pcm.sso_visitas_suprimidas_feriado,pcm.feriados_declarados,pcm.regras_visita_contratual,pcm.sso_visita_regra_transicoes in share mode nowait;
 if pcm.sso_estado_fila_visita(p_cliente,p_plano,p_ciclo) is distinct from 'sem_vinculo' then return false;end if;
 if not exists(select 1 from pcm.ocorrencias_visita_preparadas o
  join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=o.id and cv.ciclo_id=p_ciclo
  join pcm.sso_ciclos_visita_canonicos c on c.id=cv.ciclo_id and c.plano_id=o.plano_id and c.rotina_logica_id=o.rotina_logica_id and c.alvo_tipo=o.alvo_tipo and c.alvo_id=o.alvo_id and c.serie_id=o.serie_id and c.semana_origem=o.semana_origem
  join pcm.planos_manutencao plano on plano.id=o.plano_id and plano.cliente_id=p_cliente
  join pcm.visitas vi on vi.id=o.visita_id and vi.cliente_id=p_cliente and vi.natureza='regular' and vi.estado in ('rascunho','planejada','confirmada')
  join pcm.visita_origem_contratual origem on origem.visita_id=vi.id and origem.cliente_id=p_cliente and origem.serie_id=o.serie_id and origem.semana_origem=o.semana_origem
  join pcm.regras_visita_contratual regra on regra.id=pcm.sso_regra_efetiva_visita(vi.id) and regra.serie_id=origem.serie_id
  where o.id=p_preparada and o.plano_id=p_plano and o.alvo_tipo in ('sistema','componente') and o.vencimento_original=origem.semana_origem+(regra.dia_semana-1)
   and not exists(select 1 from pcm.feriados_declarados feriado where feriado.cliente_id=p_cliente and feriado.ativo and feriado.data=o.vencimento_original and (feriado.contrato_id is null or feriado.contrato_id=origem.contrato_id))
   and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado f where f.visita_id=vi.id)
   and not exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=vi.id)) then return false;end if;
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,'visita');
 return coalesce(jsonb_array_length(v_foto->'os'),0)=0 and coalesce(jsonb_array_length(v_foto->'grupo'),0)=0
  and coalesce(jsonb_array_length(v_foto->'intencoes'),0)=0 and coalesce(jsonb_array_length(v_foto->'pendencias'),0)=0
  and coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)=0 and coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)=0;
end; $$;
revoke all on function pcm.sso_visita_nativa_sem_execucao_sso(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid)'::regprocedure);
 a text:=$a$where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.estado='aguardando'
     and o.vencimento_original>=s.vigencia$a$;
 b text:=$b$where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and (f.estado='aguardando' or (f.estado='verificacao' and exists(select 1 from pcm.sso_substituicoes_visita_aprovadas sv where sv.versao_id=s.versao_id and sv.preparada_id=o.id and sv.escolha_request_id=s.resolucao_request_id)))
     and o.vencimento_original>=s.vigencia$b$;
 c text:=$a$perform 1 from pcm.sso_fila_visita where ciclo_id=v_item.ciclo_id and cliente_id=p_cliente_id and plano_id=p_plano_id and estado='aguardando' and revisao=v_item.revisao for update nowait;$a$;
 e text:=$b$perform 1 from pcm.sso_fila_visita where ciclo_id=v_item.ciclo_id and cliente_id=p_cliente_id and plano_id=p_plano_id and estado in ('aguardando','verificacao') and revisao=v_item.revisao for update nowait;$b$;
 f text:=$a$(v_item.tipo='visita' and v_estado is distinct from 'candidata')$a$;
 g text:=$b$(v_item.tipo='visita' and v_estado is distinct from 'candidata' and not (exists(select 1 from pcm.sso_substituicoes_visita_aprovadas sv where sv.versao_id=v_item.versao_id and sv.preparada_id=v_item.preparada_id and sv.escolha_request_id=v_item.resolucao_request_id) and pcm.sso_visita_nativa_sem_execucao_sso(p_cliente_id,p_plano_id,v_item.preparada_id,v_item.ciclo_id)))$b$;
 h text:=$a$'vigencia',v_item.vigencia,'revisaoAnterior',v_item.revisao,'osAlteradas',false)$a$;
 i text:=$b$'vigencia',v_item.vigencia,'revisaoAnterior',v_item.revisao,'osAlteradas',false,'fontesExternasComprovadas',false)$b$;
 pos integer;
begin
 -- Há duas cláusulas idênticas para calendário/Visita: alterar somente a segunda.
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'filtro_fila_incompativel' using errcode='55000';end if;
 pos:=strpos(d,a);
 pos:=pos+length(a)-1+strpos(substr(d,pos+length(a)),a);
 d:=overlay(d placing b from pos for length(a));
 if (length(d)-length(replace(d,c,'')))/length(c)<>1 or (length(d)-length(replace(d,f,'')))/length(f)<>1 or (length(d)-length(replace(d,h,'')))/length(h)<>1 then raise exception 'retirada_nativa_incompativel' using errcode='55000';end if;
 execute replace(replace(replace(d,c,e),f,g),h,i);
end; $migracao$;
-- ACL prévia de 1674 é preservada pelo CREATE OR REPLACE.
