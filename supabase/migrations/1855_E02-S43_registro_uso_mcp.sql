-- E02-S43 — MCP controlado sobre a API de domínio (E01-S198). ADR-1696.
-- Key Entities da spec: "nenhuma entidade de domínio nova... entram ferramenta MCP (catálogo,
-- capacidade exigida) e registro de uso append-only". O catálogo de ferramentas é estático em
-- código (supabase/functions/pcm-mcp/index.ts) — não precisa de tabela, é fixo por versão do
-- contrato (mesmo espírito do `versao: "v1"` da própria API de domínio). O que precisa persistir
-- é o REGISTRO DE USO (AC-6: "identifica usuário e ferramenta"), porque isso o código sozinho
-- não prova depois — é auditoria, tem que sobreviver ao deploy que mudou o catálogo.
--
-- Reverso: revoke execute on function pcm.sso_registrar_uso_mcp(text,boolean,text) from authenticated;
--          drop function pcm.sso_registrar_uso_mcp(text,boolean,text);
--          drop table pcm.sso_mcp_chamadas;
--          (nunca apagar linhas já gravadas — é o histórico de AC-6/SC-003)

create table pcm.sso_mcp_chamadas (
  id uuid primary key default gen_random_uuid(),
  ator_id uuid not null references auth.users(id),
  ferramenta text not null check (length(btrim(ferramenta)) between 1 and 100),
  sucesso boolean not null,
  detalhe text check (detalhe is null or length(detalhe) <= 2000),
  criado_em timestamptz not null default now()
);
alter table pcm.sso_mcp_chamadas enable row level security;
alter table pcm.sso_mcp_chamadas force row level security;
revoke all on pcm.sso_mcp_chamadas from public, anon, authenticated, service_role;
create index idx_sso_mcp_chamadas_ator on pcm.sso_mcp_chamadas(ator_id, criado_em);

-- AC-6/AC-8: toda chamada (autorizada ou recusada) é registrada — inclusive a recusada, que é
-- exatamente a prova que AC-8 pede ("ferramenta não autorizada... é recusada e o evento é
-- registrado"). `security definer` + `auth.uid()` — chamada sempre no contexto do usuário real
-- (nunca service_role, mesmo padrão de `pcm-api-dominio`/`pcm-auvo-open-task`), então o ator_id
-- aqui é sempre quem de fato chamou, não o sistema.
create function pcm.sso_registrar_uso_mcp(p_ferramenta text, p_sucesso boolean, p_detalhe text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_id uuid;
begin
  if v_ator is null or p_ferramenta is null or length(btrim(p_ferramenta)) not between 1 and 100
    or p_sucesso is null or (p_detalhe is not null and length(p_detalhe) > 2000) then
    raise exception 'registro_invalido' using errcode = '22023';
  end if;
  insert into pcm.sso_mcp_chamadas(ator_id, ferramenta, sucesso, detalhe)
    values (v_ator, btrim(p_ferramenta), p_sucesso, p_detalhe) returning id into v_id;
  return v_id;
end; $$;
revoke all on function pcm.sso_registrar_uso_mcp(text, boolean, text) from public, anon, service_role;
grant execute on function pcm.sso_registrar_uso_mcp(text, boolean, text) to authenticated;

-- AC-1/SC-001: leitura do próprio histórico, por ator — nunca cross-user (RLS não ajuda numa
-- tabela sem policy nenhuma; a única porta é esta função, que já filtra por `auth.uid()`).
create function pcm.sso_listar_uso_mcp_proprio(p_limite integer, p_apos uuid)
returns table(id uuid, ferramenta text, sucesso boolean, detalhe text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  return query select c.id, c.ferramenta, c.sucesso, c.detalhe, c.criado_em
    from pcm.sso_mcp_chamadas c
    where c.ator_id = auth.uid() and (p_apos is null or c.id > p_apos)
    order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_uso_mcp_proprio(integer, uuid) from public, anon, service_role;
grant execute on function pcm.sso_listar_uso_mcp_proprio(integer, uuid) to authenticated;
