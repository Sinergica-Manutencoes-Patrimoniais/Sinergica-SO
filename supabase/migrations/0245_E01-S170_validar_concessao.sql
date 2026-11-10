-- E01-S170: concessões ativas só referenciam alvos atuais e disponíveis.
-- Reverso: remover trigger e função; isso volta a aceitar concessões ativas inválidas.
create or replace function config.sso_validar_concessao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.ativa and (
    (new.usuario_id is not null and not exists (
      select 1 from config.usuarios u where u.user_id = new.usuario_id
        and u.ativo and u.papel <> 'cliente-sindico'))
    or (new.perfil_id is not null and not exists (
      select 1 from config.sso_perfis p where p.id = new.perfil_id and p.ativo))
    or (new.cliente_id is not null and not exists (
      select 1 from pcm.clientes c where c.id = new.cliente_id and c.ativo and c.deleted_at is null))
  ) then
    raise exception 'alvo_de_concessao_indisponivel' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function config.sso_validar_concessao() from public, anon, authenticated, service_role;
drop trigger if exists trg_sso_validar_concessao on config.sso_concessoes;
create trigger trg_sso_validar_concessao before insert or update on config.sso_concessoes
  for each row execute function config.sso_validar_concessao();
