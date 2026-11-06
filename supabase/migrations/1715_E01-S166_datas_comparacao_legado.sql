-- ADR-1571: datas teóricas para conferência humana, sem presumir equivalência.
create function pcm.sso_comparacao_datas_legado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_legado_id uuid,p_inicio date,p_fim date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resumo jsonb;v_legado pcm.planos_preventivos%rowtype;v_datas jsonb;v_sso integer;v_legado_n integer;v_comuns integer;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,false);
 lock table pcm.planos_manutencao,pcm.plano_versoes,pcm.planos_preventivos,pcm.sso_declaracoes_planos_legados in share mode nowait;
 v_resumo:=pcm.sso_comparar_calendario_legado(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_legado_id,p_inicio,p_fim);
 select * into v_legado from pcm.planos_preventivos where id=p_legado_id and cliente_id=p_cliente_id;
 with dias as (select p_inicio+n data from generate_series(0,p_fim-p_inicio) n),
 distancias as (select data,case when v_legado.intervalo_unidade='semanas' then data-v_legado.primeira_data else ((extract(year from data)::integer-extract(year from v_legado.primeira_data)::integer)*12+extract(month from data)::integer-extract(month from v_legado.primeira_data)::integer) end distancia,case when v_legado.intervalo_unidade='semanas' then 7*v_legado.intervalo_n else v_legado.intervalo_n end passo from dias),
 antigo as (select data,distancia/passo indice from distancias where case when distancia>=0 and mod(distancia,passo)=0 then pcm.sso_vencimento_ciclo_calendario(v_legado.primeira_data,v_legado.intervalo_n,v_legado.intervalo_unidade,distancia/passo)=data else false end),
 novo as (select vencimento data,ciclo indice from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim)),
 resultado as (select coalesce(n.data,a.data) data,n.data is not null sso,a.data is not null legado,n.indice indice_sso,a.indice indice_legado from novo n full join antigo a using(data))
 select coalesce(jsonb_agg(jsonb_build_object('data',data,'sso',sso,'legado',legado,'indiceSso',indice_sso,'indiceLegado',indice_legado) order by data),'[]'::jsonb),count(*) filter(where sso),count(*) filter(where legado),count(*) filter(where sso and legado)
 into v_datas,v_sso,v_legado_n,v_comuns from resultado;
 if v_sso is distinct from (v_resumo->>'ciclosSso')::integer or v_legado_n is distinct from (v_resumo->>'ciclosLegados')::integer or v_comuns is distinct from (v_resumo->>'datasComuns')::integer then raise exception 'comparacao_alterada' using errcode='40001';end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator_id,p_cliente_id,false);
 return v_resumo||jsonb_build_object('datas',v_datas,'datasTeoricas',true,'equivalenciaGeralComprovada',false,'impactoCalculado',false,'geradorAlterado',false);
end; $$;
revoke all on function pcm.sso_comparacao_datas_legado(uuid,uuid,uuid,uuid,uuid,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comparacao_datas_legado(uuid,uuid,uuid,uuid,uuid,uuid,date,date) to authenticated;
