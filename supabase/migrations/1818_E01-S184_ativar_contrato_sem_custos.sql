-- ADR-1677: mantém SECURITY INVOKER e a ACL da função histórica.
do $migration$
declare
  alvo regprocedure := 'comercial.fn_ativar_contrato(uuid)'::regprocedure;
  corpo text := pg_catalog.pg_get_functiondef(alvo);
  guarda text := $old$  perform comercial._fn_guarda_comercial_escrita();$old$;
  nova_guarda text := $new$  perform comercial._fn_guarda_comercial_escrita();
  if not config.s184_acesso_interno_atual('comercial') or not (
    config.s184_pode_ver_custos() or exists (
      select 1 from config.resolver_permissoes_modulo(auth.uid()) m
      where m.modulo = 'comercial' and m.nivel = 'escrita'
    )
  ) then
    raise exception 'sem_permissao_comercial_atual' using errcode = '42501';
  end if;$new$;
  verifica text := $old$  if v_contrato.status <> 'rascunho' then$old$;
  nova_verifica text := $new$  if not exists (
    select 1 from comercial.propostas_sem_custos p
    join comercial.oportunidades o on o.id = p.oportunidade_id
    where p.id = v_contrato.proposta_id and o.cliente_id = v_contrato.cliente_id
  ) then
    raise exception 'origem_contrato_indisponivel' using errcode = '42501';
  end if;
  if v_contrato.status <> 'rascunho' then$new$;
  antiga text := $old$(select oportunidade_id from comercial.propostas where id = v_contrato.proposta_id)$old$;
  nova text := $new$(select oportunidade_id from comercial.propostas_sem_custos where id = v_contrato.proposta_id)$new$;
  fim_atualizacao text := $old$    end if;
  end if;

  return v_contrato;$old$;
  fim_validado text := $new$      if not found then
        raise exception 'oportunidade_nao_atualizada' using errcode = '42501';
      end if;
    else
      raise exception 'etapa_ganha_indisponivel' using errcode = '23514';
    end if;
  end if;

  return v_contrato;$new$;
begin
  if corpo is null or pg_catalog.strpos(corpo, guarda) = 0
     or pg_catalog.strpos(pg_catalog.replace(corpo, guarda, ''), guarda) <> 0
     or pg_catalog.strpos(corpo, verifica) = 0
     or pg_catalog.strpos(pg_catalog.replace(corpo, verifica, ''), verifica) <> 0
     or pg_catalog.strpos(corpo, fim_atualizacao) = 0
     or pg_catalog.strpos(pg_catalog.replace(corpo, fim_atualizacao, ''), fim_atualizacao) <> 0
     or (pg_catalog.length(corpo) - pg_catalog.length(pg_catalog.replace(corpo, antiga, ''))) / pg_catalog.length(antiga) <> 2 then
    raise exception 'definicao_ativar_contrato_incompativel' using errcode = '55000';
  end if;
  execute pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(corpo, guarda, nova_guarda), verifica, nova_verifica), antiga, nova), fim_atualizacao, fim_validado);
end;
$migration$;
