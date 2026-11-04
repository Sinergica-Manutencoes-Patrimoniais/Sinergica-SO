-- ADR-1155: preserva eventos de exceção já vinculados a intenções.
create function pcm.sso_proteger_evento_material_vinculado() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if exists(select 1 from pcm.sso_intencao_material_origens r where r.lista_id=old.lista_id and r.evento_revisao=old.revisao) then
  raise exception 'evento_material_vinculado_imutavel' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function pcm.sso_proteger_evento_material_vinculado() from public,anon,authenticated,service_role;
create trigger sso_evento_material_vinculado_guard before update or delete on pcm.sso_lista_materiais_eventos
 for each row execute function pcm.sso_proteger_evento_material_vinculado();
