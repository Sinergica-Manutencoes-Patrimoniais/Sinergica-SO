-- ADR-1114: guarda adicional para origem operacional comprovada.
create function comercial.sso_conferir_token_composicao_operacional(p_proposta_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;
begin
 select habilitado into v_habilitado from comercial.sso_composicao_mista_gate where id for share;
 if not found then raise exception 'composicao_mista_indisponivel' using errcode='55000'; end if;
 if v_habilitado and exists(select 1 from comercial.proposta_origens_operacionais o where o.proposta_id=p_proposta_id)
   and not exists(select 1 from comercial.sso_composicao_mista_tokens t where t.txid=pg_catalog.txid_current()
     and t.proposta_id=p_proposta_id and t.ator_id=auth.uid()) then
   raise exception 'composicao_exige_fontes_conferidas' using errcode='23514';
 end if;
end; $$;
revoke all on function comercial.sso_conferir_token_composicao_operacional(uuid) from public,anon,authenticated,service_role;

create function comercial.sso_guardar_item_composicao_operacional() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if tg_op in ('UPDATE','DELETE') then perform comercial.sso_conferir_token_composicao_operacional(old.proposta_id); end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and new.proposta_id is distinct from old.proposta_id) then
   perform comercial.sso_conferir_token_composicao_operacional(new.proposta_id);
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function comercial.sso_guardar_item_composicao_operacional() from public,anon,authenticated,service_role;
create trigger sso_guardar_item_composicao_operacional before insert or update or delete on comercial.proposta_itens
 for each row execute function comercial.sso_guardar_item_composicao_operacional();

create function comercial.sso_guardar_valores_composicao_operacional() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if new.custo_total_centavos is distinct from old.custo_total_centavos or new.piso_centavos is distinct from old.piso_centavos
   or new.preco_sugerido_centavos is distinct from old.preco_sugerido_centavos or new.preco_centavos is distinct from old.preco_centavos
   or new.escopo is distinct from old.escopo or new.observacoes is distinct from old.observacoes or new.valido_ate is distinct from old.valido_ate then
   perform comercial.sso_conferir_token_composicao_operacional(old.id);
 end if;
 return new;
end; $$;
revoke all on function comercial.sso_guardar_valores_composicao_operacional() from public,anon,authenticated,service_role;
create trigger sso_guardar_valores_composicao_operacional before update on comercial.propostas
 for each row execute function comercial.sso_guardar_valores_composicao_operacional();
