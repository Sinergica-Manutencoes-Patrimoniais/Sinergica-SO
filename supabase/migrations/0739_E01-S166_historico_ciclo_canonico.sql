-- ADR-0514: consulta por regra congelada e índice, não por data.
create function pcm.sso_historico_ciclo_canonico(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_indice integer,p_apos integer default 0,p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;v_logica uuid;v_tipo text;v_alvo uuid;v_serie uuid;v_ciclo uuid;v_itens jsonb;v_qtd integer;v_cursor integer;
begin
 if not coalesce((select habilitado from pcm.sso_identidade_ciclo_gate where id),false) then raise exception 'identidade_ciclo_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_indice is null or p_indice<0 or p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'calendario' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 v_logica:=(v_rotina->>'rotina_logica_id')::uuid;v_tipo:=v_rotina->>'alvo_tipo';v_alvo:=case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;
 select id into v_serie from pcm.sso_series_ciclo_calendario where plano_id=p_plano_id and rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo and ancora=(v_rotina->>'data_base')::date and intervalo_n=(v_rotina->>'intervalo_n')::integer and intervalo_unidade=v_rotina->>'intervalo_unidade';
 if v_serie is not null then select id into v_ciclo from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=p_indice;end if;
 if v_ciclo is null then return jsonb_build_object('identidadeExistente',false,'cicloId',null,'versoes','[]'::jsonb,'nextCursor',null,'origemPorData',false);end if;
 with pagina as (select v.id,v.numero,u.rotina_id,u.preparada_id,u.criado_em from pcm.sso_ciclo_canonico_usos_versao u join pcm.plano_versoes v on v.id=u.versao_id and v.plano_id=p_plano_id where u.ciclo_id=v_ciclo and v.numero>p_apos order by v.numero limit p_limite+1),numerada as (select *,row_number() over(order by numero) n from pagina)
 select coalesce(jsonb_agg(jsonb_build_object('versaoId',id,'numero',numero,'rotinaId',rotina_id,'preparadaId',preparada_id,'registradoEm',criado_em) order by numero) filter(where n<=p_limite),'[]'::jsonb),count(*),max(numero) filter(where n=p_limite) into v_itens,v_qtd,v_cursor from numerada;
 return jsonb_build_object('identidadeExistente',true,'cicloId',v_ciclo,'serieId',v_serie,'indice',p_indice,'versoes',v_itens,'nextCursor',case when v_qtd>p_limite then v_cursor else null end,'origemPorData',false);
end; $$;
revoke all on function pcm.sso_historico_ciclo_canonico(uuid,uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;
