// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PainelItensDoCliente } from "./PainelItensDoCliente";

vi.mock("../infrastructure/supabase-equipamentos-adapter", () => ({
  supabaseEquipamentosAdapter: {
    listarPorCliente: vi.fn().mockResolvedValue([
      {
        id: "item-1",
        nome: "Bomba Hidrante",
        identificador: "GUA-HID-BOM-01",
        categoria: "Hidráulica",
        categoriaId: "cat-1",
        clientId: "cliente-1",
        clienteNome: "Guainumbí",
        auvoCustomerId: null,
        localizacao: null,
        observacoes: null,
        ativo: true,
        auvoId: null,
        auvoSyncStatus: null,
        auvoSyncError: null,
        auvoSyncedAt: null,
        urlImagem: null,
        uriAnexos: [],
        localId: null,
        tipo: "componente",
        parentItemId: null,
        areaId: null,
      },
    ]),
    criar: vi.fn(),
    editar: vi.fn(),
    desativar: vi.fn(),
    possuiOsAberta: vi.fn(),
    obterItem: vi.fn(),
  },
}));
vi.mock("../infrastructure/supabase-hierarquia-adapter", () => ({
  supabaseHierarquiaAdapter: {
    listarAreas: vi.fn().mockResolvedValue([]),
    listarLocaisDoCliente: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("../infrastructure/supabase-sistemas-adapter", () => ({
  supabaseSistemasAdapter: {
    listar: vi.fn().mockResolvedValue([]),
    listarMembrosDoCliente: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("../infrastructure/supabase-identificador-ativo-adapter", () => ({
  supabaseIdentificadorAtivoAdapter: {},
}));
vi.mock("./EquipamentoModal", () => ({
  EquipamentoModal: () => null,
}));

function renderPainel(temEscrita: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PainelItensDoCliente clienteId="cliente-1" temEscrita={temEscrita} userId="user-1" />
    </QueryClientProvider>,
  );
}

describe("PainelItensDoCliente — E01-S159 AC-1", () => {
  it("filtra por nome ou identificador", async () => {
    renderPainel(true);
    expect(await screen.findByText("Bomba Hidrante")).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText("Buscar por nome ou identificador"),
      "inexistente",
    );
    expect(screen.getByText("Nenhum componente para esta busca.")).toBeInTheDocument();
  });

  it("mantém lista e busca, mas esconde ações sem escrita", async () => {
    renderPainel(false);
    expect(await screen.findByText("Bomba Hidrante")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar por nome ou identificador")).toBeInTheDocument();
    expect(screen.queryByText("Novo componente")).not.toBeInTheDocument();
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
    expect(screen.queryByText("Desativar")).not.toBeInTheDocument();
  });
});
