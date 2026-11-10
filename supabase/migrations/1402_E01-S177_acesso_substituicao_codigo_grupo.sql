-- ADR-1249: entrada autenticada, gate inicialmente fechado.
create table pcm.sso_substituicao_codigo_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_substituicao_codigo_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_substituicao_codigo_grupo_gate enable row level security;
alter table pcm.sso_substituicao_codigo_grupo_gate force row level security;
revoke all on pcm.sso_substituicao_codigo_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_substituir_codigo_grupo(p_request_id uuid, p_grupo_id uuid, p_codigo_anterior text, p_codigo_novo text, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from pcm.sso_substituicao_codigo_grupo_gate where id and habilitado for share;
  if not found then raise exception 'substituicao_desabilitada' using errcode = '55000'; end if;
  return pcm.sso_substituir_codigo_grupo_privado(p_request_id, p_grupo_id, p_codigo_anterior, p_codigo_novo, p_motivo);
end $$;
revoke all on function pcm.sso_substituir_codigo_grupo(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_substituir_codigo_grupo(uuid, uuid, text, text, text) to authenticated;
