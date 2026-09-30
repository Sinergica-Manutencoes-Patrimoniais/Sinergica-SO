// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EquipamentoItem } from "../domain/equipamentos";
import { EquipamentoModal } from "./EquipamentoModal";

vi.mock("./SeletorPosicao", () => ({
  SeletorPosicao: ({ areaId, localId }: { areaId: string | null; localId: string | null }) => (
    <output data-testid="posicao" data-area-id={areaId ?? ""} data-local-id={localId ?? ""} />
  ),
}));

vi.mock("./SeletorCategoria", () => ({
  SeletorCategoria: () => <output data-testid="categoria" />,
}));

vi.mock("./CampoIdentificador", () => ({
  CampoIdentificador: () => <output data-testid="campo-identificador" />,
}));

vi.mock("../infrastructure/supabase-hierarquia-adapter", () => ({
  supabaseHierarquiaAdapter: { listarLocaisDoCliente: vi.fn().mockResolvedValue([]) },
}));

const componente: EquipamentoItem = {
  id: "item-1",
  nome: "Portão",
  identificador: null,
  categoriaId: null,
  categoria: null,
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
  localId: "local-1",
  tipo: "equipamento",
  parentItemId: null,
  areaId: "area-1",
};

describe("EquipamentoModal", () => {
  it("zera Área e Local ao trocar o cliente", async () => {
    render(
      <EquipamentoModal
        equipamento={componente}
        clientes={[
          { id: "cliente-1", nome: "Guainumbí", auvoId: null },
          { id: "cliente-2", nome: "Outro cliente", auvoId: null },
        ]}
        onCancel={vi.fn()}
        onSalvar={vi.fn()}
      />,
    );

    expect(screen.getByTestId("posicao")).toHaveAttribute("data-area-id", "area-1");
    expect(screen.getByTestId("posicao")).toHaveAttribute("data-local-id", "local-1");

    await userEvent.selectOptions(screen.getByLabelText(/Cliente/), "cliente-2");

    expect(screen.getByTestId("posicao")).toHaveAttribute("data-area-id", "");
    expect(screen.getByTestId("posicao")).toHaveAttribute("data-local-id", "");
  });
});
