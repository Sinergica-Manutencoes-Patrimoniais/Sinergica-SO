// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { chamadoAbertoParaCard } from "../domain/ordens-servico";
import { NovaOrdemServicoModal } from "./NovaOrdemServicoModal";

const editar = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./SeletorLocal", () => ({ SeletorLocal: () => null }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "operador" } }) }));
vi.mock("../infrastructure/supabase-ordem-servico-adapter", () => ({
  supabaseOrdemServicoAdapter: {
    carregarDadosAbertura: async () => ({ clientes: [], tecnicos: [], tiposTarefa: [] }),
    obterPesosGutd: async () => ({ g: 1, u: 1, t: 1, d: 1 }),
    iaTituloAtiva: async () => false,
    editarOrdemServico: editar,
  },
}));

it.each(["normal", "alta"])(
  "DEF-22: exibe e salva a prioridade existente %s",
  async (prioridade) => {
    const ordem = {
      ...chamadoAbertoParaCard(
        {
          id: "chamado-ficticio",
          numero: "CH-TESTE",
          titulo: "Inspeção fictícia",
          descricao: null,
          createdAt: "2026-11-25T12:00:00Z",
          fotoUrls: [],
        },
        "Cliente de teste",
      ),
      id: "os-ficticia",
      prioridade,
    };
    render(<NovaOrdemServicoModal aberto ordem={ordem} onFechar={() => {}} />);
    const salvar = await screen.findByRole("button", { name: "Salvar alterações" });
    const seletor = screen
      .getByText("Prioridade", { exact: true })
      .parentElement?.querySelector("select");
    expect(seletor).toHaveValue(prioridade);
    fireEvent.click(salvar);
    await waitFor(() =>
      expect(editar).toHaveBeenLastCalledWith(expect.objectContaining({ prioridade })),
    );
  },
);
