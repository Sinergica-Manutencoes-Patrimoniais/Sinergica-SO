// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ retirarRotina: vi.fn() }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({ supabasePlanoManutencaoAdapter: api }));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: async () => {} }));
import { RetiradaRotina } from "./RetiradaRotina";
const id = (n: number) => `16630000-1111-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });
it.each(["primeira", "replay", "serializacao", "autorizacao"] as const)("retirada preserva pedido: %s", async (cenario) => {
  const conflito = cenario === "autorizacao" ? { code: "55P03", message: "autorizacao_em_alteracao" } : { code: cenario === "serializacao" ? "40001" : "P0011", message: "revisao_obsoleta" };
  if (cenario === "replay") api.retirarRotina.mockRejectedValueOnce(new Error("rede")).mockRejectedValueOnce(conflito);
  else api.retirarRotina.mockRejectedValue(conflito);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><RetiradaRotina userId={id(1)} clienteId={id(2)} plano={{ id: id(3), revisao: 1 } as never} rotinas={[{ id: id(4), nome: "Inspeção" } as never]} permitirNova onAtivo={() => {}} onAtualizar={() => {}} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Retirar Rotina" }));
  fireEvent.change(screen.getByLabelText("Rotina a retirar"), { target: { value: id(4) } });
  fireEvent.change(screen.getByLabelText("Motivo da retirada"), { target: { value: "Revisão do escopo" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
  if (cenario === "primeira") {
    await screen.findByText(/O Plano mudou/);
    expect(sessionStorage.length).toBe(0);
    expect(screen.getByRole("button", { name: "Retirar Rotina" })).toBeTruthy();
  } else {
    const repetir = await screen.findByRole("button", { name: "Tentar retirada novamente" });
    await waitFor(() => expect(api.retirarRotina).toHaveBeenCalledTimes(1));
    if (cenario === "autorizacao") await screen.findByText(/As permissões estão sendo atualizadas/);
    const pedido = sessionStorage.getItem(`sso-rotina-retirada:${id(1)}:${id(2)}:${id(3)}`);
    if (cenario === "replay") {
      fireEvent.click(repetir);
      await waitFor(() => expect(api.retirarRotina).toHaveBeenCalledTimes(2));
      await screen.findByText(/Não foi possível confirmar/);
    }
    expect(pedido).toBeTruthy();
    expect(sessionStorage.getItem(`sso-rotina-retirada:${id(1)}:${id(2)}:${id(3)}`)).toBe(pedido);
  }
});
