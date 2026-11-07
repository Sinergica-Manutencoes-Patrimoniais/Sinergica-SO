import { createClient } from "npm:@supabase/supabase-js@2.108.2";

/** Não usa credencial de serviço. Consulta de capacidade não substitui autorização na gravação. */
export function criarAutorizadorXlsx(url: string, chavePublica: string, transporte: typeof fetch = fetch) {
  if (!url || !chavePublica) throw new Error("Configuração Supabase ausente.");
  return async (authorization: string, clienteId: string): Promise<boolean> => {
    if (!/^Bearer [^\s]+$/i.test(authorization)) return false;
    const transporteSeguro: typeof fetch = async (input, init) => {
      try { return await transporte(input, init); }
      catch { throw new Error("Falha de transporte Supabase."); }
    };
    const cliente = createClient(url, chavePublica, {
      global: { headers: { Authorization: authorization }, fetch: transporteSeguro },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identidade, error: erroIdentidade } = await cliente.auth.getUser();
    if (erroIdentidade || !identidade.user?.id) return false;
    const { data, error } = await cliente.schema("config").rpc("sso_autorizar_acao", { p_acao: "plano.gerir", p_cliente_id: clienteId });
    if (error) throw new Error("Autorização indisponível.");
    return data === true;
  };
}
