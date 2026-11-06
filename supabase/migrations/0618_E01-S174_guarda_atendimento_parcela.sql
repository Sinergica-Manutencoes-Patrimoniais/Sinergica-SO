-- ADR-0392: proteção opt-in; comportamento legado preservado com gate desligado.
create table pcm.sso_exigir_revisao_atendimento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_exigir_revisao_atendimento_gate(id,habilitado) values(true,false);
alter table pcm.sso_exigir_revisao_atendimento_gate enable row level security;alter table pcm.sso_exigir_revisao_atendimento_gate force row level security;
revoke all on pcm.sso_exigir_revisao_atendimento_gate from public,anon,authenticated,service_role;
create function pcm.sso_guardar_atendimento_revisado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_revisao pcm.sso_revisoes_parcela%rowtype;
begin
  if new.situacao='atendida' and (old.situacao is distinct from new.situacao or old.os_atendimento_id is distinct from new.os_atendimento_id) and coalesce((select habilitado from pcm.sso_exigir_revisao_atendimento_gate where id),false) then
    select * into v_revisao from pcm.sso_revisoes_parcela where parcela_id=new.id order by revisao desc limit 1;
    if not found or v_revisao.atendida is not true or new.os_atendimento_id is null or v_revisao.os_id is distinct from new.os_atendimento_id or not exists(
      select 1 from pcm.sso_atribuicoes_parcela a join pcm.chamados c on c.id=a.chamado_id and c.cliente_id=a.cliente_id and c.deleted_at is null join pcm.ordens_servico o on o.id=a.os_id and o.client_id=a.cliente_id and o.chamado_id=a.chamado_id and o.deleted_at is null and o.status='finalizado'
      where a.parcela_id=new.id and a.chamado_id=new.chamado_id and a.os_id=new.os_atendimento_id and a.cliente_id=v_revisao.cliente_id
    ) then raise exception 'revisao_humana_atendimento_obrigatoria' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_atendimento_revisado() from public,anon,authenticated,service_role;
create trigger sso_guardar_atendimento_revisado before update of situacao,os_atendimento_id on pcm.chamado_escopo_parcelas for each row execute function pcm.sso_guardar_atendimento_revisado();
