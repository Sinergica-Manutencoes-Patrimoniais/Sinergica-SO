-- ADR-1073: proteção adicional, desligada; não altera dados existentes.
create table pcm.sso_cobertura_continuacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_cobertura_continuacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_cobertura_continuacao_gate enable row level security;
alter table pcm.sso_cobertura_continuacao_gate force row level security;
revoke all on pcm.sso_cobertura_continuacao_gate from public,anon,authenticated,service_role;

create function pcm.sso_guardar_cobertura_continuacao() returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
  if new.situacao<>'atendida' or (old.situacao='atendida' and new.os_atendimento_id is not distinct from old.os_atendimento_id) then return new; end if;
  perform 1 from pcm.sso_cobertura_continuacao_gate where id and habilitado for share;
  if not found then return new; end if;
  if exists(select 1 from pcm.sso_continuacoes_os_parcela x where x.parcela_id=new.id and x.chamado_id=new.chamado_id) then
    if not exists(select 1 from pcm.sso_continuacoes_os_parcela x join pcm.ordens_servico o on o.id=x.os_nova_id and o.chamado_id=x.chamado_id and o.client_id=x.cliente_id and o.deleted_at is null and o.status='finalizado'
      where x.parcela_id=new.id and x.chamado_id=new.chamado_id and x.os_nova_id=new.os_atendimento_id)
      or exists(select 1 from pcm.sso_continuacoes_os_parcela x left join pcm.ordens_servico o on o.id=x.os_nova_id and o.chamado_id=x.chamado_id and o.client_id=x.cliente_id and o.deleted_at is null
        where x.parcela_id=new.id and x.chamado_id=new.chamado_id and (o.id is null or o.status is distinct from 'finalizado'))
      or exists(select 1 from pcm.chamado_continuacoes_propostas p where p.chamado_id=new.chamado_id and p.situacao='pendente'
        and exists(select 1 from pcm.sso_continuacoes_os_parcela x where x.parcela_id=new.id and x.chamado_id=new.chamado_id and p.os_anterior_id in (x.os_anterior_id,x.os_nova_id))) then
      raise exception 'continuacao_exige_conferencia' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_cobertura_continuacao() from public,anon,authenticated,service_role;
create trigger sso_guardar_cobertura_continuacao before update of situacao,os_atendimento_id on pcm.chamado_escopo_parcelas
  for each row execute function pcm.sso_guardar_cobertura_continuacao();
