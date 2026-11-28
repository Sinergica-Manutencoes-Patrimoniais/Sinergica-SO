/**
 * E00-S31 (SEC-006): trava que impede a suíte E2E de rodar contra o Supabase de PRODUÇÃO.
 *
 * Chamada no topo de `playwright.config.ts`: se lançar, o Playwright aborta ao carregar a
 * configuração, antes de subir o dev server e antes do primeiro teste.
 *
 * Regras (nesta ordem):
 * 1. URL ausente → recusa (nunca cai em default silencioso).
 * 2. URL ou chave anon que mencione o project ref de produção → recusa, sem exceção.
 * 3. Host local (127.0.0.1, localhost, ::1) → aceita.
 * 4. `<ref>.supabase.co` só é aceito se o ref estiver listado em
 *    `E2E_SUPABASE_REFS_PERMITIDOS` (ex.: um projeto de branch/preview), e nunca o de produção.
 * 5. Qualquer outro host → recusa.
 */

export const PROJECT_REF_PRODUCAO = "nudannsrfvjggoergvyn";

const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export class BancoE2ERecusado extends Error {
  constructor(motivo: string) {
    super(
      `[E2E] Recusado antes do primeiro teste: ${motivo}\nA suíte E2E só roda contra Supabase local (ver apps/web/e2e-infra/README.md).`,
    );
    this.name = "BancoE2ERecusado";
  }
}

function refDaChaveAnon(chave: string | undefined): string | null {
  if (!chave) return null;
  const partes = chave.split(".");
  if (partes.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return typeof payload?.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

export function verificarBancoE2E(params: {
  url: string | undefined;
  chaveAnon?: string;
  refsPermitidos?: string;
}): void {
  const { url, chaveAnon, refsPermitidos } = params;
  if (!url) {
    throw new BancoE2ERecusado(
      "VITE_SUPABASE_URL não definido. Rode pelo script apps/web/e2e-infra/rodar-e2e-local.sh.",
    );
  }
  if (url.toLowerCase().includes(PROJECT_REF_PRODUCAO)) {
    throw new BancoE2ERecusado(`VITE_SUPABASE_URL aponta para PRODUÇÃO (${PROJECT_REF_PRODUCAO}).`);
  }
  if (
    chaveAnon?.includes(PROJECT_REF_PRODUCAO) ||
    refDaChaveAnon(chaveAnon) === PROJECT_REF_PRODUCAO
  ) {
    throw new BancoE2ERecusado("VITE_SUPABASE_ANON_KEY é a chave do projeto de PRODUÇÃO.");
  }

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new BancoE2ERecusado(`VITE_SUPABASE_URL inválido: ${url}`);
  }
  if (HOSTS_LOCAIS.has(host)) return;

  const supabaseCo = /^([a-z0-9]{20})\.supabase\.co$/.exec(host);
  if (supabaseCo) {
    const permitidos = (refsPermitidos ?? "")
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter((r) => r && r !== PROJECT_REF_PRODUCAO);
    if (permitidos.includes(supabaseCo[1])) return;
    throw new BancoE2ERecusado(
      `projeto remoto ${supabaseCo[1]} não está em E2E_SUPABASE_REFS_PERMITIDOS.`,
    );
  }
  throw new BancoE2ERecusado(`host ${host} não é local nem projeto permitido.`);
}
