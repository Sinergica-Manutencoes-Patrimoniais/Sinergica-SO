-- ADR-0444: comparação informativa, sem decisão automática sobre equivalência.
create function pcm.sso_conferir_relacao_plano_legado(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_legado_id uuid,p_apos uuid default null,p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_legado pcm.planos_preventivos%rowtype;v_versao pcm.plano_versoes%rowtype;v_itens jsonb;v_count integer;v_cursor text;
begin
 if not coalesce((select habilitado from pcm.sso_relacao_plano_legado_gate where id),false) then raise exception 'relacao_plano_legado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 select * into v_legado from pcm.planos_preventivos where id=p_legado_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_legado_indisponivel' using errcode='42501'; end if;
 if coalesce((select d.decisao from pcm.sso_declaracoes_planos_legados d where d.cliente_id=p_cliente_id and d.plano_id=p_plano_id and d.plano_legado_id=p_legado_id order by d.revisao desc limit 1),'')<>'declarar' then raise exception 'relacao_nao_declarada' using errcode='23514'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id;
 if not found then raise exception 'versao_indisponivel' using errcode='23514'; end if;
 if v_versao.estado='aprovado' and jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indeterminado' using errcode='23514'; end if;
 with fonte as (
   select item from jsonb_array_elements(case when v_versao.estado='aprovado' then v_versao.snapshot->'rotinas' else '[]'::jsonb end) x(item)
   union all select to_jsonb(r) from pcm.rotinas_manutencao r where v_versao.estado='rascunho' and r.plano_id=p_plano_id and r.versao_id=p_versao_id
 ), pagina as (
   select item,(item->>'rotina_logica_id')::uuid logica from fonte where item->>'rotina_logica_id' is not null and (p_apos is null or (item->>'rotina_logica_id')::uuid>p_apos) order by (item->>'rotina_logica_id')::uuid limit p_limite+1
 ), numerada as (select *,row_number() over(order by logica) n from pagina)
 select coalesce(jsonb_agg(jsonb_build_object('rotinaId',item->>'id','rotinaLogicaId',logica,'nome',item->>'nome','alvoTipo',item->>'alvo_tipo',
   'alvoDeclarado',coalesce(item->>'sistema_id',item->>'equipamento_id',item->>'grupo_id'),
   'alvoMesmoId',case when coalesce(item->>'sistema_id',item->>'equipamento_id',item->>'grupo_id') is null then null else coalesce(item->>'sistema_id',item->>'equipamento_id',item->>'grupo_id')=coalesce(v_legado.sistema_id::text,v_legado.equipamento_id::text) end,
   'modo',item->>'modo','intervalo',item->>'intervalo_n','unidade',item->>'intervalo_unidade','dataBase',item->>'data_base',
   'intervaloMesmo',case when item->>'intervalo_n' is null or item->>'intervalo_unidade' is null then null else item->>'intervalo_n'=v_legado.intervalo_n::text and item->>'intervalo_unidade'=v_legado.intervalo_unidade end,
   'dataBaseIgual',case when item->>'data_base' is null then null else item->>'data_base'=v_legado.primeira_data::text end,
   'questionarioMesmoId',case when item->>'questionario_id' is null then null else item->>'questionario_id'=v_legado.questionario_id::text end) order by logica) filter(where n<=p_limite),'[]'::jsonb),count(*),max(logica::text) filter(where n=p_limite) into v_itens,v_count,v_cursor from numerada;
 return jsonb_build_object('planoLegadoId',v_legado.id,'nomeLegado',v_legado.nome,'alvoLegado',coalesce(v_legado.sistema_id::text,v_legado.equipamento_id::text),'intervaloLegado',v_legado.intervalo_n,'unidadeLegado',v_legado.intervalo_unidade,'primeiraDataLegada',v_legado.primeira_data,'estadoVersao',v_versao.estado,'items',v_itens,'nextCursor',case when v_count>p_limite then v_cursor else null end,'equivalenciaComprovada',false,'impactoCalculado',false,'fonteMutavel',v_versao.estado='rascunho');
end; $$;
revoke all on function pcm.sso_conferir_relacao_plano_legado(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_versoes_conferencia_legado(p_cliente_id uuid,p_plano_id uuid,p_apos integer default 0,p_limite integer default 20)
returns table(id uuid,numero integer,estado text) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_relacao_plano_legado_gate where id),false) then raise exception 'relacao_plano_legado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select v.id,v.numero,v.estado from pcm.plano_versoes v where v.plano_id=p_plano_id and v.numero>p_apos order by v.numero limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_versoes_conferencia_legado(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
