import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { criarAutorizadorXlsx } from "./autorizacao.ts";
import { criarBordaXlsx } from "./borda.ts";
import { criarRecepcaoAtestada } from "./recepcao-atestada.ts";
import { processarXlsxIncrementalExperimental } from "./processar-incremental-experimental.ts";
import { processarXlsxIsolado } from "./processar-isolado.ts";

type Config = { habilitado: boolean; url: string; publica: string; servico: string; segredo: string; origens: readonly string[]; incrementalLocal?: boolean };
const indisponivel = () => new Response(JSON.stringify({ erro: "recepcao_indisponivel" }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

/** Composição não registrada. Não provisiona segredo, não publica rota nem abre gates. */
export function criarBordaConfigurada(config: Config, transporte: typeof fetch = fetch, prazoTransporteMs = 5_000): (req: Request) => Promise<Response> {
  const p = { ...config, origens: [...config.origens] };
  if (p.habilitado !== true || (!p.incrementalLocal && typeof Worker !== "function") || !Number.isSafeInteger(prazoTransporteMs) || prazoTransporteMs < 1 || prazoTransporteMs > 5_000) return async () => indisponivel();
  try {
    const url = new URL(p.url);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) || url.username || url.password || url.search || url.hash || !p.publica || !p.servico || !/^[0-9a-f]{64}$/.test(p.segredo) || !p.origens.length) throw new Error();
    if (p.incrementalLocal && !(url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error();
    for (const origem of p.origens) { const u = new URL(origem); if (u.origin !== origem || !(u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))) throw new Error(); }
  } catch { return async () => indisponivel(); }
  const segredo = Uint8Array.from(p.segredo.match(/../g)!, (par) => Number.parseInt(par, 16));
  const transporteSeguro: typeof fetch = async (input, init) => {
    try {
      const requisicao = new Request(input, init);
      const signal = AbortSignal.any([requisicao.signal, AbortSignal.timeout(prazoTransporteMs)]);
      return await transporte(requisicao, { signal });
    } catch { throw new Error("Transporte Supabase indisponível."); }
  };
  const servico = createClient(p.url, p.servico, { global: { fetch: transporteSeguro }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return criarBordaXlsx({
    habilitado: true, origens: p.origens,
    autenticar: async (req) => {
      const authorization = req.headers.get("authorization") ?? "";
      if (!/^Bearer [^\s]+$/i.test(authorization)) throw new Error("Não autenticado.");
      const usuario = createClient(p.url, p.publica, { global: { headers: { Authorization: authorization }, fetch: transporteSeguro }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data, error } = await usuario.auth.getUser();
      if (error || !data.user?.id) throw new Error("Não autenticado.");
      return data.user.id;
    },
    limitar: async (usuario) => {
      const { data, error } = await servico.schema("atendimento").rpc("fn_consumir_rate_limit_webhook", { p_chave: `xlsx-cronograma:${usuario}`, p_limite: 10, p_janela_segundos: 60 });
      if (error || typeof data !== "boolean") throw new Error("Limite indisponível.");
      return data;
    },
    autorizar: criarAutorizadorXlsx(p.url, p.publica, transporteSeguro),
    receber: criarRecepcaoAtestada(p.url, p.publica, segredo, transporteSeguro,
      p.incrementalLocal ? processarXlsxIncrementalExperimental : processarXlsxIsolado),
  });
}
