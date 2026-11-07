import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { criarBordaLevantamentoEstruturado } from "./borda-levantamento-estruturado.ts";

type Config = { habilitado: boolean; url: string; publica: string; servico: string; origens: readonly string[] };
const indisponivel = () => new Response(JSON.stringify({ erro: "recepcao_indisponivel" }), {
  status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" },
});

/** Configuração injetada; não registra endpoint, segredo ou agendamento. */
export function criarBordaLevantamentoConfigurada(config: Config, transporte: typeof fetch = fetch): (req: Request) => Promise<Response> {
  const p = { ...config, origens: [...config.origens] };
  if (p.habilitado !== true) return async () => indisponivel();
  try {
    const url = new URL(p.url);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) ||
      url.username || url.password || url.search || url.hash || !p.publica || !p.servico || !p.origens.length) throw new Error();
    for (const origem of p.origens) {
      const u = new URL(origem);
      if (u.origin !== origem || !(u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))) throw new Error();
    }
  } catch { return async () => indisponivel(); }
  const transporteSeguro: typeof fetch = async (input, init) => {
    const requisicao = new Request(input, init);
    const controle = new AbortController();
    let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(() => { controle.abort(); rejeitar(new Error("Prazo excedido; resultado não confirmado.")); }, 10_000);
    });
    try { return await Promise.race([transporte(requisicao, { signal: AbortSignal.any([requisicao.signal, controle.signal]), redirect: "error" }), expiracao]); }
    finally { if (prazo !== undefined) clearTimeout(prazo); }
  };
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const servico = createClient(p.url, p.servico, { ...opcoes, global: { fetch: transporteSeguro } });
  return criarBordaLevantamentoEstruturado({
    habilitado: true, origens: p.origens,
    autenticar: async (authorization) => {
      const cliente = createClient(p.url, p.publica, { ...opcoes, global: { headers: { Authorization: authorization }, fetch: transporteSeguro } });
      const { data, error } = await cliente.auth.getUser();
      if (error || !data.user?.id) throw new Error("Sessão indisponível.");
      return { atorId: data.user.id, cliente };
    },
    limitar: async (atorId) => {
      const { data, error } = await servico.schema("atendimento").rpc("fn_consumir_rate_limit_webhook", {
        p_chave: `levantamento-estruturado:${atorId}`, p_limite: 10, p_janela_segundos: 60,
      });
      if (error || typeof data !== "boolean") throw new Error("Limite indisponível.");
      return data;
    },
  });
}
