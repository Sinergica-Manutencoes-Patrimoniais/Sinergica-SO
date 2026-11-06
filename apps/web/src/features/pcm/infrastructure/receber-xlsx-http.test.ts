import { describe, expect, it, vi } from "vitest";
import { receberXlsxHttp } from "./receber-xlsx-http";

const pedido = { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", requestId: "cccccccc-cccc-cccc-cccc-cccccccccccc", loteId: "dddddddd-dddd-dddd-dddd-dddddddddddd", fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) };
const recibo = { requestId: pedido.requestId, aggregateId: pedido.loteId, state: "pendente", revision: 1, created: true };
function cliente() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: pedido.userId } }, error: null }),
    },
    functions: { invoke: vi.fn().mockResolvedValue({ data: recibo, error: null }) },
  };
}
describe("recepção XLSX por HTTP", () => {
  it("envia os bytes originais e os identificadores estáveis com o token verificado", async () => {
    const api = cliente();
    await expect(receberXlsxHttp(pedido, api)).resolves.toEqual({ revision: 1, created: true });
    const [nome, opcoes] = api.functions.invoke.mock.calls[0]!;
    expect(nome).toBe("pcm-cronograma-xlsx-receber");
    expect(opcoes.headers).toEqual({ authorization: "Bearer token", "content-type": "application/octet-stream", "x-cliente-id": pedido.clienteId, "x-fonte-id-utf8": pedido.fonteId, "x-pedido-id": pedido.requestId, "x-lote-id": pedido.loteId });
    expect(Array.from(new Uint8Array(await opcoes.body.arrayBuffer()))).toEqual([1, 2, 3]);
    expect(api.auth.getUser).toHaveBeenCalledWith("token");
  });
  it("não envia quando a sessão pertence a outra pessoa", async () => {
    const api = cliente(); api.auth.getUser.mockResolvedValue({ data: { user: { id: pedido.clienteId } }, error: null });
    await expect(receberXlsxHttp(pedido, api)).rejects.toThrow("Sessão alterada");
    expect(api.functions.invoke).not.toHaveBeenCalled();
  });
  it("não envia se o token da sessão mudou durante a verificação", async () => {
    const api = cliente();
    api.auth.getSession.mockResolvedValueOnce({ data: { session: { access_token: "token" } }, error: null })
      .mockResolvedValueOnce({ data: { session: { access_token: "outro" } }, error: null });
    await expect(receberXlsxHttp(pedido, api)).rejects.toThrow("Sessão alterada");
    expect(api.functions.invoke).not.toHaveBeenCalled();
  });
  it("trata recibo divergente como resultado incerto", async () => {
    const api = cliente(); api.functions.invoke.mockResolvedValue({ data: { ...recibo, requestId: pedido.loteId }, error: null });
    await expect(receberXlsxHttp(pedido, api)).rejects.toThrow("Resultado não confirmado");
  });
  it("preserva o mesmo pedido e lote ao repetir após erro de rede", async () => {
    const api = cliente(); api.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error("rede") });
    await expect(receberXlsxHttp(pedido, api)).rejects.toThrow("Resultado não confirmado");
    await receberXlsxHttp(pedido, api);
    expect(api.functions.invoke.mock.calls[0]![1].headers).toEqual(api.functions.invoke.mock.calls[1]![1].headers);
  });
  it("transmite acentos sem modificar a identidade da fonte", async () => {
    const api = cliente();
    await receberXlsxHttp({ ...pedido, fonteId: "São João — Torre A" }, api);
    expect(api.functions.invoke.mock.calls[0]![1].headers["x-fonte-id-utf8"]).toBe("S%C3%A3o%20Jo%C3%A3o%20%E2%80%94%20Torre%20A");
  });
});
