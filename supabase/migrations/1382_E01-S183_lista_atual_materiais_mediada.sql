-- ADR-1227: leitura pública explícita sem expor campos extras do snapshot.
create function pcm.sso_portal_listar_materiais_mediada(
  p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid
)
returns table(id uuid,ordem_servico_id uuid,responsavel text,estado text,revisao integer,
  linhas jsonb,publicado_em timestamptz,ultima_informacao_em timestamptz,
  ultima_informacao_por uuid,excecao_atual boolean)
language plpgsql volatile security definer set search_path='' as $$
declare v record; v_publico jsonb;
begin
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  for v in select * from pcm.sso_portal_listar_materiais(p_cliente_id,p_os_id,p_apos) loop
    if jsonb_typeof(v.linhas) is distinct from 'array' or jsonb_array_length(v.linhas)>100 then
      raise exception 'lista_indisponivel' using errcode='42501';
    end if;
    if exists(select 1 from jsonb_array_elements(v.linhas) x where jsonb_typeof(x) is distinct from 'object'
      or jsonb_typeof(x->'descricao') is distinct from 'string'
      or coalesce(jsonb_typeof(x->'quantidade'),'null') not in ('string','null')
      or coalesce(jsonb_typeof(x->'unidade'),'null') not in ('string','null')) then
      raise exception 'lista_indisponivel' using errcode='42501';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('descricao',x->'descricao',
      'quantidade',coalesce(x->'quantidade','null'::jsonb),
      'unidade',coalesce(x->'unidade','null'::jsonb)) order by n),'[]'::jsonb)
      into v_publico from jsonb_array_elements(v.linhas) with ordinality as a(x,n);
    id:=v.id; ordem_servico_id:=v.ordem_servico_id; responsavel:=v.responsavel;
    estado:=v.estado; revisao:=v.revisao; linhas:=v_publico; publicado_em:=v.publicado_em;
    ultima_informacao_em:=v.ultima_informacao_em; ultima_informacao_por:=v.ultima_informacao_por;
    excecao_atual:=v.excecao_atual;
    return next;
  end loop;
end; $$;
revoke all on function pcm.sso_portal_listar_materiais_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_listar_materiais_mediada(uuid,uuid,uuid,uuid) to authenticated;
