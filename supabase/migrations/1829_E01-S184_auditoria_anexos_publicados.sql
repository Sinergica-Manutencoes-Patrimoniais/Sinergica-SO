-- E01-S184 AC-6 (segunda metade, FR-006): inventário auditado dos anexos de OS atualmente
-- publicados ao Portal (`pcm.sso_portal_anexos_publicacoes`/`sso_portal_anexos_revogacoes`,
-- migration 0465/E01-S183 — mesmo mecanismo já reusado por E01-S182/0559 para documentos de
-- cobrança). Não cria novo modelo de publicação/revogação: só adiciona a leitura que faltava
-- para o administrador auditar o que está público hoje (cross-Cliente) e decidir, caso a caso,
-- revogar pela RPC já existente `pcm.sso_revogar_anexo_os` (auditada: motivo, ator, request_id,
-- audit.events). Correção documental (FR-006): esta migration não afirma exposição confirmada em
-- produção — o gate `pcm.sso_portal_anexo_gate` nasceu e segue desligado (`habilitado = false`),
-- então o inventário abaixo retorna vazio em produção até alguém publicar algo de fato.
--
-- Reverso: drop function if exists pcm.sso_auditoria_anexos_publicados(uuid, integer);

create function pcm.sso_auditoria_anexos_publicados(p_apos uuid default null, p_limite integer default 50)
returns table(id uuid, cliente_id uuid, ordem_servico_id uuid, titulo text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not config.s184_pode_ver_custos() then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 200 then
    raise exception 'paginacao_invalida' using errcode = '22023';
  end if;
  return query
    select p.id, p.cliente_id, p.ordem_servico_id, p.titulo, p.criado_em
      from pcm.sso_portal_anexos_publicacoes p
      where not exists (select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id = p.id)
        and (p_apos is null or p.id > p_apos)
      order by p.id
      limit p_limite;
end;
$$;
revoke all on function pcm.sso_auditoria_anexos_publicados(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_auditoria_anexos_publicados(uuid, integer) to authenticated;

comment on function pcm.sso_auditoria_anexos_publicados(uuid, integer) is
  'E01-S184 AC-6/FR-006: inventário cross-Cliente dos anexos de OS publicados e não revogados, '
  'restrito a quem já pode ver custos (config.s184_pode_ver_custos). Não revoga nada — a retirada '
  'auditada de acesso continua sendo pcm.sso_revogar_anexo_os (migration 0465).';
