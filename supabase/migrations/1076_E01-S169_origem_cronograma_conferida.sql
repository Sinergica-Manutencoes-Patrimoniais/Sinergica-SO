-- ADR-0891: nenhuma ocorrência é entregue sem conferir origem na fotografia aprovada.
create function pcm.sso_ocorrencias_cronograma_conferidas(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_inicio date,p_fim date,p_apos_tipo text,p_apos_id uuid,p_limite integer)
returns table(tipo text,id uuid,cliente_id uuid,plano_id uuid,versao_id uuid,rotina_id uuid,alvo_id uuid,vencimento_original date,data_programada date,visita_estado text,visita_revisao integer,snapshot_hash text,completude text)
language plpgsql volatile security definer set search_path='' as $$
declare v_linha record; v_indice jsonb;
begin
 for v_linha in select * from pcm.sso_ocorrencias_cronograma_exportacao(p_cliente_id,p_plano_id,p_versao_id,p_inicio,p_fim,p_apos_tipo,p_apos_id,p_limite) loop
   if v_indice is null then
     -- O núcleo já autorizou e travou a versão; monta índice uma vez por página.
     select coalesce(jsonb_object_agg(r.item->>'id',jsonb_build_object('modo',r.item->>'modo','alvo',r.item->'alvo'->>'id')),'{}'::jsonb)
       into v_indice from pcm.plano_versoes v cross join lateral jsonb_array_elements(v.snapshot->'rotinas') r(item)
       where v.id=p_versao_id and v.plano_id=p_plano_id;
   end if;
   if v_indice->v_linha.rotina_id::text->>'modo' is distinct from v_linha.tipo
      or v_indice->v_linha.rotina_id::text->>'alvo' is distinct from v_linha.alvo_id::text then
     raise exception 'origem_cronograma_inconsistente' using errcode='23514';
   end if;
   tipo:=v_linha.tipo; id:=v_linha.id; cliente_id:=v_linha.cliente_id; plano_id:=v_linha.plano_id; versao_id:=v_linha.versao_id;
   rotina_id:=v_linha.rotina_id; alvo_id:=v_linha.alvo_id; vencimento_original:=v_linha.vencimento_original;
   data_programada:=v_linha.data_programada; visita_estado:=v_linha.visita_estado; visita_revisao:=v_linha.visita_revisao;
   snapshot_hash:=v_linha.snapshot_hash; completude:=v_linha.completude;
   return next;
 end loop;
end; $$;
revoke all on function pcm.sso_ocorrencias_cronograma_conferidas(uuid,uuid,uuid,date,date,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_ocorrencias_cronograma_conferidas(uuid,uuid,uuid,date,date,text,uuid,integer) to authenticated;
revoke execute on function pcm.sso_ocorrencias_cronograma_exportacao(uuid,uuid,uuid,date,date,text,uuid,integer) from public,anon,authenticated,service_role;
