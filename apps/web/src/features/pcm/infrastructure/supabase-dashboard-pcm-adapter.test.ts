import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ schema: vi.fn(), from: vi.fn(), select: vi.fn(), order: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseDashboardPcmAdapter } from "./supabase-dashboard-pcm-adapter";

it("consulta saúde da fila sem solicitar nem expor erro bruto", async () => {
  api.schema.mockReturnValue({ from: api.from });
  api.from.mockReturnValue({ select: api.select });
  api.select.mockReturnValue({ order: api.order });
  api.order.mockResolvedValue({
    data: [
      {
        entity: "os",
        write_enabled: true,
        last_push_ok_at: null,
        last_pull_ok_at: null,
        last_error_at: "2026-10-27T12:00:00Z",
        last_error: "Bearer SECRET",
        push_pending_count: 1,
        push_error_count: 1,
      },
    ],
    error: null,
  });
  const resultado = await supabaseDashboardPcmAdapter.obterSaudeSync();
  const selecionadas = api.select.mock.calls[0]?.[0] as string;
  expect(selecionadas.split(",")).not.toContain("last_error");
  expect(JSON.stringify(resultado)).not.toContain("SECRET");
  expect(resultado[0]?.lastError).toBe("Falha registrada. Consulte os detalhes de sincronização.");
  expect(resultado[0]?.errorCount).toBe(1);
});

it("não transforma contagem ausente em fila vazia", async () => {
  api.schema.mockReturnValue({ from: api.from });
  api.from.mockReturnValue({ select: api.select });
  api.select.mockReturnValue({ order: api.order });
  api.order.mockResolvedValue({
    data: [
      {
        entity: "os",
        write_enabled: null,
        last_push_ok_at: null,
        last_pull_ok_at: null,
        last_error_at: null,
        push_pending_count: null,
        push_error_count: 0,
      },
    ],
    error: null,
  });
  await expect(supabaseDashboardPcmAdapter.obterSaudeSync()).rejects.toThrow(/incomplet/i);
});

it("não apresenta fila vazia se a view de saúde estiver ausente", async () => {
  api.schema.mockReturnValue({ from: api.from });
  api.from.mockReturnValue({ select: api.select });
  api.select.mockReturnValue({ order: api.order });
  api.order.mockResolvedValue({
    data: null,
    error: { code: "42P01", message: "relation missing" },
  });
  await expect(supabaseDashboardPcmAdapter.obterSaudeSync()).rejects.toThrow(/indisponível/i);
});

it("aceita contagem inteira do banco e recusa número negativo", async () => {
  api.schema.mockReturnValue({ from: api.from });
  api.from.mockReturnValue({ select: api.select });
  api.select.mockReturnValue({ order: api.order });
  const linha = {
    entity: "os",
    write_enabled: true,
    last_push_ok_at: null,
    last_pull_ok_at: null,
    last_error_at: null,
    push_pending_count: "2",
    push_error_count: "0",
  };
  api.order
    .mockResolvedValueOnce({ data: [linha], error: null })
    .mockResolvedValueOnce({ data: [{ ...linha, push_error_count: -1 }], error: null });
  expect((await supabaseDashboardPcmAdapter.obterSaudeSync())[0]?.pendingCount).toBe(2);
  await expect(supabaseDashboardPcmAdapter.obterSaudeSync()).rejects.toThrow(/incomplet/i);
});
