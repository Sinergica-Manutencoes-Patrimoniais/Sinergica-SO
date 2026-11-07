-- ADR-0345: leitura de perguntas e histórico de contrato em rascunho.
create function pcm.sso_listar_contratos_pergunta_rascunho(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,obrigatoria boolean,contrato_atual boolean,revisao_plano integer)
language plpgsql stable security definer set search_path='' as $$
declare v_perguntas jsonb;v_questionario uuid;
begin
 if not coalesce((select habilitado from pcm.sso_contrato_pergunta_gate where id),false) then raise exception 'contrato_pergunta_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 select q.perguntas,q.id into v_perguntas,v_questionario from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id and v.estado='rascunho' join pcm.rotinas_manutencao r on r.versao_id=v.id and r.plano_id=p.id join pcm.questionarios q on q.id=r.questionario_id and q.ativo
 where p.id=p_plano_id and p.cliente_id=p_cliente_id and p.estado='rascunho' and v.id=p_versao_id and r.id=p_rotina_id;
 if not found or jsonb_typeof(v_perguntas) is distinct from 'array' then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(v_perguntas) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null) or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) group by item->>'id' having count(*)>1) then raise exception 'perguntas_invalidas' using errcode='23514'; end if;
 return query select x.ord::integer,x.item->>'id',c.obrigatoria,coalesce(c.questionario_id=v_questionario and c.pergunta_fonte=x.item,false),c.revisao_plano
 from jsonb_array_elements(v_perguntas) with ordinality x(item,ord) left join lateral (select c0.* from pcm.sso_contratos_pergunta_rascunho c0 where c0.plano_id=p_plano_id and c0.versao_id=p_versao_id and c0.rotina_id=p_rotina_id and c0.pergunta_id=x.item->>'id' order by c0.revisao_plano desc limit 1) c on true where p_apos is null or x.ord>p_apos order by x.ord limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_contratos_pergunta_rascunho(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_historico_contrato_pergunta(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_antes integer,p_limite integer)
returns table(id uuid,revisao_plano integer,questionario_id uuid,obrigatoria boolean,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_contrato_pergunta_gate where id),false) then raise exception 'contrato_pergunta_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_pergunta_id is null or length(btrim(p_pergunta_id)) not between 1 and 250 or p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.id,c.revisao_plano,c.questionario_id,c.obrigatoria,c.justificativa,c.ator_id,c.criado_em from pcm.sso_contratos_pergunta_rascunho c where c.plano_id=p_plano_id and c.versao_id=p_versao_id and c.rotina_id=p_rotina_id and c.pergunta_id=p_pergunta_id and (p_antes is null or c.revisao_plano<p_antes) order by c.revisao_plano desc limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_contrato_pergunta(uuid,uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
