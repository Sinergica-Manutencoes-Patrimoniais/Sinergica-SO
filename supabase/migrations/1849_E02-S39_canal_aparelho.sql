-- 1849_E02-S39_canal_aparelho.sql — Sinérgica SO
-- Mensagem do aparelho tira o Zé (ADR-1688). Configuração por canal: quem é o "responsável do
-- aparelho" (pessoa que atende pelo celular) e a lista de textos automáticos do WhatsApp Business
-- que não devem tirar o Zé da conversa. "Ninguém" (responsavel_id = null) é a chave de desligar:
-- sem responsável configurado, mensagem do aparelho só entra no histórico, nada mais muda.
--
-- Reverso:
--   drop function if exists atendimento.fn_salvar_configuracao_do_aparelho(uuid,uuid,jsonb,bigint);
--   drop function if exists atendimento.fn_ler_configuracao_do_aparelho(uuid);
--   drop function if exists atendimento.fn_pessoa_do_aparelho_valida(uuid);
--   drop table if exists atendimento.canal_aparelho;
--   drop function if exists atendimento.fn_textos_automaticos_validos(jsonb);
--   drop function if exists atendimento.fn_normalizar_texto_do_aparelho(text);

create or replace function atendimento.fn_normalizar_texto_do_aparelho(p_texto text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(lower(coalesce(p_texto, '')), '\s+', ' ', 'g'))
$$;

create or replace function atendimento.fn_textos_automaticos_validos(p_textos jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_textos) = 'array'
     and jsonb_array_length(p_textos) <= 10
     and not exists (
           select 1 from jsonb_array_elements_text(p_textos) t
            where length(t) > 1000 or btrim(t) = ''
         )
     and (
           select count(distinct atendimento.fn_normalizar_texto_do_aparelho(t))
             from jsonb_array_elements_text(p_textos) t
         ) = jsonb_array_length(p_textos)
$$;

create table if not exists atendimento.canal_aparelho (
  canal_id           uuid        primary key references atendimento.canais_externos(id) on delete cascade,
  responsavel_id     uuid        references auth.users on delete set null,
  textos_automaticos jsonb       not null default '[]'::jsonb
                                  check (atendimento.fn_textos_automaticos_validos(textos_automaticos)),
  versao             bigint      not null default 1 check (versao > 0),
  updated_by         uuid        references auth.users,
  updated_at         timestamptz not null default now()
);

alter table atendimento.canal_aparelho enable row level security;
alter table atendimento.canal_aparelho force row level security;
revoke all on table atendimento.canal_aparelho from public, anon, authenticated;
grant select on table atendimento.canal_aparelho to authenticated;
grant select, insert, update, delete on table atendimento.canal_aparelho to service_role;

create policy "canal_aparelho_superadmin_le" on atendimento.canal_aparelho
  for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin');
-- Escrita só pelas RPCs abaixo (security definer) — nenhuma policy de insert/update/delete para
-- authenticated, de propósito.

-- Pessoa ativa com papel de equipe (não cliente-síndico). Fica inválida se desativada depois —
-- a leitura (abaixo) devolve o aviso; o comportamento runtime (S39 AC-3/AC-11) cai pra "Ninguém".
create or replace function atendimento.fn_pessoa_do_aparelho_valida(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = config, public
as $$
  select exists (
    select 1 from config.usuarios
     where user_id = p_usuario
       and ativo = true
       and papel in ('superadmin', 'supervisor', 'colaborador')
  )
$$;

create or replace function atendimento.fn_ler_configuracao_do_aparelho(p_canal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = atendimento, config, public
as $$
declare
  v_config atendimento.canal_aparelho;
  v_nome text;
  v_valida boolean;
begin
  if (auth.jwt() ->> 'user_role') is distinct from 'superadmin' then
    raise exception 'Apenas superadmin configura o aparelho' using errcode = '42501';
  end if;

  select * into v_config from atendimento.canal_aparelho where canal_id = p_canal_id;
  if v_config is null then
    return jsonb_build_object(
      'versao', 1, 'responsavelId', null, 'responsavelNome', null,
      'responsavelValido', true, 'textos', '[]'::jsonb,
      'pessoasElegiveis', (
        select coalesce(jsonb_agg(jsonb_build_object('id', user_id, 'nome', nome) order by nome), '[]'::jsonb)
          from config.usuarios where ativo = true and papel in ('superadmin', 'supervisor', 'colaborador')
      )
    );
  end if;

  if v_config.responsavel_id is null then
    v_nome := null;
    v_valida := true;
  else
    select nome into v_nome from config.usuarios where user_id = v_config.responsavel_id;
    v_valida := atendimento.fn_pessoa_do_aparelho_valida(v_config.responsavel_id);
  end if;

  return jsonb_build_object(
    'versao', v_config.versao,
    'responsavelId', v_config.responsavel_id,
    'responsavelNome', v_nome,
    'responsavelValido', v_valida,
    'textos', v_config.textos_automaticos,
    'pessoasElegiveis', (
      select coalesce(jsonb_agg(jsonb_build_object('id', user_id, 'nome', nome) order by nome), '[]'::jsonb)
        from config.usuarios where ativo = true and papel in ('superadmin', 'supervisor', 'colaborador')
    )
  );
end;
$$;

revoke all on function atendimento.fn_ler_configuracao_do_aparelho(uuid) from public, anon;
grant execute on function atendimento.fn_ler_configuracao_do_aparelho(uuid) to authenticated;

-- CAS: versão divergente é recusada (não sobrescreve escrita concorrente). Pessoa/textos
-- inválidos são recusados ANTES de gravar.
create or replace function atendimento.fn_salvar_configuracao_do_aparelho(
  p_canal_id uuid,
  p_responsavel_id uuid,
  p_textos jsonb,
  p_versao_esperada bigint
) returns bigint
language plpgsql
security definer
set search_path = atendimento, config, public
as $$
declare
  v_versao_atual bigint;
  v_nova_versao bigint;
begin
  if (auth.jwt() ->> 'user_role') is distinct from 'superadmin' then
    raise exception 'Apenas superadmin configura o aparelho' using errcode = '42501';
  end if;
  if p_responsavel_id is not null and not atendimento.fn_pessoa_do_aparelho_valida(p_responsavel_id) then
    raise exception 'pessoa_invalida' using errcode = '23514';
  end if;
  if not atendimento.fn_textos_automaticos_validos(coalesce(p_textos, '[]'::jsonb)) then
    raise exception 'textos_invalidos' using errcode = '23514';
  end if;

  select versao into v_versao_atual from atendimento.canal_aparelho where canal_id = p_canal_id;

  if v_versao_atual is null then
    if p_versao_esperada is distinct from 1 then
      raise exception 'versao_divergente' using errcode = '40001';
    end if;
    insert into atendimento.canal_aparelho (canal_id, responsavel_id, textos_automaticos, versao, updated_by)
    values (p_canal_id, p_responsavel_id, coalesce(p_textos, '[]'::jsonb), 1, auth.uid());
    return 1;
  end if;

  if v_versao_atual is distinct from p_versao_esperada then
    raise exception 'versao_divergente' using errcode = '40001';
  end if;

  v_nova_versao := v_versao_atual + 1;
  update atendimento.canal_aparelho
     set responsavel_id = p_responsavel_id,
         textos_automaticos = coalesce(p_textos, '[]'::jsonb),
         versao = v_nova_versao,
         updated_by = auth.uid(),
         updated_at = now()
   where canal_id = p_canal_id;

  return v_nova_versao;
end;
$$;

revoke all on function atendimento.fn_salvar_configuracao_do_aparelho(uuid, uuid, jsonb, bigint) from public, anon;
grant execute on function atendimento.fn_salvar_configuracao_do_aparelho(uuid, uuid, jsonb, bigint) to authenticated;

comment on table atendimento.canal_aparelho is
  'E02-S39: responsável do aparelho (celular/WhatsApp Web) e textos automáticos por canal. "Ninguém" é a chave de desligar.';
