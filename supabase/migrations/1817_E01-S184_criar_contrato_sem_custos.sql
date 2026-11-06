-- ADR-1676: mantém SECURITY INVOKER e a ACL da função histórica.
do $migration$
declare
  alvo regprocedure := 'comercial.fn_criar_contrato(uuid)'::regprocedure;
  corpo text := pg_catalog.pg_get_functiondef(alvo);
  original text := $old$  select * into v_proposta from comercial.propostas where id = p_proposta_id;$old$;
  substituto text := $new$  if not config.s184_acesso_interno_atual('comercial') or not (
    config.s184_pode_ver_custos() or exists (
      select 1 from config.resolver_permissoes_modulo(auth.uid()) m
      where m.modulo = 'comercial' and m.nivel = 'escrita'
    )
  ) then
    raise exception 'sem_permissao_comercial_atual' using errcode = '42501';
  end if;

  select p.id, p.oportunidade_id, p.tipo, p.status, p.preco_centavos, p.escopo
    into v_proposta.id, v_proposta.oportunidade_id, v_proposta.tipo,
         v_proposta.status, v_proposta.preco_centavos, v_proposta.escopo
    from comercial.propostas_sem_custos p where p.id = p_proposta_id;$new$;
  antigo text := $old$  select cliente_id into v_cliente_id
    from comercial.oportunidades where id = v_proposta.oportunidade_id;$old$;
  novo text := $new$  if v_proposta.oportunidade_id is null then
    raise exception 'proposta_sem_oportunidade' using errcode = '23514';
  end if;
  select cliente_id into v_cliente_id
    from comercial.oportunidades where id = v_proposta.oportunidade_id;
  if not found or v_cliente_id is null then
    raise exception 'oportunidade_indisponivel' using errcode = '42501';
  end if;$new$;
begin
  if corpo is null or pg_catalog.strpos(corpo, original) = 0
     or pg_catalog.strpos(pg_catalog.replace(corpo, original, ''), original) <> 0
     or pg_catalog.strpos(corpo, antigo) = 0
     or pg_catalog.strpos(pg_catalog.replace(corpo, antigo, ''), antigo) <> 0 then
    raise exception 'definicao_criar_contrato_incompativel' using errcode = '55000';
  end if;
  execute pg_catalog.replace(pg_catalog.replace(corpo, original, substituto), antigo, novo);
end;
$migration$;
