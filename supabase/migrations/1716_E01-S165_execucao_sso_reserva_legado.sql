-- ADR-1572: impede criar execução SSO quando o ciclo foi reservado ao legado.
-- O helper de 1714 resolve aliases e compartilha a trava transacional da escolha PCM.
create function pcm.sso_conferir_chamado_reserva_legado() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_conferir_execucao_sso_reservada(new.cliente_id,new.plano_id,new.preparada_id,
    case tg_table_name when 'sso_chamados_ciclo_preventivo' then 'calendario' else 'visita' end);
  return new;
end; $$;
revoke all on function pcm.sso_conferir_chamado_reserva_legado() from public,anon,authenticated,service_role;
create trigger sso_conferir_reserva_chamado_calendario
  before insert on pcm.sso_chamados_ciclo_preventivo for each row
  execute function pcm.sso_conferir_chamado_reserva_legado();
create trigger sso_conferir_reserva_chamado_visita
  before insert on pcm.sso_chamados_ciclo_visita for each row
  execute function pcm.sso_conferir_chamado_reserva_legado();

-- Executa depois da guarda que serializa associação do Chamado à OS (1709).
-- Não impede atualização comum de OS nem registra novas associações históricas.
create function pcm.sso_conferir_os_reserva_legado() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v record;
begin
  if new.chamado_id is null then return new; end if;
  if tg_op='UPDATE' and new.chamado_id is not distinct from old.chamado_id then return new; end if;
  for v in
    select c.cliente_id,c.plano_id,c.preparada_id,'calendario'::text modo
      from pcm.sso_chamados_ciclo_preventivo c where c.chamado_id=new.chamado_id
    union all
    select c.cliente_id,c.plano_id,c.preparada_id,'visita'::text modo
      from pcm.sso_chamados_ciclo_visita c where c.chamado_id=new.chamado_id
  loop
    perform pcm.sso_conferir_execucao_sso_reservada(v.cliente_id,v.plano_id,v.preparada_id,v.modo);
  end loop;
  return new;
end; $$;
revoke all on function pcm.sso_conferir_os_reserva_legado() from public,anon,authenticated,service_role;
create trigger z_sso_conferir_reserva_os_chamado
  before insert or update of chamado_id on pcm.ordens_servico for each row
  execute function pcm.sso_conferir_os_reserva_legado();
