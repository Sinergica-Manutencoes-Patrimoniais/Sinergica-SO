#!/usr/bin/env bash
# Exclusivamente em banco descartável sso_aprovacao_clone já migrado.
# As duas fixtures executam BEGIN/ROLLBACK e desligam a guarda 1045 somente na transação.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "sso_aprovacao_clone" ]]; then
  echo "Defina PGDATABASE=sso_aprovacao_clone em um clone descartável." >&2
  exit 1
fi
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
temp_sql="$(mktemp "${TMPDIR:-/tmp}/sso-integrado-calendario.XXXXXX")"
trap 'rm -f "$temp_sql"' EXIT
python3 - "$script_dir/manual_E01-S165_tres_versoes_sem_uso_calendario.sql" "$temp_sql" <<'PYTHON'
import sys
source, dest = sys.argv[1:]
s = open(source, encoding="utf8").read()
old = "grant execute on function pcm.sso_aprovar_revisao_preparada(uuid,integer,uuid,date) to authenticated;"
new = "update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id;\nupdate pcm.sso_concorrencia_impacto_gate set habilitado=true where id;"
call = "pcm.sso_aprovar_revisao_preparada('"
mediated = "pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','"
if s.count(old) != 1 or s.count(call) != 4:
    raise SystemExit("Fixture calendário mudou; revisar adaptação mediada.")
with open(dest, "w", encoding="utf8") as f:
    f.write(s.replace(old, new).replace(call, mediated))
PYTHON
psql -v ON_ERROR_STOP=1 -f "$temp_sql"
psql -v ON_ERROR_STOP=1 -f "$script_dir/manual_E01-S165_tres_versoes_sem_uso_visita.sql"
psql -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='pcm.aprovacao_revisao_tokens'::regclass and tgname='sso_bloquear_aprovacao_impacto_indeterminado' and tgenabled='O') then
  raise exception 'guarda_1045_nao_restaurada';
 end if;
end $$;
SQL
