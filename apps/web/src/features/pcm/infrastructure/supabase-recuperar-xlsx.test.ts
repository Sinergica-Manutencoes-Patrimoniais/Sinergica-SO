import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: api.getUser } } }));
import { recuperarOrigemXlsx } from "./supabase-recuperar-xlsx";

const usuario = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", cliente = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", lote = "cccccccc-cccc-cccc-cccc-cccccccccccc";
beforeEach(() => { vi.resetAllMocks(); api.schema.mockReturnValue({ rpc: api.rpc }); api.getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null }); });
it("recupera os metadados mínimos do lote após verificar o usuário", async () => {
  api.rpc.mockResolvedValue({ data: { estado: "encontrada", loteId: lote, revisao: 1, sha256: "a".repeat(64) }, error: null });
  await expect(recuperarOrigemXlsx(usuario, cliente, "Rimini")).resolves.toEqual({ estado: "encontrada", loteId: lote, revisao: 1, sha256: "a".repeat(64) });
  expect(api.rpc).toHaveBeenCalledWith("sso_recuperar_origem_xlsx", { p_cliente: cliente, p_fonte: "Rimini" });
  expect(api.getUser).toHaveBeenCalledTimes(2);
});
it("distingue origem ausente e origem que exige reconciliação", async () => {
  api.rpc.mockResolvedValueOnce({ data: { estado: "ausente" }, error: null }).mockResolvedValueOnce({ data: { estado: "reconciliacao" }, error: null });
  expect(await recuperarOrigemXlsx(usuario, cliente, "Rimini")).toEqual({ estado: "ausente" });
  expect(await recuperarOrigemXlsx(usuario, cliente, "Rimini")).toEqual({ estado: "reconciliacao" });
});
it("rejeita respostas incompletas, dados extras e erro do servidor", async () => {
  for (const data of [{ estado: "ausente", bytes: "sensible" }, { estado: "encontrada", loteId: lote, revisao: 0, sha256: "a".repeat(64) }, { estado: "encontrada", loteId: lote, revisao: 1, sha256: "x".repeat(64) }, { estado: "outro" }]) {
    api.rpc.mockResolvedValueOnce({ data, error: null });
    await expect(recuperarOrigemXlsx(usuario, cliente, "Rimini")).rejects.toThrow();
  }
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("sem acesso") });
  await expect(recuperarOrigemXlsx(usuario, cliente, "Rimini")).rejects.toThrow();
});
it("descarta resultado após mudança de sessão", async () => {
  api.getUser.mockResolvedValueOnce({ data: { user: { id: usuario } }, error: null }).mockResolvedValueOnce({ data: { user: { id: cliente } }, error: null });
  api.rpc.mockResolvedValue({ data: { estado: "ausente" }, error: null });
  await expect(recuperarOrigemXlsx(usuario, cliente, "Rimini")).rejects.toThrow(/Sessão alterada/);
});
