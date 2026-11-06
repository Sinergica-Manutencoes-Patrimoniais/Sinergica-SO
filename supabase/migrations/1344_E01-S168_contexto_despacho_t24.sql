-- ADR-1178/1186: criado antes dos consumidores; registros sem fotografia não são elegíveis.
alter table pcm.sso_t24_tentativas add column if not exists despacho jsonb
 check(despacho is null or (jsonb_typeof(despacho)='object' and octet_length(despacho::text)<=16384));
