-- Somente clone descartável após 1814; termina sem dados persistidos.
-- A segunda parte exercita o upload SQL real e suas negativas da fixture 1811.
begin;
do $$
declare r record;
begin
 if has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_grupo(text)','execute')
  or has_function_privilege('authenticated','pcm.sso_autorizar_upload_foto_levantamento(text)','execute')
  or has_function_privilege('authenticated','pcm.sso_autorizar_upload_documento_levantamento(text)','execute') then
  raise exception 'helper_privado_exposto';
 end if;
 for r in select * from (values
  ('s176_foto_upload'),('s176_foto_upload_restrito'),('s178_foto_upload'),
  ('s178_foto_upload_restrito'),('s178_documento_upload'),('s178_documento_upload_restrito')
 ) as p(nome) loop
  if not exists(select 1 from pg_catalog.pg_policy where polrelid='storage.objects'::regclass
    and polname=r.nome and pg_catalog.pg_get_expr(polwithcheck,polrelid) like '%CASE%'
    and pg_catalog.pg_get_expr(polwithcheck,polrelid) like '%sso-retorno-evidencias%') then
   raise exception 'policy_nao_isolada: %',r.nome;
  end if;
 end loop;
 -- bucket_id é NOT NULL no Storage; testar três valores lógicos possíveis do predicado restante.
 if exists(select 1 from (values ('sso-retorno-evidencias'),('sso-grupos-fotos'),('outro')) b(bucket)
   cross join (values (true),(false),(null::boolean)) t(restante)
   where ((case when b.bucket='sso-retorno-evidencias' then false else b.bucket='sso-grupos-fotos' and t.restante end)
          is distinct from (b.bucket='sso-grupos-fotos' and t.restante))
      or ((case when b.bucket='sso-retorno-evidencias' then true else b.bucket<>'sso-grupos-fotos' or t.restante end)
          is distinct from (b.bucket<>'sso-grupos-fotos' or t.restante))) then
  raise exception 'expressao_divergente';
 end if;
end $$;
rollback;
\ir manual_E01-S168_politica_upload_1811.sql
