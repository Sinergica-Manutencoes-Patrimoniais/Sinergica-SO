-- Teste isolado e reversível: apenas a rejeição de isolamento incompatível.
-- Não demonstra concorrência, sucesso da ponte nem aprovação real (1045 intacta).
begin isolation level repeatable read;
do $$
declare v_recusou boolean;
begin
  v_recusou := false;
  begin
    insert into pcm.ordens_servico (id, ocorrencia_preventiva_id)
      values (gen_random_uuid(), gen_random_uuid());
  exception when sqlstate '25001' then v_recusou := true; end;
  if not v_recusou then raise exception 'OS legada aceitou isolamento incompatível'; end if;

  v_recusou := false;
  begin
    insert into pcm.ocorrencias_rotina_vinculos (ocorrencia_preparada_id, ciclo_id, ocorrencia_legada_id, created_by)
      values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
  exception when sqlstate '25001' then v_recusou := true; end;
  if not v_recusou then raise exception 'Ponte calendário aceitou isolamento incompatível'; end if;

  v_recusou := false;
  begin
    insert into pcm.sso_vinculos_visita_legado (request_id, cliente_id, ocorrencia_visita_id, ocorrencia_legada_id, relacao_request_id, motivo, ator_id, payload, resultado)
      values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'teste', gen_random_uuid(), '{}'::jsonb, '{}'::jsonb);
  exception when sqlstate '25001' then v_recusou := true; end;
  if not v_recusou then raise exception 'Ponte Visita aceitou isolamento incompatível'; end if;
end $$;
rollback;
