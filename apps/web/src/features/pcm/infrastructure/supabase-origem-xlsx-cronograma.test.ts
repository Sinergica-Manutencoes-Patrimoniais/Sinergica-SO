import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: api.getUser } } }));
import { consultarOrigemXlsxAutenticada, consultarOrigemXlsxCronograma, receberOrigemXlsxCronograma } from "./supabase-origem-xlsx-cronograma";

beforeEach(() => { vi.resetAllMocks(); api.schema.mockReturnValue({ rpc: api.rpc }); });
const pedido = () => ({ requestId: "req", loteId: "lote", clienteId: "cliente", fonteId: "origem", matriz: [[1]], bytes: new Uint8Array([97, 98, 99]), sha256: "a".repeat(64) });

it("envia matriz e bytes exatos ao comando mediado e valida recibo", async () => {
  api.rpc.mockResolvedValue({ data: { aggregateId: "lote", requestId: "req", revision: 1, state: "pendente", created: true }, error: null });
  await receberOrigemXlsxCronograma(pedido());
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_receber_xlsx_cronograma", { p_request: "req", p_lote: "lote", p_cliente: "cliente", p_fonte: "origem", p_matriz: [[1]], p_base64: "YWJj", p_sha256: "a".repeat(64) });
});

it("rejeita recibo de outro lote, revisão inválida ou erro do servidor", async () => {
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: "outro", requestId: "req", revision: 1, state: "pendente", created: true }, error: null });
  await expect(receberOrigemXlsxCronograma(pedido())).rejects.toThrow();
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: "lote", requestId: "req", revision: 0, state: "pendente", created: true }, error: null });
  await expect(receberOrigemXlsxCronograma(pedido())).rejects.toThrow();
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("origem_xlsx_bloqueada") });
  await expect(receberOrigemXlsxCronograma(pedido())).rejects.toThrow("origem_xlsx_bloqueada");
});

it("recusa arquivo vazio ou acima do limite antes de enviar", async () => {
  await expect(receberOrigemXlsxCronograma({ ...pedido(), bytes: new Uint8Array(0) })).rejects.toThrow();
  await expect(receberOrigemXlsxCronograma({ ...pedido(), bytes: new Uint8Array(5_242_881) })).rejects.toThrow();
  expect(api.rpc).not.toHaveBeenCalled();
});

it("codifica corretamente arquivos entre blocos de base64", async () => {
  const bytes = new Uint8Array(24_578).map((_, i) => i % 256);
  api.rpc.mockResolvedValue({ data: { aggregateId: "lote", requestId: "req", revision: 1, state: "pendente", created: true }, error: null });
  await receberOrigemXlsxCronograma({ ...pedido(), bytes });
  expect(api.rpc.mock.calls[0]?.[1].p_base64).toBe(Buffer.from(bytes).toString("base64"));
});

it("recupera apenas a origem solicitada, conferindo bytes e digest", async () => {
  api.rpc.mockResolvedValue({ data: { loteId: "lote", clienteId: "cliente", base64: "YWJj\n", sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" }, error: null });
  const origem = await consultarOrigemXlsxCronograma("cliente", "lote");
  expect([...origem.bytes]).toEqual([97, 98, 99]);
  expect(origem.sha256).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_origem_xlsx", { p_cliente: "cliente", p_lote: "lote" });
});

it("não entrega origem trocada, corrompida, vazia ou acima do limite", async () => {
  const data = { loteId: "lote", clienteId: "cliente", base64: "YWJj", sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" };
  for (const alteracao of [{ clienteId: "outro" }, { loteId: "outro" }, { sha256: "a".repeat(64) }, { base64: "" }, { base64: "!!!!" }, { base64: "A".repeat(7_100_000) }]) {
    api.rpc.mockResolvedValueOnce({ data: { ...data, ...alteracao }, error: null });
    await expect(consultarOrigemXlsxCronograma("cliente", "lote")).rejects.toThrow();
  }
});

it("não mascara recusa do servidor", async () => {
  api.rpc.mockResolvedValue({ data: null, error: new Error("lote_sem_acesso") });
  await expect(consultarOrigemXlsxCronograma("cliente", "lote")).rejects.toThrow("lote_sem_acesso");
});

it("revalida a sessão antes e depois de obter a origem", async () => {
  api.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null });
  api.rpc.mockResolvedValue({ data: { loteId: "lote", clienteId: "cliente", base64: "YWJj", sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" }, error: null });
  expect([...(await consultarOrigemXlsxAutenticada("usuario", "cliente", "lote")).bytes]).toEqual([97, 98, 99]);
  expect(api.getUser).toHaveBeenCalledTimes(2);
});

it("não entrega bytes quando a sessão mudou durante a consulta", async () => {
  api.getUser.mockResolvedValueOnce({ data: { user: { id: "usuario" } }, error: null }).mockResolvedValueOnce({ data: { user: { id: "outro" } }, error: null });
  api.rpc.mockResolvedValue({ data: { loteId: "lote", clienteId: "cliente", base64: "YWJj", sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" }, error: null });
  await expect(consultarOrigemXlsxAutenticada("usuario", "cliente", "lote")).rejects.toThrow("Sessão alterada ou indisponível.");
});

it("não inicia consulta com sessão inválida ou cancelamento prévio", async () => {
  api.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(consultarOrigemXlsxAutenticada("usuario", "cliente", "lote")).rejects.toThrow();
  const cancelamento = new AbortController(); cancelamento.abort();
  await expect(consultarOrigemXlsxAutenticada("usuario", "cliente", "lote", cancelamento.signal)).rejects.toThrow();
  expect(api.rpc).not.toHaveBeenCalled();
});
