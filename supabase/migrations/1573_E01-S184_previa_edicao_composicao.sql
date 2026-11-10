-- ADR-1430: fotografia limitada, somente para o mesmo ator autorizado a editar.
create function pcm.sso_previa_edicao_composicao(p_cliente_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_proposta comercial.propostas%rowtype;v_itens jsonb;v_total integer;
begin
 perform 1 from pcm.sso_edicao_composicao_escopada_gate where id and habilitado for share;
 if not found then raise exception 'edicao_desabilitada' using errcode='55000'; end if;
 perform pcm.sso_consultar_custos_proposta(p_cliente_id,p_proposta_id);
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 lock table comercial.proposta_itens in share mode nowait;
 select * into v_proposta from comercial.propostas where id=p_proposta_id and deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*) into v_total from comercial.proposta_itens where proposta_id=p_proposta_id;
 if v_total>100 then raise exception 'composicao_excede_limite' using errcode='54000'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'tipo',i.tipo,'descricao',i.descricao,'nivelId',i.nivel_id,
   'materialId',i.material_id,'quantidade',i.quantidade,'custoUnitarioCentavos',i.custo_unitario_centavos) order by i.id),'[]'::jsonb)
 into v_itens from comercial.proposta_itens i where i.proposta_id=p_proposta_id;
 return jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',v_proposta.versao_atual,
   'status',v_proposta.status,'precoCentavos',v_proposta.preco_centavos,'snapshot',pg_catalog.md5(v_itens::text),'itens',v_itens);
end; $$;
revoke all on function pcm.sso_previa_edicao_composicao(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_previa_edicao_composicao(uuid,uuid) to authenticated;
