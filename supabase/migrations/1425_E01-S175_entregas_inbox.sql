-- ADR-1278: recibos e leitura privada, sem criar agendamento ou ativar processamento.
create table pcm.sso_origem_campo_entregas(
  envelope_id uuid primary key references pcm.origem_campo_inbox(id),
  integracao text not null,task_id bigint not null,contrato_id uuid not null references pcm.sso_contratos_origem_campo(id),
  os_id uuid not null references pcm.ordens_servico(id),estado text not null check(estado in ('aceito','atrasado','conflito_regressao','repetido','conflito_ordem')),
  criado_em timestamptz not null default now(), foreign key(integracao,task_id) references pcm.sso_origem_campo_processamentos(integracao,task_id)
);
alter table pcm.sso_origem_campo_entregas enable row level security;
alter table pcm.sso_origem_campo_entregas force row level security;
revoke all on pcm.sso_origem_campo_entregas from public,anon,authenticated,service_role;
create trigger sso_origem_campo_entregas_imutaveis before update or delete on pcm.sso_origem_campo_entregas
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_observar_entrega_origem(p_envelope_id uuid,p_contrato_id uuid,p_os_id uuid,p_estado text)
returns void language plpgsql volatile security definer set search_path='' as $$
declare e pcm.origem_campo_inbox%rowtype; ant pcm.sso_origem_campo_entregas%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_envelope_id is null or p_contrato_id is null or p_os_id is null
    or p_estado not in ('aceito','atrasado','conflito_regressao','repetido','conflito_ordem') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into e from pcm.origem_campo_inbox where id=p_envelope_id for update;
  if not found or not exists(select 1 from pcm.sso_origem_campo_processamentos p where p.integracao=e.integracao and p.task_id=e.task_id and p.os_id=p_os_id) then raise exception 'origem_indisponivel' using errcode='23514'; end if;
  select * into ant from pcm.sso_origem_campo_entregas where envelope_id=p_envelope_id;
  if found then
    if ant.integracao is distinct from e.integracao or ant.task_id is distinct from e.task_id or ant.os_id is distinct from p_os_id or ant.contrato_id is distinct from p_contrato_id then raise exception 'entrega_conflitante' using errcode='23505'; end if;
    return;
  end if;
  insert into pcm.sso_origem_campo_entregas(envelope_id,integracao,task_id,contrato_id,os_id,estado) values(e.id,e.integracao,e.task_id,p_contrato_id,p_os_id,p_estado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'origem_campo.entrega_observada','ordens_servico',p_os_id,jsonb_build_object('envelopeId',e.id,'estado',p_estado));
end; $$;
revoke all on function pcm.sso_observar_entrega_origem(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_observar_evento_inserido() returns trigger language plpgsql security definer set search_path='' as $$
declare v_os uuid;
begin
  select os_id into v_os from pcm.sso_origem_campo_processamentos where integracao=new.integracao and task_id=new.task_id;
  if not found then raise exception 'processamento_ausente' using errcode='23514'; end if;
  perform pcm.sso_observar_entrega_origem(new.envelope_id,new.contrato_id,v_os,new.estado);
  return new;
end; $$;
revoke all on function pcm.sso_observar_evento_inserido() from public,anon,authenticated,service_role;
create trigger sso_observar_evento_inserido after insert on pcm.sso_origem_campo_eventos for each row execute function pcm.sso_observar_evento_inserido();

create function pcm.sso_listar_inbox_processamento(p_apos uuid,p_limite integer)
returns table(envelope_id uuid,task_id text,recebido_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' or p_limite is null or p_limite not between 1 and 50 then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
  perform 1 from pcm.origem_campo_inbox_gate where id and habilitado for share;
  if not found then raise exception 'inbox_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_processamento_origem_gate where id and habilitado for share;
  if not found then raise exception 'processamento_desabilitado' using errcode='55000'; end if;
  return query select e.id,e.task_id::text,e.recebido_em from pcm.origem_campo_inbox e
    where e.integracao='auvo' and (p_apos is null or e.id>p_apos)
      and not exists(select 1 from pcm.sso_origem_campo_entregas d where d.envelope_id=e.id)
    order by e.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_inbox_processamento(uuid,integer) from public,anon,authenticated,service_role;
