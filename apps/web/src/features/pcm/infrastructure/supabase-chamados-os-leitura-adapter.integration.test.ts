import { beforeEach, expect, it, vi } from "vitest";

const rede = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../lib/supabase-client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://sso-test.invalid", "chave-teste", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: rede.fetch },
    }),
  };
});
import { supabaseChamadosOsLeituraAdapter } from "./supabase-chamados-os-leitura-adapter";

const clienteId = "16700000-0000-4000-8000-00000000000a";
const chamadoId = "16700000-0000-4000-8000-000000000011";
const osId = "16700000-0000-4000-8000-000000000021";
const cursorAnterior = "16700000-0000-4000-8000-000000000020";

beforeEach(() => {
  rede.fetch.mockReset();
});

it("serializa o contrato PostgREST e preserva identificador e número", async () => {
  rede.fetch.mockResolvedValue(
    new Response(
      JSON.stringify([{ id: osId, numero: "CH-001", titulo: "Reparo", status: "solicitacao" }]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  expect(await supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 20, cursorAnterior)).toEqual([
    { id: osId, numero: "CH-001", titulo: "Reparo", status: "solicitacao" },
  ]);
  const chamada = rede.fetch.mock.calls[0];
  if (!chamada) throw new Error("Consulta HTTP não realizada.");
  const [url, init] = chamada;
  expect(String(url)).toBe("https://sso-test.invalid/rest/v1/rpc/sso_listar_ordens_chamado");
  expect(init.method).toBe("POST");
  expect(new Headers(init.headers).get("content-profile")).toBe("pcm");
  expect(JSON.parse(init.body)).toEqual({
    p_cliente_id: clienteId,
    p_chamado_id: chamadoId,
    p_limite: 20,
    p_apos: cursorAnterior,
  });
});

it("propaga recusa do servidor sem convertê-la em lista vazia", async () => {
  rede.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: "42501",
        message: "chamado_nao_encontrado_ou_sem_acesso",
        details: null,
        hint: null,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    ),
  );
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 20, null),
  ).rejects.toMatchObject({ code: "42501", message: "chamado_nao_encontrado_ou_sem_acesso" });
});

it("recusa resposta JSON inesperada mesmo quando servidor retorna sucesso", async () => {
  rede.fetch.mockResolvedValue(
    new Response(
      JSON.stringify([
        { id: osId, numero: "CH-001", titulo: "Reparo", status: "solicitacao", custo: 100 },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 20, null),
  ).rejects.toThrow();
});

it("informa indisponibilidade do servidor sem apresentar resultado parcial", async () => {
  rede.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ code: "PGRST000", message: "indisponível", details: null, hint: null }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ),
  );
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 20, null),
  ).rejects.toMatchObject({ code: "PGRST000" });
});

it("propaga falha de rede", async () => {
  rede.fetch.mockRejectedValue(new TypeError("falha de rede"));
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 20, null),
  ).rejects.toMatchObject({ message: "TypeError: falha de rede" });
});
