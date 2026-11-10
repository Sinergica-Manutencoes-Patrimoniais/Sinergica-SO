// Preparação isolada: não há endpoint ou provedor real de versões imutáveis.
// Não conectar nem implantar até comprovar contrato, autorização e Storage.
type Identidade = { usuario: string };
type Pedido = { requestId: string; despesaId: string };
type Reserva = { estado: "nova" | "pendente" | "concluida"; digest: string; clienteId?: string; caminho?: string; objetoId?: string; versao?: string };
export type Dependencias = {
  autenticar: (req: Request) => Promise<Identidade>;
  habilitado: () => Promise<boolean>;
  autorizar: (identidade: Identidade, despesaId: string) => Promise<boolean>;
  suporteVersaoImutavel: () => Promise<boolean>;
  reservar: (identidade: Identidade, pedido: Pedido, digest: string) => Promise<Reserva>;
  subirImutavel: (bytes: Uint8Array, tipo: string, caminho: string) => Promise<{ objetoId: string; versao: string }>;
  lerVersao: (objetoId: string, versao: string) => Promise<Uint8Array>;
  confirmar: (identidade: Identidade, pedido: Pedido, digest: string, objetoId: string, versao: string) => Promise<{ objetoId: string }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function hash(bytes: Uint8Array) {
  const valor = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(valor), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function criarHandler(d: Dependencias) {
  return async (req: Request): Promise<Response> => {
    const falha = (status: number) => new Response(JSON.stringify({ title: "Ingestão indisponível", status }), { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    if (req.method !== "POST") return falha(405);
    let identidade: Identidade;
    try { identidade = await d.autenticar(req); } catch { return falha(401); }
    try {
      if (!await d.habilitado()) return falha(503);
      const requestId = req.headers.get("x-request-id") ?? "", despesaId = req.headers.get("x-despesa-id") ?? "";
      if (!uuid.test(identidade.usuario) || !uuid.test(requestId) || !uuid.test(despesaId) || !req.body) return falha(422);
      if (!await d.autorizar(identidade, despesaId)) return falha(404);
      if (!await d.suporteVersaoImutavel()) return falha(503);
      const leitor = req.body.getReader(), partes: Uint8Array[] = []; let total = 0;
      for (;;) { const { done, value } = await leitor.read(); if (done) break; total += value.byteLength; if (total > 10485760) { void leitor.cancel().catch(() => {}); return falha(413); } partes.push(value); }
      const bytes = new Uint8Array(total); let pos = 0; for (const parte of partes) { bytes.set(parte, pos); pos += parte.length; }
      const pdf = bytes.length >= 5 && [37, 80, 68, 70, 45].every((b, i) => bytes[i] === b);
      const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
      if (!pdf && !jpeg && !png) return falha(415);
      const digest = await hash(bytes), pedido = { requestId, despesaId }, reserva = await d.reservar(identidade, pedido, digest);
      if (reserva.digest !== digest) return falha(409);
      if (reserva.estado === "concluida") {
        if (!reserva.objetoId || !uuid.test(reserva.objetoId) || !reserva.versao) return falha(503);
        if (await hash(await d.lerVersao(reserva.objetoId, reserva.versao)) !== digest) return falha(409);
        if (!await d.autorizar(identidade, despesaId)) return falha(404);
        return new Response(JSON.stringify({ requestId, objetoId: reserva.objetoId }), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
      }
      if (reserva.estado !== "nova") return falha(409);
      const segmentos = reserva.caminho?.split("/") ?? [];
      if (!reserva.clienteId || !uuid.test(reserva.clienteId) || segmentos.length !== 3 || !segmentos.every((s) => uuid.test(s)) || segmentos[0]?.toLowerCase() !== reserva.clienteId.toLowerCase() || segmentos[1]?.toLowerCase() !== despesaId.toLowerCase()) return falha(503);
      const objeto = await d.subirImutavel(bytes, pdf ? "application/pdf" : jpeg ? "image/jpeg" : "image/png", reserva.caminho!);
      if (!uuid.test(objeto.objetoId) || !objeto.versao) return falha(503);
      if (await hash(await d.lerVersao(objeto.objetoId, objeto.versao)) !== digest) return falha(409);
      if (!await d.autorizar(identidade, despesaId)) return falha(404);
      const confirmado = await d.confirmar(identidade, pedido, digest, objeto.objetoId, objeto.versao);
      if (confirmado.objetoId !== objeto.objetoId) return falha(503);
      return new Response(JSON.stringify({ requestId, objetoId: confirmado.objetoId }), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
    } catch { return falha(503); }
  };
}
