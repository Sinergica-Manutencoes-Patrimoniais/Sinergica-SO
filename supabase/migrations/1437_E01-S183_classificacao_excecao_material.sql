-- ADR-1290: somente categoria enumerada, sem texto livre ou custos.
create function pcm.sso_portal_classificar_excecao_material(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_lista_id uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_lista pcm.listas_materiais%rowtype; v_publicacao integer; v_tipo text; v_motivo text;
begin
  if p_lista_id is null or p_revisao is null or p_revisao<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id and ordem_servico_id=p_os_id for share;
  if not found or v_lista.revisao is distinct from p_revisao then raise exception 'lista_indisponivel' using errcode='42501'; end if;
  select max(p.revisao_lista) into v_publicacao from pcm.sso_portal_materiais_publicacoes p where p.lista_id=p_lista_id;
  if v_publicacao is null or v_publicacao<coalesce((select max(v.revisao) from pcm.sso_lista_materiais_versoes v where v.lista_id=p_lista_id),1)
    or coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=p_lista_id and e.revisao_publicacao=v_publicacao order by e.sequencia desc limit 1),'publicar')='retirar' then
    raise exception 'lista_indisponivel' using errcode='42501';
  end if;
  select e.tipo,e.dados->>'motivo' into v_tipo,v_motivo from pcm.sso_lista_materiais_eventos e where e.lista_id=p_lista_id order by e.revisao desc limit 1;
  if v_tipo is distinct from 'excecao' then v_motivo:=null;
  elsif v_motivo is null or v_motivo not in ('faltante','parcial','errado','novo_levantamento') then v_motivo:='nao_classificada'; end if;
  return jsonb_build_object('listaId',p_lista_id,'revisao',v_lista.revisao,'classificacao',v_motivo);
end; $$;
revoke all on function pcm.sso_portal_classificar_excecao_material(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_classificar_excecao_material(uuid,uuid,uuid,uuid,integer) to authenticated;
