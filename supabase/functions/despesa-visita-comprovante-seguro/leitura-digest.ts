// Preparação isolada: não há fonte confiável de digest S180 conectada a esta função.
// Não implantar nem substituir a leitura atual antes de validar procedência e rollout.
type Identidade = { usuario: string };
type Referencia = { objetoId: string; digest: string };
export type Dependencias = {
  autenticar: (req: Request) => Promise<Identidade>;
  habilitado: () => Promise<boolean>;
  limitar: (identidade: Identidade) => Promise<boolean>;
  resolver: (identidade: Identidade, despesaId: string) => Promise<Referencia | null>;
  baixar: (objetoId: string) => Promise<Uint8Array>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarLeituraDigest(d: Dependencias) {
  return async (req: Request): Promise<Response> => {
    const erro = (status: number) => new Response(JSON.stringify({ title: "Comprovante indisponível", status }), { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    if (req.method !== "POST") return erro(405);
    let identidade: Identidade;
    try { identidade = await d.autenticar(req); } catch { return erro(401); }
    try {
      if (!await d.habilitado()) return erro(503);
      if (!uuid.test(identidade.usuario)) return erro(401);
      if (!await d.limitar(identidade)) return erro(429);
      const despesa = req.headers.get("x-despesa-id") ?? "";
      if (!uuid.test(despesa)) return erro(422);
      const referencia = await d.resolver(identidade, despesa);
      if (!referencia) return erro(404);
      if (!uuid.test(referencia.objetoId) || !/^[a-f0-9]{64}$/.test(referencia.digest)) return erro(503);
      const bytes = await d.baixar(referencia.objetoId);
      if (bytes.byteLength > 10485760) return erro(413);
      const copia = Uint8Array.from(bytes);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", copia.buffer)), n => n.toString(16).padStart(2, "0")).join("");
      if (digest !== referencia.digest) return erro(409);
      const atual = await d.resolver(identidade, despesa);
      if (!atual || atual.objetoId !== referencia.objetoId || atual.digest !== referencia.digest) return erro(404);
      const pdf = copia.length >= 5 && [37,80,68,70,45].every((v,i) => copia[i] === v);
      const jpeg = copia.length >= 3 && copia[0] === 255 && copia[1] === 216 && copia[2] === 255;
      const png = copia.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => copia[i] === v);
      if (!pdf && !jpeg && !png) return erro(415);
      return new Response(copia.buffer, { headers: { "Content-Type": pdf ? "application/pdf" : jpeg ? "image/jpeg" : "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
    } catch { return erro(503); }
  };
}
