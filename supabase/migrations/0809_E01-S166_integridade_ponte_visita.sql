-- ADR-0584: proteção opt-in de identidade; não estabelece protocolo de locks.
create table pcm.sso_integridade_ponte_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_integridade_ponte_visita_gate enable row level security;
alter table pcm.sso_integridade_ponte_visita_gate force row level security;
revoke all on pcm.sso_integridade_ponte_visita_gate from public,anon,authenticated,service_role;
insert into pcm.sso_integridade_ponte_visita_gate(id,habilitado) values(true,false);

create function pcm.sso_guardar_identidade_ponte_visita() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_vinculado boolean:=false;
begin
 if not coalesce((select habilitado from pcm.sso_integridade_ponte_visita_gate where id),false) then
   if tg_op='DELETE' then return old; end if; return new;
 end if;
 if tg_table_name='ocorrencias_visita_preparadas' then
   select exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_visita_id=old.id) into v_vinculado;
 elsif tg_table_name='visita_origem_contratual' then
   select exists(select 1 from pcm.sso_vinculos_visita_legado v join pcm.ocorrencias_visita_preparadas o on o.id=v.ocorrencia_visita_id where o.visita_id=old.visita_id) into v_vinculado;
 elsif tg_table_name='ocorrencias_preventivas' then
   select exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_legada_id=old.id) into v_vinculado;
   if tg_op='UPDATE' and new.id is not distinct from old.id and new.plano_id is not distinct from old.plano_id and new.vencimento is not distinct from old.vencimento then return new; end if;
 else
   raise exception 'tabela_nao_suportada' using errcode='55000';
 end if;
 if v_vinculado and (tg_op='DELETE' or to_jsonb(new) is distinct from to_jsonb(old)) then
   raise exception 'identidade_ponte_visita_imutavel' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function pcm.sso_guardar_identidade_ponte_visita() from public,anon,authenticated,service_role;
create trigger sso_guardar_identidade_ponte_visita_preparada before update or delete on pcm.ocorrencias_visita_preparadas for each row execute function pcm.sso_guardar_identidade_ponte_visita();
create trigger sso_guardar_identidade_ponte_visita_origem before update or delete on pcm.visita_origem_contratual for each row execute function pcm.sso_guardar_identidade_ponte_visita();
create trigger sso_guardar_identidade_ponte_visita_legada before update or delete on pcm.ocorrencias_preventivas for each row execute function pcm.sso_guardar_identidade_ponte_visita();
