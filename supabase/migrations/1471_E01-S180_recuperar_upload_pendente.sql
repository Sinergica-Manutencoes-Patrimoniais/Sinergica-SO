-- ADR-1321: preparação aditiva, gate fechado e nenhuma policy de Storage alterada.
create table pcm.sso_recuperar_upload_comprovante_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_recuperar_upload_comprovante_gate(id, habilitado) values (true, false);
alter table pcm.sso_recuperar_upload_comprovante_gate enable row level security;
alter table pcm.sso_recuperar_upload_comprovante_gate force row level security;
revoke all on pcm.sso_recuperar_upload_comprovante_gate from public, anon, authenticated, service_role;

create function pcm.sso_recuperar_upload_comprovante_servico(
  p_usuario_id uuid, p_request_id uuid, p_despesa_id uuid, p_digest text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_reserva jsonb;
  v_objeto uuid;
  v_caminho text;
  v_total bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.sso_recuperar_upload_comprovante_gate where id and habilitado for share;
  if not found then raise exception 'recuperacao_desabilitada' using errcode = '55000'; end if;
  -- Nunca cria reserva ao consultar. O caminho ausente não comprova ausência de upload em voo.
  if not exists (select 1 from pcm.sso_ingestao_comprovante_reservas where request_id = p_request_id) then
    raise exception 'reserva_indisponivel' using errcode = '42501';
  end if;
  v_reserva := pcm.sso_ingestao_comprovante_interno('reservar', p_usuario_id, p_request_id, p_despesa_id, p_digest, null);
  if v_reserva->>'estado' = 'concluida' then return v_reserva; end if;
  if v_reserva->>'estado' is distinct from 'pendente' then raise exception 'reserva_indisponivel' using errcode = '55000'; end if;
  v_caminho := v_reserva->>'caminho';
  select count(*), (array_agg(o.id))[1] into v_total, v_objeto from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where o.bucket_id = 'sso-despesas-visita' and b.public is false and o.name = v_caminho;
  if v_total = 0 then return v_reserva; end if;
  if v_total <> 1 or v_objeto is null then raise exception 'objeto_ambiguo' using errcode = '23514'; end if;
  return jsonb_build_object('estado', 'recuperavel', 'digest', p_digest,
    'clienteId', v_reserva->>'clienteId', 'caminho', v_caminho, 'objetoId', v_objeto);
end $$;
revoke all on function pcm.sso_recuperar_upload_comprovante_servico(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_recuperar_upload_comprovante_servico(uuid, uuid, uuid, text) to service_role;
