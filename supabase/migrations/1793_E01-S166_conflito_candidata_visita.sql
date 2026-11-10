-- ADR-1651: conflito de candidata não representa serialização SQL.
do $patch$
declare
  d text := pg_catalog.pg_get_functiondef('pcm.sso_vincular_nova_visita()'::regprocedure);
  a text := 'raise exception ''visita_candidata_alterada'' using errcode=''40001''';
  b text := 'raise exception ''visita_candidata_alterada'' using errcode=''P0020''';
begin
  if (length(d)-length(replace(d,a,'')))/length(a) <> 1 then
    raise exception 'vinculo_nova_visita_incompativel' using errcode='55000';
  end if;
  execute replace(d,a,b);
end;
$patch$;
