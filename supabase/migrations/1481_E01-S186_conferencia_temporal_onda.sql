-- ADR-1331: defesa adicional na decisão; sem liberar produção ou executar testes.
create table pcm.sso_conferencia_temporal_onda_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_temporal_onda_gate(id,habilitado) values(true,false);
alter table pcm.sso_conferencia_temporal_onda_gate enable row level security;
alter table pcm.sso_conferencia_temporal_onda_gate force row level security;
revoke all on pcm.sso_conferencia_temporal_onda_gate from public,anon,authenticated,service_role;

create function pcm.sso_conferir_data_evidencia_onda() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_item jsonb; v_id uuid; v_cenario text; v_e pcm.sso_evidencias_ondas%rowtype; v_ultima timestamptz;
begin
  perform 1 from pcm.sso_conferencia_temporal_onda_gate where id and habilitado for share;
  if not found then return new; end if;
  if jsonb_typeof(new.evidencias) is distinct from 'array' then raise exception 'evidencias_invalidas' using errcode='23514'; end if;
  for v_item in select value from jsonb_array_elements(new.evidencias) loop
    begin v_id:=(v_item->>'id')::uuid; exception when invalid_text_representation then raise exception 'evidencias_invalidas' using errcode='23514'; end;
    v_cenario:=v_item->>'cenario';
    select * into v_e from pcm.sso_evidencias_ondas e where e.id=v_id and e.cliente_id=new.cliente_id
      and e.onda=new.onda and e.cenario=v_cenario and e.versao=new.versao and e.ambiente=new.ambiente
      and e.revisao<=new.revisao_evidencias;
    if not found or not isfinite(v_e.executado_em) or v_e.resultado<>'passou'
      or not exists(select 1 from unnest(v_e.identificadores) x where x is not null and length(btrim(x))>0)
      or not exists(select 1 from unnest(v_e.artefatos) x where x is not null and length(btrim(x))>0) then
      raise exception 'evidencia_incompleta_ou_invalida' using errcode='23514';
    end if;
    if exists(select 1 from pcm.sso_evidencias_ondas e where e.cliente_id=new.cliente_id and e.onda=new.onda
      and e.cenario=v_cenario and e.versao=new.versao and e.ambiente=new.ambiente
      and e.revisao<=new.revisao_evidencias and not isfinite(e.executado_em)) then
      raise exception 'data_evidencia_invalida' using errcode='23514';
    end if;
    select max(e.executado_em) into v_ultima from pcm.sso_evidencias_ondas e where e.cliente_id=new.cliente_id
      and e.onda=new.onda and e.cenario=v_cenario and e.versao=new.versao and e.ambiente=new.ambiente
      and e.revisao<=new.revisao_evidencias;
    if v_e.executado_em is distinct from v_ultima or exists(select 1 from pcm.sso_evidencias_ondas e
      where e.cliente_id=new.cliente_id and e.onda=new.onda and e.cenario=v_cenario and e.versao=new.versao
        and e.ambiente=new.ambiente and e.revisao<=new.revisao_evidencias and e.executado_em=v_ultima
        and (e.resultado<>'passou' or not exists(select 1 from unnest(e.identificadores) x where x is not null and length(btrim(x))>0)
          or not exists(select 1 from unnest(e.artefatos) x where x is not null and length(btrim(x))>0))) then
      raise exception 'evidencia_recente_divergente' using errcode='23514';
    end if;
  end loop;
  return new;
end; $$;
revoke all on function pcm.sso_conferir_data_evidencia_onda() from public,anon,authenticated,service_role;
create trigger sso_conferir_data_evidencia_onda before insert on pcm.sso_decisoes_onda
for each row execute function pcm.sso_conferir_data_evidencia_onda();
