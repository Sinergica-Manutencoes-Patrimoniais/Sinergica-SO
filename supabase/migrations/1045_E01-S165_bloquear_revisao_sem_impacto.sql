-- ADR-0857: revisão exige prova integral de impactos ainda não disponível.
-- A guarda é deliberadamente independente das flags; aprovação inicial não usa o token.
create or replace function pcm.sso_bloquear_aprovacao_impacto_indeterminado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  raise exception 'aprovacao_bloqueada_impacto_e_fuso_nao_comprovados' using errcode='23514';
end; $$;
revoke all on function pcm.sso_bloquear_aprovacao_impacto_indeterminado() from public,anon,authenticated,service_role;
