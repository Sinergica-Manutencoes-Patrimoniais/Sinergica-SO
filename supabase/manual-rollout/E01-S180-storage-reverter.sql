-- ADR-1063. Somente após revisão e aprovação; restaura a fotografia registrada.
-- Recusa mudanças nas políticas instaladas desde o rollout.
begin;
do $$ begin
  if pg_catalog.current_setting('sso.storage_reversao_revisada',true) is distinct from 'sim' then
    raise exception 'reversao_storage_nao_autorizada';
  end if;
end $$;
lock table storage.objects in access exclusive mode;
do $$
declare v_original jsonb; v_instaladas jsonb; v_atual jsonb; v_item record;
begin
  select originais,instaladas into v_original,v_instaladas from pcm.sso_s180_storage_rollout_snapshot where id and revertido_em is null for update;
  if not found or v_instaladas is null or (select count(*) from jsonb_object_keys(v_original))<>12 then raise exception 'fotografia_storage_indisponivel'; end if;
  select jsonb_object_agg(policyname,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'with_check',with_check))
    into v_atual from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname in (select jsonb_object_keys(v_instaladas));
  if v_atual is distinct from v_instaladas then raise exception 'politicas_modificadas_apos_rollout'; end if;
  for v_item in select key,value from jsonb_each(v_original) loop
    if v_item.value->>'with_check' is null then raise exception 'expressao_original_ausente'; end if;
    execute pg_catalog.format('alter policy %I on storage.objects with check (%s)',v_item.key,v_item.value->>'with_check');
  end loop;
  update pcm.sso_s180_storage_rollout_snapshot set revertido_em=now() where id;
end $$;
drop policy s180_dispatch_guard_global on storage.objects;
drop function pcm.sso_s180_upload_policy(text,text,text);
drop function pcm.sso_s180_upload_guard_global(text);
commit;
