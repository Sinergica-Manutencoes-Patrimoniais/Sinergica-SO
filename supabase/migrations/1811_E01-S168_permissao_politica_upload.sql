-- ADR-1669: permite que a política já existente avalie seu predicado.
do $$
begin
  if pg_catalog.to_regprocedure('pcm.sso_autorizar_upload_evidencia_resposta(text)') is null
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname = 's168_evidencia_upload' and cmd = 'INSERT'
         and with_check like '%sso_autorizar_upload_evidencia_resposta%'
     ) then
    raise exception 'contrato_upload_retorno_incompativel' using errcode = '55000';
  end if;
end $$;
grant execute on function pcm.sso_autorizar_upload_evidencia_resposta(text) to authenticated;
