// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PainelSistemasCliente } from "./PainelSistemasCliente";

vi.mock("../infrastructure/supabase-hierarquia-adapter", () => ({
  supabaseHierarquiaAdapter: {
    listarAreas: vi.fn().mockResolvedValue([]),
    listarLocaisDoCliente: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("../infrastructure/supabase-sistemas-adapter", () => ({
  supabaseSistemasAdapter: {
    listar: vi.fn().mockResolvedValue([
      {
        id: "sis-pci",
        clienteId: "cliente-1",
        areaId: null,
        localId: null,
        nome: "Prevenção contra incêndio",
        categoriaId: "pci",
        categoria: "PCI",
        tipo: null,
        descricao: null,
        ativo: true,
        auvoId: null,
        auvoEquipmentId: null,
        codigo: "PCI-01",
        auvoSyncStatus: "synced",
        auvoSyncError: null,
        auvoSyncedAt: null,
      },
      {
        id: "sis-vazio",
        clienteId: "cliente-1",
        areaId: null,
        localId: null,
        nome: "Automação",
        categoriaId: "automacao",
        categoria: "Automação",
        tipo: null,
        descricao: null,
        ativo: true,
        auvoId: null,
        auvoEquipmentId: null,
        codigo: "AUT-01",
        auvoSyncStatus: "pending",
        auvoSyncError: null,
        auvoSyncedAt: null,
      },
    ]),
    listarMembrosDoCliente: vi.fn().mockResolvedValue([{ sistemaId: "sis-pci", itemId: "item-1" }]),
    criar: vi.fn(),
    editar: vi.fn(),
    desativar: vi.fn(),
  },
}));
vi.mock("../infrastructure/supabase-identificador-ativo-adapter", () => ({
  supabaseIdentificadorAtivoAdapter: {},
}));
vi.mock("./ComposicaoSistema", () => ({ ComposicaoSistema: () => null }));
vi.mock("./DrawerDetalheSistema", () => ({ DrawerDetalheSistema: () => null }));
vi.mock("./SistemaModal", () => ({ SistemaModal: () => null }));

function renderPainel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PainelSistemasCliente clienteId="cliente-1" temEscrita={false} userId="user-1" />
    </QueryClientProvider>,
  );
}

describe("PainelSistemasCliente — filtros do Cliente 360", () => {
  it("filtra pela composição, comunica a contagem e permite limpar", async () => {
    const user = userEvent.setup();
    renderPainel();
    expect(
      await screen.findByRole("button", { name: "Prevenção contra incêndio" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automação" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar sistemas por Composição"), "vazios");
    expect(
      screen.queryByRole("button", { name: "Prevenção contra incêndio" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automação" })).toBeInTheDocument();
    expect(screen.getByText("1 visíveis de 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByRole("button", { name: "Prevenção contra incêndio" })).toBeInTheDocument();
    expect(screen.getByText("2 visíveis de 2")).toBeInTheDocument();
  });
});
