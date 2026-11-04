-- ADR-0436: defesa adicional para tabelas preparadas; não afeta geradores legados.
create table pcm.sso_guarda_geracao_plano_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_guarda_geracao_plano_gate enable row level security;
alter table pcm.sso_guarda_geracao_plano_gate force row level security;
revoke all on pcm.sso_guarda_geracao_plano_gate from public,anon,authenticated,service_role;
insert into pcm.sso_guarda_geracao_plano_gate(id,habilitado) values(true,false);

create function pcm.sso_guardar_insercao_ocorrencia_plano() returns trigger language plpgsql security definer set search_path='' as $$
declare v_estado text;
begin
 if not coalesce((select habilitado from pcm.sso_guarda_geracao_plano_gate where id),false) then return new; end if;
 select estado into v_estado from pcm.planos_manutencao where id=new.plano_id for share;
 if not found or v_estado not in ('aprovado','ativo') then raise exception 'plano_inativo_nao_gera_ocorrencia' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_insercao_ocorrencia_plano() from public,anon,authenticated,service_role;
create trigger sso_geracao_plano_calendario before insert on pcm.ocorrencias_rotina_preparadas for each row execute function pcm.sso_guardar_insercao_ocorrencia_plano();
create trigger sso_geracao_plano_visita before insert on pcm.ocorrencias_visita_preparadas for each row execute function pcm.sso_guardar_insercao_ocorrencia_plano();
