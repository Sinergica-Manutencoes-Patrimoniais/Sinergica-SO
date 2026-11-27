// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApontamentoHorasPage } from "./ApontamentoHorasPage";

const { listarApontamentos, podeAcessar } = vi.hoisted(() => ({
  listarApontamentos: vi.fn(),
  podeAcessar: vi.fn(),
}));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "ficticio" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar }),
}));
vi.mock("../infrastructure/supabase-apontamento-horas-adapter", () => ({
  supabaseApontamentoHorasAdapter: {
    listarApontamentos,
    listarClientes: async () => [],
    listarTecnicos: async () => [{ id: "ativo", nome: "Ativo", jornadaDiariaHoras: 8 }],
    obterParametros: async () => ({
      metaDiariaHoras: 8,
      toleranciaMinutos: 0,
      limiarAnomaliaMinutos: 30,
    }),
    buscarValorHora: async () => null,
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("esconde o filtro e não consulta apontamentos sem leitura PCM", () => {
  podeAcessar.mockReturnValue(false);
  render(<ApontamentoHorasPage />);
  expect(screen.getByText("Acesso restrito")).toBeVisible();
  expect(screen.queryByRole("combobox", { name: "Técnico" })).not.toBeInTheDocument();
  expect(listarApontamentos).not.toHaveBeenCalled();
});

it("limpa a seleção de técnico histórico quando o novo período não tem suas horas", async () => {
  podeAcessar.mockImplementation((_modulo, nivel) => nivel === "leitura");
  listarApontamentos.mockImplementation(async (inicio: string) =>
    inicio === "2020-01-01"
      ? []
      : [
          {
            osId: "os",
            osNumero: "TESTE-01",
            tecnicoFuncionarioId: "inativo",
            tecnicoNome: "Inativo",
            clienteId: null,
            clienteNome: "Fictício",
            dataAgendada: null,
            checkInAt: null,
            checkOutAt: null,
            horas: 2,
          },
        ],
  );
  render(<ApontamentoHorasPage />);
  const filtro = await screen.findByRole("combobox", { name: "Técnico" });
  expect(within(filtro).getByRole("option", { name: "Inativo" })).toBeVisible();
  fireEvent.change(filtro, { target: { value: "inativo" } });
  expect(filtro).toHaveValue("inativo");
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2020-01-01" } });
  await waitFor(() =>
    expect(within(filtro).queryByRole("option", { name: "Inativo" })).not.toBeInTheDocument(),
  );
  expect(filtro).toHaveValue("");
  expect(within(filtro).getByRole("option", { name: "Ativo" })).toBeVisible();
});
