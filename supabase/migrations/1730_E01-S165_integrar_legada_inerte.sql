-- ADR-1588: leitura por selo e declaração específicos, sem apagar histórico.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_reserva_rascunho_vigente(uuid,integer,text,uuid)'::regprocedure);
 a text:=$antes$if e.decisao='somente_sso' and exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=e.legado_id and l.indice=e.indice_legado) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;$antes$;
 b text:=$depois$if e.decisao='somente_sso' and exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=e.legado_id and l.indice=e.indice_legado and not exists(
  select 1 from pcm.sso_declaracoes_legada_inerte x where x.legada_id=l.id and x.escolha_request_id=e.request_id and x.cliente_id=e.cliente_id and x.plano_id=e.plano_id
   and x.sequencia=(select max(z.sequencia) from pcm.sso_declaracoes_legada_inerte z where z.legada_id=l.id and z.escolha_request_id=e.request_id)
   and x.fotografia->>'vencimento'=l.vencimento::text and x.fotografia->>'indice'=l.indice::text
   and l.origem='legado' and l.envio_estado='prevista' and l.resultado_estado='pendente' and l.auvo_task_id is null
   and l.visita_em is null and l.tecnico_funcionario_id is null
   and not exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=l.id)
   and not exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=l.id)
   and not exists(select 1 from pcm.ocorrencias_rotina_vinculos b where b.ocorrencia_legada_id=l.id)
   and not exists(select 1 from pcm.sso_vinculos_visita_legado b where b.ocorrencia_legada_id=l.id))) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;$depois$;
 c text:=$antes$pcm.plano_versoes,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait$antes$;
 e text:=$depois$pcm.plano_versoes,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados,pcm.sso_declaracoes_legada_inerte,pcm.avaliacoes_preventivas in share mode nowait$depois$;
 f text:=$antes$'modo',s.modo,'cicloId',s.ciclo_id)$antes$;
 g text:=$depois$'modo',s.modo,'cicloId',s.ciclo_id,'escolhaRequestId',e.request_id)$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1 or (length(d)-length(replace(d,f,'')))/length(f)<>1 then raise exception 'definicao_reserva_incompativel' using errcode='55000';end if;
 execute replace(replace(replace(d,a,b),c,e),f,g);
end; $migracao$;

-- Mesmo escopo de leitura PCM da tabela legado; apenas estados de IDs do Cliente informado.
create or replace function pcm.sso_estados_legadas_inertes(p_cliente uuid,p_legadas uuid[])
returns table(legada_id uuid,estado text) language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_leg pcm.ocorrencias_preventivas%rowtype;v_res jsonb;v_n integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if auth.uid() is null or not (coalesce(auth.jwt()->>'user_role','')='superadmin' or coalesce(auth.jwt()->'user_modulos'->>'pcm','') in ('leitura','escrita')) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_cliente is null or p_legadas is null or cardinality(p_legadas) not between 1 and 100 or array_position(p_legadas,null) is not null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if (select count(distinct x) from unnest(p_legadas) x)<>cardinality(p_legadas) then raise exception 'ids_duplicados' using errcode='22023';end if;
 perform 1 from pcm.ocorrencias_preventivas l join pcm.planos_preventivos p on p.id=l.plano_id and p.cliente_id=p_cliente where l.id=any(p_legadas) and l.origem='legado' for share of l,p nowait;
 select count(*) into v_n from pcm.ocorrencias_preventivas l join pcm.planos_preventivos p on p.id=l.plano_id and p.cliente_id=p_cliente where l.id=any(p_legadas) and l.origem='legado';
 if v_n<>cardinality(p_legadas) then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 foreach v_id in array p_legadas loop
  select * into v_leg from pcm.ocorrencias_preventivas where id=v_id for share nowait;
  if not exists(select 1 from pcm.sso_declaracoes_legada_inerte x where x.legada_id=v_id and x.cliente_id=p_cliente) then
   legada_id:=v_id;estado:='normal';return next;continue;
  end if;
  v_res:=pcm.sso_reserva_rascunho_vigente(v_leg.plano_id,v_leg.indice,null,null);
  if v_res is null or v_res->>'decisao' is distinct from 'somente_sso' or v_res->>'clienteId' is distinct from p_cliente::text
   or not exists(select 1 from pcm.sso_declaracoes_legada_inerte x where x.legada_id=v_id and x.cliente_id=p_cliente and x.escolha_request_id=(v_res->>'escolhaRequestId')::uuid) then
   raise exception 'declaracao_exige_reconciliacao' using errcode='23514';end if;
  legada_id:=v_id;estado:='substituida';return next;
 end loop;
end; $$;
revoke all on function pcm.sso_estados_legadas_inertes(uuid,uuid[]) from public,anon,authenticated,service_role;

-- Entradas mediadas: ator/Cliente/capacidade e gates sao revalidados pelo servidor.
grant execute on function pcm.sso_prever_reconciliacao_legada_sso(uuid,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_reconciliar_legada_sso(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) to authenticated;
grant execute on function pcm.sso_consultar_declaracao_legada_sso(uuid,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_listar_legadas_inertes_sso(uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_historico_declaracao_legada_sso(uuid,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_estados_legadas_inertes(uuid,uuid[]) to authenticated;
