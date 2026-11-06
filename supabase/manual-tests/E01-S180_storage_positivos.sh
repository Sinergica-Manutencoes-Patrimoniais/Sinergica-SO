#!/bin/bash
# Executar da raiz, exclusivamente contra o banco sintético isolado nomeado.
set -euo pipefail
rtk proxy sed \
  -e '/^\\ir ..\/migrations\/0966_/d' \
  -e '/^\\ir E01-S168_finalizacao_fixture_real.sql/r supabase/tests/E01-S168_finalizacao_fixture_real.sql' \
  -e '/^\\ir E01-S168_finalizacao_fixture_real.sql/d' \
  -e 's/select plan(49);/select plan(55);/' \
  supabase/tests/manual_s180_storage_helpers_autorizacao.sql |
rtk proxy awk '
/^create function pcm.sso_teste_dispatch_storage\(/ {
  print "create function pcm.sso_teste_dispatch_storage(p_bucket text,p_nome text,p_owner text) returns boolean language sql volatile security definer set search_path=\047\047 as $$ select pcm.sso_s180_dispatch_storage_experimental(p_bucket,p_nome,p_owner) $$;"
  skipping=1; next
}
skipping && /^end \$\$;/ { skipping=0; next }
!skipping {
  if (/^select \* from finish\(\);/) {
    while ((getline linha < "supabase/manual-tests/E01-S180_storage_revogacao_sequencial.sql") > 0) print linha
    close("supabase/manual-tests/E01-S180_storage_revogacao_sequencial.sql")
  }
  print
  if (/^alter policy s168_evidencia_upload_restrito/) {
    print "create function pcm.sso_teste_guard_positivo(p_bucket text) returns boolean language sql stable security definer set search_path=\047\047 as $$ select pcm.sso_s180_guard_storage_experimental(p_bucket) $$;"
    print "revoke all on function pcm.sso_teste_guard_positivo(text) from public,anon,authenticated,service_role;"
    print "grant execute on function pcm.sso_teste_guard_positivo(text) to authenticated;"
    print "create policy s180_teste_guard_positivo on storage.objects as restrictive for insert to authenticated with check (pcm.sso_teste_guard_positivo(bucket_id));"
  }
}' |
rtk proxy docker exec -i sso_diagnostico_reconstrucao psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 |
rtk proxy awk '{ print; if ($0 ~ /not ok|Looks like you failed/) falha=1 } END { if (falha) exit 1 }'
