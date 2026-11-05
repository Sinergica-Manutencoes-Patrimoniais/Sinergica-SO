// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ aprovar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({ aprovarRevisaoPreparada: api.aprovar, supabasePlanoManutencaoAdapter: {} }));
import { AcoesRevisaoPlano } from "./AcoesRevisaoPlano";
const clienteId = "16500000-0000-4000-8000-00000000000a";
const planoId = "16500000-0000-4000-8000-000000000011";
const chave = `sso-plano-revisao:usuario:${clienteId}:${planoId}`;
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
it.each(["serializacao", "conflito", "replay"] as const)("aprovação preserva semântica de %s", async (cenario) => {
  vi.stubEnv("VITE_SSO_APROVAR_REVISAO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED", "true");
  if (cenario === "replay") api.aprovar.mockRejectedValueOnce(new Error("rede")).mockRejectedValueOnce({ code: "P0011", message: "revisao_obsoleta" });
  else api.aprovar.mockRejectedValue({ code: cenario === "conflito" ? "P0011" : "40001", message: cenario === "conflito" ? "revisao_obsoleta" : "serialization_failure" });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><AcoesRevisaoPlano userId="usuario" clienteId={clienteId} plano={{ id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 3 }} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Aprovar revisão de versão" }));
  fireEvent.change(screen.getByLabelText("Início da vigência"), { target: { value: "2026-11-06" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
  if (cenario === "conflito") {
    await screen.findByText(/O Plano mudou/);
    expect(sessionStorage.getItem(chave)).toBeNull();
  } else {
    await screen.findByText(/Não foi possível confirmar a operação/);
    const pedido = sessionStorage.getItem(chave);
    expect(pedido).toBeTruthy();
    if (cenario === "replay") {
      fireEvent.click(screen.getByRole("button", { name: /Tentar operação de Preventivo novamente/ }));
      await waitFor(() => expect(api.aprovar).toHaveBeenCalledTimes(2));
      await screen.findByText(/Não foi possível confirmar a operação/);
    }
    expect(sessionStorage.getItem(chave)).toBe(pedido);
  }
});
