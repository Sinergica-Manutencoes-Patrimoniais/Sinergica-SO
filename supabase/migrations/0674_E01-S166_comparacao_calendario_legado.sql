-- ADR-0448: compara datas de calendário por janela finita; não deduz equivalência geral.
create function pcm.sso_comparar_calendario_legado(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_legado_id uuid,p_inicio date,p_fim date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_legado pcm.planos_preventivos%rowtype;v_versao pcm.plano_versoes%rowtype;v_sso integer;v_leg integer;v_comuns integer;v_estado text;
begin
 if not coalesce((select habilitado from pcm.sso_relacao_plano_legado_gate where id),false) then raise exception 'relacao_plano_legado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_inicio<date '0001-01-01' or p_fim>date '9999-12-31' or p_fim<p_inicio or p_fim-p_inicio>366 then raise exception 'janela_invalida' using errcode='22023'; end if;
 select * into v_legado from pcm.planos_preventivos where id=p_legado_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_legado_indisponivel' using errcode='42501'; end if;
 if coalesce((select d.decisao from pcm.sso_declaracoes_planos_legados d where d.cliente_id=p_cliente_id and d.plano_id=p_plano_id and d.plano_legado_id=p_legado_id order by d.revisao desc limit 1),'')<>'declarar' then raise exception 'relacao_nao_declarada' using errcode='23514'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or v_versao.vigencia_inicio is null or p_inicio<v_versao.vigencia_inicio or (v_versao.vigencia_fim is not null and p_fim>v_versao.vigencia_fim) then raise exception 'janela_fora_da_vigencia' using errcode='23514'; end if;
 with dias as (select p_inicio+n data from generate_series(0,p_fim-p_inicio) n),
 distancias as (select data,case when v_legado.intervalo_unidade='semanas' then data-v_legado.primeira_data else ((extract(year from data)::integer-extract(year from v_legado.primeira_data)::integer)*12+extract(month from data)::integer-extract(month from v_legado.primeira_data)::integer) end distancia,case when v_legado.intervalo_unidade='semanas' then 7*v_legado.intervalo_n else v_legado.intervalo_n end passo from dias),
 antigo as (select data from distancias where case when distancia>=0 and mod(distancia,passo)=0 then pcm.sso_vencimento_ciclo_calendario(v_legado.primeira_data,v_legado.intervalo_n,v_legado.intervalo_unidade,distancia/passo)=data else false end),
 novo as (select vencimento data from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim))
 select (select count(*) from novo),(select count(*) from antigo),(select count(*) from novo join antigo using(data)) into v_sso,v_leg,v_comuns;
 v_estado:=case when v_sso=0 or v_leg=0 then 'indeterminado_sem_ciclos' when v_sso=v_leg and v_comuns=v_sso then 'datas_iguais_na_janela' else 'datas_diferentes_na_janela' end;
 return jsonb_build_object('inicio',p_inicio,'fim',p_fim,'ciclosSso',v_sso,'ciclosLegados',v_leg,'datasComuns',v_comuns,'comparacao',v_estado,'equivalenciaGeralComprovada',false,'impactoCalculado',false,'geradorAlterado',false);
end; $$;
revoke all on function pcm.sso_comparar_calendario_legado(uuid,uuid,uuid,uuid,uuid,date,date) from public,anon,authenticated,service_role;
