-- E01-S53: respostas Auvo são idempotentes e eventos antigos não regressam avaliação local.
-- Reverso: revoke execute on pcm.upsert_avaliacoes_preventivas(jsonb) from service_role;
-- depois drop function pcm.upsert_avaliacoes_preventivas(jsonb).

create or replace function pcm.upsert_avaliacoes_preventivas(p_linhas jsonb)
returns integer
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_linha jsonb;
  v_id uuid;
  v_total integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Somente service_role sincroniza avaliações preventivas' using errcode = '42501';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Linhas de avaliação devem ser array JSON' using errcode = '22023';
  end if;

  for v_linha in select value from jsonb_array_elements(p_linhas) loop
    insert into pcm.avaliacoes_preventivas (
      ocorrencia_id, chave_origem, item_referencia, local_informado, resposta, fotos, medicoes,
      auvo_updated_at, recebido_em
    ) values (
      (v_linha ->> 'ocorrencia_id')::uuid,
      v_linha ->> 'chave_origem',
      v_linha ->> 'item_referencia',
      v_linha ->> 'local_informado',
      coalesce(v_linha -> 'resposta', '{}'::jsonb),
      coalesce(v_linha -> 'fotos', '[]'::jsonb),
      coalesce(v_linha -> 'medicoes', '[]'::jsonb),
      nullif(v_linha ->> 'auvo_updated_at', '')::timestamptz,
      coalesce(nullif(v_linha ->> 'recebido_em', '')::timestamptz, now())
    ) on conflict (ocorrencia_id, chave_origem) do update set
      item_referencia = excluded.item_referencia,
      local_informado = excluded.local_informado,
      resposta = excluded.resposta,
      fotos = excluded.fotos,
      medicoes = excluded.medicoes,
      auvo_updated_at = excluded.auvo_updated_at,
      recebido_em = excluded.recebido_em
    where (
      excluded.auvo_updated_at is not null
      and (
        pcm.avaliacoes_preventivas.auvo_updated_at is null
        or excluded.auvo_updated_at >= pcm.avaliacoes_preventivas.auvo_updated_at
      )
    ) or (
      excluded.auvo_updated_at is null
      and pcm.avaliacoes_preventivas.auvo_updated_at is null
    )
    returning id into v_id;
    if found then v_total := v_total + 1; end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function pcm.upsert_avaliacoes_preventivas(jsonb) from public;
grant execute on function pcm.upsert_avaliacoes_preventivas(jsonb) to service_role;
