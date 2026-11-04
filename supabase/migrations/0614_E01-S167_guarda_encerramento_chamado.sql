-- ADR-0388: gate controla apenas transição de encerramento, sem afetar demais ações.
create table pcm.sso_token_encerramento_chamado(txid bigint not null,chamado_id uuid not null,primary key(txid,chamado_id));
alter table pcm.sso_token_encerramento_chamado enable row level security;
alter table pcm.sso_token_encerramento_chamado force row level security;
revoke all on pcm.sso_token_encerramento_chamado from public,anon,authenticated,service_role;
create function pcm.sso_guardar_encerramento_chamado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) and new.sso_encerrado_em is not null and new.sso_encerrado_em is distinct from old.sso_encerrado_em
 and not exists(select 1 from pcm.sso_token_encerramento_chamado t where t.txid=pg_catalog.txid_current() and t.chamado_id=new.id) then raise exception 'encerramento_conferido_obrigatorio' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_encerramento_chamado() from public,anon,authenticated,service_role;
create trigger sso_guardar_encerramento_chamado before update of sso_encerrado_em on pcm.chamados for each row execute function pcm.sso_guardar_encerramento_chamado();
