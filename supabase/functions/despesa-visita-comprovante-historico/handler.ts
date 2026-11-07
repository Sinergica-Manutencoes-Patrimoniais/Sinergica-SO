import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

type Dependencias = {
  autenticar: (req: Request) => Promise<string>;
  limitar: (usuario: string) => Promise<boolean>;
  resolver: (req: Request, despesaId: string, revisao: number) => Promise<string | null>;
  baixar: (caminho: string) => Promise<Blob>;
  auditar: (req: Request, requestId: string, despesaId: string, revisao: number) => Promise<boolean>;
  cors: (origem: string | null) => Record<string, string>;
};
const entrada = z.object({ despesaId: z.string().uuid(), revisao: z.number().int().positive().safe() }).strict();

export function criarHandler(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    const cors = deps.cors(req.headers.get("origin"));
    const reqId = crypto.randomUUID();
    const erro = (status: number, detail: string) => new Response(JSON.stringify({ title: "Erro", status, detail, reqId }), {
      status, headers: { ...cors, "Content-Type": "application/problem+json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return erro(405, "Método não permitido.");
    let usuario: string;
    try { usuario = await deps.autenticar(req); } catch { return erro(401, "Autenticação necessária."); }
    let etapa = "limite";
    try {
      if (!await deps.limitar(usuario)) return erro(429, "Muitas solicitações. Tente novamente mais tarde.");
      etapa = "entrada";
      let dados: unknown;
      try {
        if (!req.body) return erro(422, "Entrada inválida.");
        const leitor = req.body.getReader(); const decodificador = new TextDecoder("utf-8", { fatal: true });
        let tamanho = 0; let texto = "";
        for (;;) {
          const { done, value } = await leitor.read(); if (done) break;
          tamanho += value.byteLength;
          if (tamanho > 4096) { void leitor.cancel().catch(() => {}); return erro(413, "Entrada excede o tamanho permitido."); }
          texto += decodificador.decode(value, { stream: true });
        }
        dados = JSON.parse(texto + decodificador.decode());
      } catch { return erro(422, "Entrada inválida."); }
      const validado = entrada.safeParse(dados); if (!validado.success) return erro(422, "Entrada inválida.");
      const { despesaId, revisao } = validado.data;
      etapa = "autorizacao";
      const caminho = await deps.resolver(req, despesaId, revisao);
      if (!caminho) return erro(404, "Comprovante não encontrado ou sem acesso.");
      etapa = "storage";
      const arquivo = await deps.baixar(caminho);
      if (arquivo.size > 10 * 1024 * 1024) return erro(413, "Comprovante excede o tamanho permitido.");
      etapa = "revalidacao";
      if (await deps.resolver(req, despesaId, revisao) !== caminho) return erro(404, "Comprovante não encontrado ou sem acesso.");
      etapa = "auditoria";
      if (!await deps.auditar(req, reqId, despesaId, revisao)) return erro(404, "Comprovante não encontrado ou sem acesso.");
      return new Response(arquivo, { status: 200, headers: { ...cors, "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="comprovante"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    } catch {
      console.error(JSON.stringify({ reqId, etapa, mensagem: "Falha interna ao consultar comprovante histórico." }));
      return erro(503, "Não foi possível consultar o comprovante.");
    }
  };
}
