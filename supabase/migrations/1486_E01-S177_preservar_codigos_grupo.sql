-- ADR-1336: preservar identidade, códigos anteriores e evidência de origem.
create function pcm.sso_guardar_historico_codigo_grupo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
    and old.atual is true and new.atual is false
    and (pg_catalog.to_jsonb(old) - 'atual') = (pg_catalog.to_jsonb(new) - 'atual') then
    return new;
  end if;
  raise exception 'historico_codigo_grupo_imutavel' using errcode = '55000';
end;
$$;
revoke all on function pcm.sso_guardar_historico_codigo_grupo() from public, anon, authenticated, service_role;

create trigger sso_codigo_grupo_imutavel
  before update or delete on pcm.sso_codigos_grupo_quantitativo
  for each row execute function pcm.sso_guardar_historico_codigo_grupo();

create trigger sso_codigo_grupo_nao_truncar
  before truncate on pcm.sso_codigos_grupo_quantitativo
  for each statement execute function pcm.sso_guardar_historico_codigo_grupo();

-- O comando registra recibo e auditoria depois do UPDATE, na mesma transação.
create function pcm.sso_exigir_auditoria_codigo_grupo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from pcm.sso_codigo_comandos c
    join audit.events e on e.action = 'codigo.substituido'
      and e.entity = 'grupo_quantitativo' and e.entity_id = old.grupo_id
      and e.actor_id = c.ator_id and e.payload->>'requestId' = c.request_id::text
      and e.payload->>'clienteId' = old.cliente_id::text
      and e.payload->>'codigoAnterior' = old.codigo
      and e.payload->>'codigoNovo' = c.payload->>'codigoNovo'
      and e.payload->>'motivo' = c.payload->>'motivo'
    join pcm.sso_codigos_grupo_quantitativo novo on novo.id::text = c.resultado->>'codigoId'
      and novo.grupo_id = old.grupo_id and novo.cliente_id = old.cliente_id
      and novo.request_id = c.request_id and novo.ator_id = c.ator_id
      and novo.codigo = c.payload->>'codigoNovo'
    where c.cliente_id = old.cliente_id
      and c.payload->>'tipo' = 'grupo_quantitativo'
      and c.payload->>'ativoId' = old.grupo_id::text
      and c.payload->>'codigoAnterior' = old.codigo
      and c.resultado->>'aliasId' = old.id::text
      and c.resultado->>'requestId' = c.request_id::text
  ) then raise exception 'substituicao_codigo_sem_auditoria' using errcode = '23514'; end if;
  return null;
end;
$$;
revoke all on function pcm.sso_exigir_auditoria_codigo_grupo() from public, anon, authenticated, service_role;
create constraint trigger sso_codigo_grupo_auditoria
  after update on pcm.sso_codigos_grupo_quantitativo
  deferrable initially deferred for each row execute function pcm.sso_exigir_auditoria_codigo_grupo();
