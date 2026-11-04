import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

type Dependencias = {
  autenticar: (req: Request) => Promise<string>;
  limitar: (usuario: string) => Promise<boolean>;
  resolver: (req: Request, lancamentoId: string) => Promise<string | null>;
  baixar: (caminho: string) => Promise<Blob | Response>;
  auditar?: (req: Request, requestId: string, lancamentoId: string) => Promise<boolean>;
  cors: (origem: string | null) => Record<string, string>;
};
const entrada = z.object({ lancamentoId: z.string().uuid() }).strict();

export function criarTransporteStorage(url: string, chave: string, prazoMs = 15_000) {
  return async (caminho: string): Promise<Response> => {
    const partes = caminho.split("/");
    if (partes.some((parte) => !parte || parte === "." || parte === ".." || parte.includes("\\"))) {
      throw new Error("Caminho inválido");
    }
    const endereco = `${url.replace(/\/+$/, "")}/storage/v1/object/authenticated/financeiro-comprovantes/${partes.map(encodeURIComponent).join("/")}`;
    return await fetch(endereco, {
      headers: { Authorization: `Bearer ${chave}`, apikey: chave },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(prazoMs),
    });
  };
}

export function criarHandler(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    const cors = deps.cors(req.headers.get("origin"));
    const reqId = crypto.randomUUID();
    const erro = (status: number, detail: string) =>
      new Response(JSON.stringify({ title: "Erro", status, detail, reqId }), {
        status,
        headers: {
          ...cors,
          "Content-Type": "application/problem+json",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== "POST") return erro(405, "Método não permitido.");
    let usuario: string;
    try {
      usuario = await deps.autenticar(req);
    } catch {
      return erro(401, "Autenticação necessária.");
    }
    let etapa = "limite";
    try {
      if (!await deps.limitar(usuario)) {
        return erro(429, "Muitas solicitações. Tente novamente mais tarde.");
      }
      etapa = "entrada";
      let dados: unknown;
      try {
        if (!req.body) return erro(422, "Entrada inválida.");
        const leitor = req.body.getReader();
        const decodificador = new TextDecoder("utf-8", { fatal: true });
        let tamanho = 0;
        let texto = "";
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          tamanho += value.byteLength;
          if (tamanho > 4096) {
            void leitor.cancel().catch(() => {});
            return erro(413, "Entrada excede o tamanho permitido.");
          }
          texto += decodificador.decode(value, { stream: true });
        }
        dados = JSON.parse(texto + decodificador.decode());
      } catch {
        return erro(422, "Entrada inválida.");
      }
      const validado = entrada.safeParse(dados);
      if (!validado.success) return erro(422, "Entrada inválida.");
      etapa = "autorizacao";
      const caminho = await deps.resolver(req, validado.data.lancamentoId);
      if (!caminho) {
        return erro(404, "Comprovante não encontrado ou sem acesso.");
      }
      etapa = "storage";
      const obtido = await deps.baixar(caminho);
      let arquivo: Blob;
      if (obtido instanceof Response) {
        if (!obtido.ok) {
          void obtido.body?.cancel().catch(() => {});
          throw new Error("Arquivo indisponível");
        }
        const leitor = obtido.body?.getReader();
        const partes: Uint8Array<ArrayBuffer>[] = [];
        let tamanho = 0;
        if (leitor) {
          for (;;) {
            const { done, value } = await leitor.read();
            if (done) break;
            tamanho += value.byteLength;
            if (tamanho > 10 * 1024 * 1024) {
              void leitor.cancel().catch(() => {});
              return erro(413, "Comprovante excede o tamanho permitido.");
            }
            partes.push(new Uint8Array(value));
          }
        }
        arquivo = new Blob(partes);
      } else arquivo = obtido;
      if (arquivo.size > 10 * 1024 * 1024) {
        return erro(413, "Comprovante excede o tamanho permitido.");
      }
      etapa = "revalidacao";
      const caminhoAtual = await deps.resolver(req, validado.data.lancamentoId);
      if (!caminhoAtual || caminhoAtual !== caminho) {
        return erro(404, "Comprovante não encontrado ou sem acesso.");
      }
      if (deps.auditar) {
        etapa = "auditoria";
        if (!await deps.auditar(req, reqId, validado.data.lancamentoId)) return erro(404, "Comprovante não encontrado ou sem acesso.");
      }
      return new Response(arquivo, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="comprovante"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      console.error(
        JSON.stringify({
          reqId,
          etapa,
          mensagem: "Falha interna ao consultar comprovante.",
        }),
      );
      return erro(503, "Não foi possível consultar o comprovante.");
    }
  };
}
