import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { criarBordaEstruturaXlsx } from "./borda.ts";
import { criarRecepcaoEstruturaXlsx } from "./recepcao-atestada.ts";

type Config = { habilitado: boolean; url: string; publica: string; servico: string; segredo: string; origens: readonly string[] };
const indisponivel = () => new Response(JSON.stringify({ erro: "recepcao_indisponivel" }), { status: 503,
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

/** Composição inativa até configuração explícita; não registra endpoint nem provisiona segredos. */
export function criarBordaEstruturaConfigurada(config: Config, transporte: typeof fetch = fetch, prazoMs = 5_000): (req: Request) => Promise<Response> {
  const p = { ...config, origens: [...config.origens] };
  if (p.habilitado !== true || typeof Worker !== "function" || !Number.isSafeInteger(prazoMs) || prazoMs < 1 || prazoMs > 5_000) return async () => indisponivel();
  try {
    const url = new URL(p.url);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) ||
      url.username || url.password || url.search || url.hash || !p.publica || !p.servico || !/^[0-9a-f]{64}$/.test(p.segredo) || !p.origens.length) throw new Error();
    for (const origem of p.origens) {
      const u = new URL(origem);
      if (u.origin !== origem || !(u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))) throw new Error();
    }
  } catch { return async () => indisponivel(); }
  const segredo = Uint8Array.from(p.segredo.match(/../g)!, (par) => Number.parseInt(par, 16));
  const transporteSeguro: typeof fetch = async (input, init) => {
    const controlador = new AbortController();
    let prazo: ReturnType<typeof setTimeout> | undefined;
    try {
      const requisicao = new Request(input, init);
      const expiracao = new Promise<never>((_resolver, rejeitar) => {
        prazo = setTimeout(() => { controlador.abort(); rejeitar(new Error("Prazo do transporte excedido.")); }, prazoMs);
      });
      return await Promise.race([transporte(requisicao, { signal: AbortSignal.any([requisicao.signal, controlador.signal]) }), expiracao]);
    } catch { throw new Error("Transporte Supabase indisponível."); }
    finally { if (prazo !== undefined) clearTimeout(prazo); }
  };
  const servico = createClient(p.url, p.servico, { global: { fetch: transporteSeguro }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const clienteUsuario = (authorization: string) => createClient(p.url, p.publica, {
    global: { headers: { Authorization: authorization }, fetch: transporteSeguro },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return criarBordaEstruturaXlsx({
    habilitado: true, origens: p.origens,
    autenticar: async (req) => {
      const authorization = req.headers.get("authorization") ?? "";
      if (!/^Bearer [^\s]+$/i.test(authorization)) throw new Error("Não autenticado.");
      const { data, error } = await clienteUsuario(authorization).auth.getUser();
      if (error || !data.user?.id) throw new Error("Não autenticado.");
      return data.user.id;
    },
    limitar: async (usuario) => {
      const { data, error } = await servico.schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
        p_chave: `xlsx-estrutura:${usuario}`, p_limite: 10, p_janela_segundos: 60,
      });
      if (error || typeof data !== "boolean") throw new Error("Limite indisponível.");
      return data;
    },
    autorizar: async (authorization, cliente) => {
      if (!/^Bearer [^\s]+$/i.test(authorization)) return false;
      const usuario = clienteUsuario(authorization);
      const { data: identidade, error: erroIdentidade } = await usuario.auth.getUser();
      if (erroIdentidade || !identidade.user?.id) return false;
      const { data, error } = await usuario.schema("config").rpc("sso_autorizar_acao", { p_acao: "cadastro.gerir", p_cliente_id: cliente });
      if (error) throw new Error("Autorização indisponível.");
      return data === true;
    },
    receber: criarRecepcaoEstruturaXlsx(p.url, p.publica, segredo, transporteSeguro),
  });
}
