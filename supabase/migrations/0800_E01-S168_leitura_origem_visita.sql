-- ADR-0575: leitura unificada de origem e perguntas, sem alterar retorno ou liberar execução.
create function pcm.sso_previa_origem_visita_os(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_os pcm.ordens_servico%rowtype;v_origem jsonb;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_num integer;v_perguntas jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_origem_execucao_unificada_gate where id),false) then raise exception 'origem_execucao_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_os from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
 if not found or v_os.ocorrencia_preventiva_id is null then raise exception 'os_indisponivel' using errcode='42501';end if;
 v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);
 if v_origem->>'tipo' is distinct from 'visita' then raise exception 'origem_nao_e_visita' using errcode='23514';end if;
 select * into v_versao from pcm.plano_versoes where id=(v_origem->>'versaoId')::uuid and plano_id=(v_origem->>'planoId')::uuid and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=v_origem->>'rotinaId';
 if v_num<>1 or jsonb_typeof(v_rotina->'questionario') is distinct from 'object' or v_rotina->'questionario'->>'id' is distinct from v_rotina->>'questionario_id' then raise exception 'questionario_historico_indeterminado' using errcode='23514';end if;
 v_perguntas:=v_rotina->'questionario'->'perguntas';
 if jsonb_typeof(v_perguntas) is distinct from 'array' or jsonb_array_length(v_perguntas)=0 or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null) or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) group by item->>'id' having count(*)>1) then raise exception 'perguntas_historicas_indeterminadas' using errcode='23514';end if;
 return jsonb_build_object('osId',p_os_id,'origem',v_origem,'questionarioId',v_rotina->>'questionario_id','quantidadePerguntas',jsonb_array_length(v_perguntas),'snapshotHistoricoDisponivel',true,'conteudoExternoAutenticado',false,'retornoCriado',false,'aprovacaoAutorizada',false,'execucaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_previa_origem_visita_os(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_perguntas_origem_visita_os(p_cliente_id uuid,p_os_id uuid,p_apos integer default 0,p_limite integer default 20)
returns table(indice integer,pergunta_id text,obrigatoriedade text)
language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_snapshot jsonb;v_rotina jsonb;
begin
 if p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023';end if;
 v_previa:=pcm.sso_previa_origem_visita_os(p_cliente_id,p_os_id);
 select snapshot into v_snapshot from pcm.plano_versoes where id=(v_previa->'origem'->>'versaoId')::uuid and plano_id=(v_previa->'origem'->>'planoId')::uuid and estado='aprovado';
 select item into v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'id'=v_previa->'origem'->>'rotinaId';
 return query select (p.ord-1)::integer,p.item->>'id',case when c.qtd=1 and c.questionario=v_previa->>'questionarioId' and c.tipo='boolean' then case when c.valor='true' then 'obrigatoria' else 'opcional' end else 'indeterminada' end
 from jsonb_array_elements(v_rotina->'questionario'->'perguntas') with ordinality p(item,ord)
 cross join lateral (select count(*) qtd,min(x.item->>'questionarioId') questionario,min(jsonb_typeof(x.item->'obrigatoria')) tipo,min(x.item->>'obrigatoria') valor from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) x(item) where x.item->>'rotinaId'=v_previa->'origem'->>'rotinaId' and x.item->>'perguntaId'=p.item->>'id') c
 where p.ord>p_apos order by p.ord limit p_limite;
end; $$;
revoke all on function pcm.sso_perguntas_origem_visita_os(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
