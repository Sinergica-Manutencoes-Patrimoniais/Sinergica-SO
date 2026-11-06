-- ADR-1680: o gerador legado respeita estado SSO só para ciclos explicitamente integrados.
create or replace function pcm.sso_indice_legado_reservado_sso(p_legado uuid,p_indice integer)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare r pcm.sso_reservas_ciclo_legado%rowtype; p pcm.planos_manutencao%rowtype;
begin
 select * into r from pcm.sso_reservas_ciclo_legado
 where legado_id=p_legado and indice_legado=p_indice and ativa for share nowait;
 if not found then return false; end if;
 select * into p from pcm.planos_manutencao where id=r.plano_id for share nowait;
 if not found or p.cliente_id is distinct from r.cliente_id
   or not exists(select 1 from pcm.planos_preventivos l where l.id=r.legado_id and l.cliente_id=r.cliente_id for share) then
   raise exception 'reserva_obsoleta_exige_reconciliacao' using errcode='23514';
 end if;
 if (r.foto - 'payload' - 'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(r.plano_id,r.legado_id) then
   raise exception 'reserva_obsoleta_exige_reconciliacao' using errcode='23514';
 end if;
 if r.decisao='somente_sso' then return true; end if;
 if r.decisao='integrar_ponte' and p.estado not in ('aprovado','ativo') then
   raise exception 'plano_inativo_nao_gera_ocorrencia' using errcode='23514';
 end if;
 -- `somente_legado` é uma escolha explícita; não pertence ao gerador deste Plano SSO.
 return false;
end; $$;
revoke all on function pcm.sso_indice_legado_reservado_sso(uuid,integer) from public,anon,authenticated,service_role;
