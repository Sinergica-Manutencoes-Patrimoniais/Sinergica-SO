#!/usr/bin/env bash
# E00-S31 (SEC-006): roda a suíte E2E contra o Supabase LOCAL com seed fictício.
# Uso (da raiz do repo): apps/web/e2e-infra/rodar-e2e-local.sh [args do playwright]
# Pré-requisito: `supabase start` (Docker). Ver apps/web/e2e-infra/README.md.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
SUPABASE_WORKDIR="${SUPABASE_WORKDIR:-$RAIZ}"

status_env="$("$SUPABASE_BIN" --workdir "$SUPABASE_WORKDIR" status -o env 2>/dev/null)" || {
  echo "[E2E] Supabase local não está de pé. Rode 'supabase start' na raiz do repo." >&2
  exit 1
}
API_URL="$(sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' <<<"$status_env")"
ANON_KEY="$(sed -n 's/^ANON_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' <<<"$status_env")"
[[ -n "$API_URL" && -n "$ANON_KEY" ]] || { echo "[E2E] não consegui ler API_URL/ANON_KEY de supabase status" >&2; exit 1; }

PROJECT_ID="$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$SUPABASE_WORKDIR/supabase/config.toml")"
DB_CONTAINER="supabase_db_${PROJECT_ID}"

export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"

# A trava roda aqui também: nunca aplicar seed em algo que não seja local.
(cd "$RAIZ/apps/web" && node --experimental-strip-types -e '
  import("./e2e-infra/guarda-banco.ts").then(({ verificarBancoE2E }) =>
    verificarBancoE2E({ url: process.env.VITE_SUPABASE_URL, chaveAnon: process.env.VITE_SUPABASE_ANON_KEY }))
    .catch((e) => { console.error(e.message); process.exit(1); });
')

echo "[E2E] Supabase local: $API_URL (container $DB_CONTAINER) — aplicando seed fictício"
docker exec -i -e PGOPTIONS="-c app.e2e_permitir_seed=sim" "$DB_CONTAINER" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <"$AQUI/seed-e2e.sql"

cd "$RAIZ/apps/web"
exec pnpm exec playwright test "$@"
