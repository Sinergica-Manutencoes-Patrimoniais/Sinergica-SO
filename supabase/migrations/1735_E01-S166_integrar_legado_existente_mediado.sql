-- ADR-1593: expõe apenas o vínculo explícito já protegido pelo núcleo 0718.
-- Uma avaliação pendente de consolidação também impede indicar elegibilidade.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_estado_ocorrencia_vinculada_base_1524(uuid,uuid,uuid)'::regprocedure);
 a text:=$antes$  select count(*), count(*) filter (where os.client_id=p_cliente_id and os.deleted_at is null),$antes$;
 b text:=$depois$  lock table pcm.avaliacoes_preventivas in share mode nowait;
  select count(*), count(*) filter (where os.client_id=p_cliente_id and os.deleted_at is null),$depois$;
 c text:=$antes$    when v_leg.resultado_estado='pendente' and v_total=0 and v_leg.envio_estado='prevista' and v_leg.auvo_task_id is null then 'candidata_aguardando'$antes$;
 e text:=$depois$    when v_leg.resultado_estado='pendente' and exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=v_leg.id) then 'indeterminado'
    when v_leg.resultado_estado='pendente' and v_total=0 and v_leg.envio_estado='prevista' and v_leg.auvo_task_id is null then 'candidata_aguardando'$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1 then raise exception 'estado_legado_incompativel' using errcode='55000';end if;
 execute replace(replace(d,a,b),c,e);
end; $migracao$;

-- Garante que evidência de execução não seja tratada como ocorrência inerte.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_integrar_ciclo_legado_existente(uuid,uuid,uuid,uuid,uuid,uuid,text)'::regprocedure);
 a text:=$antes$ v_vinculo:=pcm.sso_vincular_ocorrencia_preparada(gen_random_uuid(),p_preparada_id,p_ciclo_id,p_legada_id);$antes$;
 b text:=$depois$ lock table pcm.avaliacoes_preventivas in share mode nowait;
 if exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=p_legada_id) then raise exception 'legada_exige_reconciliacao' using errcode='23514';end if;
 v_vinculo:=pcm.sso_vincular_ocorrencia_preparada(gen_random_uuid(),p_preparada_id,p_ciclo_id,p_legada_id);$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'integracao_legada_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

create function pcm.sso_integrar_legado_existente_mediado(p_ator uuid,p_request uuid,p_cliente uuid,p_preparada uuid,p_legada uuid,p_ciclo uuid,p_relacao uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,true);
 r:=pcm.sso_integrar_ciclo_legado_existente(p_request,p_cliente,p_preparada,p_legada,p_ciclo,p_relacao,p_motivo);
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 return r;
end; $$;
revoke all on function pcm.sso_integrar_legado_existente_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_integrar_legado_existente_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) to authenticated;

-- Leitura e uso da fila consultam todas as pontes da identidade canônica.
create function pcm.sso_ciclo_tem_avaliacao_legada(p_ciclo uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' or p_ciclo is null then raise exception 'transacao_invalida' using errcode='25001';end if;
 lock table pcm.sso_ciclo_calendario_versoes,pcm.ocorrencias_rotina_vinculos,pcm.avaliacoes_preventivas in share mode nowait;
 return exists(select 1 from pcm.sso_ciclo_calendario_versoes cv join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=cv.preparada_id join pcm.avaliacoes_preventivas av on av.ocorrencia_id=v.ocorrencia_legada_id where cv.ciclo_id=p_ciclo);
end; $$;
revoke all on function pcm.sso_ciclo_tem_avaliacao_legada(uuid) from public,anon,authenticated,service_role;

-- Projeção não muda o estado gravado nem a revisão; filtra pelo estado apresentado.
do $migracao$
declare i record;d text;a text:=$a$return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao$a$;
 b text:=$b$return query select f.ciclo_id,f.preparada_id,case when f.estado='aguardando' and pcm.sso_ciclo_tem_avaliacao_legada(f.ciclo_id) then 'verificacao' else f.estado end,f.revisao$b$;
 filtro text:=$a$(p_estado is null or f.estado=p_estado)$a$;
 filtro_novo text:=$b$(p_estado is null or (case when f.estado='aguardando' and pcm.sso_ciclo_tem_avaliacao_legada(f.ciclo_id) then 'verificacao' else f.estado end)=p_estado)$b$;
begin
 for i in select * from (values
  ('pcm.sso_listar_fila_preventiva_pcm(uuid,uuid,uuid,integer)',false),
  ('pcm.sso_consultar_entrada_fila_preventiva(uuid,uuid,uuid)',false),
  ('pcm.sso_listar_fila_preventiva_cronologica(uuid,uuid,text,date,date,date,uuid,integer)',true)
 ) x(assinatura,filtrada) loop
  d:=pg_catalog.pg_get_functiondef(i.assinatura::regprocedure);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'leitura_fila_incompativel: %',i.assinatura using errcode='55000';end if;
  d:=replace(d,a,b);
  if i.filtrada then
   if (length(d)-length(replace(d,filtro,'')))/length(filtro)<>1 then raise exception 'filtro_fila_incompativel' using errcode='55000';end if;
   d:=replace(d,filtro,filtro_novo);
  end if;
  execute d;
 end loop;
end; $migracao$;

-- Somente uma criação nova é bloqueada; replay conserva recibo existente.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_criar_chamado_ciclo_preventivo(uuid,uuid,uuid,uuid)'::regprocedure);
 a text:=$a$   if exists(select 1 from pcm.sso_fila_preventiva_pcm where ciclo_id=v_ciclo and estado='cancelado')$a$;
 b text:=$b$   if pcm.sso_ciclo_tem_avaliacao_legada(v_ciclo) then raise exception 'avaliacao_legada_exige_reconciliacao' using errcode='23514';end if;
   if exists(select 1 from pcm.sso_fila_preventiva_pcm where ciclo_id=v_ciclo and estado='cancelado')$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'criacao_chamado_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- Distingue verificação decorrente de avaliação, sem alterar estado persistido.
create function pcm.sso_consultar_entrada_fila_preventiva_v2(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,atualizado_em timestamptz,situacao_atual text)
language sql volatile security definer set search_path='' as $$
 select x.ciclo_id,x.preparada_id,x.estado,x.revisao,x.vencimento,x.atualizado_em,
  case when x.estado='cancelado' then 'cancelada' when pcm.sso_ciclo_tem_avaliacao_legada(x.ciclo_id) then 'verificacao' else 'conferida' end
 from pcm.sso_consultar_entrada_fila_preventiva(p_cliente_id,p_plano_id,p_preparada_id) x;
$$;
revoke all on function pcm.sso_consultar_entrada_fila_preventiva_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_entrada_fila_preventiva_v2(uuid,uuid,uuid) to authenticated;
