import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), schema: vi.fn(), rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { auth: { getSession: api.getSession, getUser: api.getUser }, schema: api.schema, functions: { invoke: api.invoke } } }));
import { enviarXlsxAutenticado } from "./enviar-xlsx-autenticado";

it("recupera lote de mesma origem e envia o original com sessão verificada", async () => {
  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", loteId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const dados = new Map<string, string>();
  const storage = { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => { dados.set(k, v); } };
  const locks = { request: async <T>(_nome: string, callback: () => Promise<T>) => callback() };
  api.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  api.getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockResolvedValue({ data: { estado: "encontrada", loteId, revisao: 1, sha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81" }, error: null });
  api.invoke.mockImplementation(async (_nome, opcoes) => ({ data: { requestId: opcoes.headers["x-pedido-id"], aggregateId: opcoes.headers["x-lote-id"], state: "pendente", revision: 1, created: false }, error: null }));
  await expect(enviarXlsxAutenticado({ userId, clienteId, fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) }, storage, locks)).resolves.toEqual({ revision: 1, created: false });
  expect(api.invoke.mock.calls[0]![1].headers["x-lote-id"]).toBe(loteId);
  expect(api.invoke.mock.calls[0]![1].headers.authorization).toBe("Bearer token");
});
