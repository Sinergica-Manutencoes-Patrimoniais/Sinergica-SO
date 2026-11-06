-- ADR-0840: impede que escritores legados reabram escopo de Chamado encerrado.
create function pcm.sso_guardar_os_chamado_encerrado() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_chamado record; v_antigo_chamado uuid; v_os_id uuid; v_antigo_os uuid; v_novo_chamado uuid; v_relevante boolean;
begin
 if tg_op='DELETE' then
   v_antigo_chamado:=old.chamado_id;
   v_antigo_os:=old.id;
   v_os_id:=old.id;
   v_relevante:=true;
 elsif tg_op='INSERT' then
   v_os_id:=new.id;
   v_novo_chamado:=new.chamado_id;
   v_relevante:=true;
 else
   v_antigo_chamado:=old.chamado_id;
   v_antigo_os:=old.id;
   v_os_id:=new.id;
   v_novo_chamado:=new.chamado_id;
   v_relevante:=(
     new.id is distinct from old.id or new.chamado_id is distinct from old.chamado_id or new.client_id is distinct from old.client_id
     or new.deleted_at is distinct from old.deleted_at or (new.status is distinct from old.status and new.status is distinct from 'finalizado'));
 end if;
 if not v_relevante then return new; end if;
 for v_chamado in
   select c.id,c.sso_encerrado_em from pcm.chamados c
   where c.id=v_novo_chamado or c.id=v_antigo_chamado or c.ordem_servico_id=v_os_id or c.ordem_servico_id=v_antigo_os
   order by c.id for share
 loop
   if v_chamado.sso_encerrado_em is not null then raise exception 'chamado_encerrado_requer_reabertura_formal' using errcode='23514'; end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_os_chamado_encerrado() from public,anon,authenticated,service_role;
create trigger sso_guardar_os_chamado_encerrado before insert or delete or update of id,chamado_id,client_id,status,deleted_at
on pcm.ordens_servico for each row execute function pcm.sso_guardar_os_chamado_encerrado();

create function pcm.sso_guardar_referencia_chamado_encerrado() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_direto uuid; v_chamado record;
begin
 if new.ordem_servico_id is not distinct from old.ordem_servico_id then return new; end if;
 if old.sso_encerrado_em is not null then raise exception 'chamado_encerrado_requer_reabertura_formal' using errcode='23514'; end if;
 if new.ordem_servico_id is null then return new; end if;
 select o.chamado_id into v_direto from pcm.ordens_servico o where o.id=new.ordem_servico_id for update;
 for v_chamado in
   select c.id,c.sso_encerrado_em from pcm.chamados c
   where c.id<>new.id and (c.id=v_direto or c.ordem_servico_id=new.ordem_servico_id)
   order by c.id for share
 loop
   if v_chamado.sso_encerrado_em is not null then raise exception 'chamado_encerrado_requer_reabertura_formal' using errcode='23514'; end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_referencia_chamado_encerrado() from public,anon,authenticated,service_role;
create trigger sso_guardar_referencia_chamado_encerrado before update of ordem_servico_id
on pcm.chamados for each row execute function pcm.sso_guardar_referencia_chamado_encerrado();
