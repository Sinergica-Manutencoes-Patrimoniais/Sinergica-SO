type Pedido = {
  userId: string; clienteId: string; requestId: string; loteId: string; fonteId: string; bytes: Uint8Array;
};

type Cliente = {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string } | null }; error: unknown }>;
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  functions: {
    invoke(nome: string, opcoes: { body: Blob; headers: Record<string, string> }): Promise<{ data: unknown; error: unknown }>;
  };
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Transporte preparado, não conectado à interface nem a endpoint publicado. */
export async function receberXlsxHttp(entrada: Pedido, api: Cliente): Promise<{ revision: number; created: boolean }> {
  const p = { ...entrada, bytes: Uint8Array.from(entrada.bytes) };
  if (![p.userId, p.clienteId, p.requestId, p.loteId].every((id) => uuid.test(id))
    || !p.bytes.length || p.bytes.length > 5_242_880) throw new Error("Pedido XLSX inválido.");
  const fonteCodificada = codificarFonteXlsx(p.fonteId);
  const { data: sessao, error: erroSessao } = await api.auth.getSession();
  const token = sessao.session?.access_token;
  if (erroSessao || !token || /\s/.test(token)) throw new Error("Sessão alterada ou indisponível.");
  const { data: identidade, error: erroUsuario } = await api.auth.getUser(token);
  if (erroUsuario || identidade.user?.id.toLowerCase() !== p.userId) throw new Error("Sessão alterada ou indisponível.");
  const atual = await api.auth.getSession();
  if (atual.error || atual.data.session?.access_token !== token) throw new Error("Sessão alterada ou indisponível.");
  let resposta: { data: unknown; error: unknown };
  try {
    resposta = await api.functions.invoke("pcm-cronograma-xlsx-receber", {
      body: new Blob([p.bytes], { type: "application/octet-stream" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream", "x-cliente-id": p.clienteId, "x-fonte-id-utf8": fonteCodificada, "x-pedido-id": p.requestId, "x-lote-id": p.loteId },
    });
  } catch { throw new Error("Resultado não confirmado. Repita com os mesmos identificadores."); }
  const dados = resposta.data as Record<string, unknown> | null;
  if (resposta.error || !dados || dados.requestId !== p.requestId || dados.aggregateId !== p.loteId || dados.state !== "pendente"
    || !Number.isSafeInteger(dados.revision) || (dados.revision as number) < 1 || typeof dados.created !== "boolean") {
    throw new Error("Resultado não confirmado. Repita com os mesmos identificadores.");
  }
  return { revision: dados.revision as number, created: dados.created };
}
import { codificarFonteXlsx } from "./identidade-fonte-xlsx";

