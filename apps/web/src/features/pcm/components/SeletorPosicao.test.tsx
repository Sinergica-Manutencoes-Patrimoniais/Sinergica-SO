// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Area, Local } from "../domain/hierarquia";
import { SeletorPosicao } from "./SeletorPosicao";

const mocks = vi.hoisted(() => ({
  listarAreas: vi.fn(),
  listarLocaisDoCliente: vi.fn(),
}));

vi.mock("../infrastructure/supabase-hierarquia-adapter", () => ({
  supabaseHierarquiaAdapter: mocks,
}));

const AREA: Area = {
  id: "area-1",
  clienteId: "cli-1",
  nome: "Torre A",
  descricao: null,
  ordem: 0,
  ativo: true,
};

function local(over: Partial<Local> & Pick<Local, "id" | "nome" | "areaId">): Local {
  return {
    parentId: null,
    tipoId: null,
    tipoNome: null,
    descricao: null,
    ordem: 0,
    ativo: true,
    ...over,
  };
}

function renderComQuery(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("SeletorPosicao", () => {
  beforeEach(() => {
    mocks.listarAreas.mockReset().mockResolvedValue([AREA]);
    mocks.listarLocaisDoCliente
      .mockReset()
      .mockResolvedValue([local({ id: "loc-1", nome: "Térreo", areaId: "area-1" })]);
  });

  it("lista as Áreas e Locais do cliente", async () => {
    const onChange = vi.fn();
    renderComQuery(
      <SeletorPosicao clienteId="cli-1" areaId={null} localId={null} onChange={onChange} />,
    );
    expect(await screen.findByRole("option", { name: "Torre A" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Térreo" })).toBeInTheDocument();
  });

  it("escolher um Local avisa a Área dele junto", async () => {
    const onChange = vi.fn();
    renderComQuery(
      <SeletorPosicao clienteId="cli-1" areaId={null} localId={null} onChange={onChange} />,
    );
    await screen.findByRole("option", { name: "Térreo" });
    await userEvent.selectOptions(screen.getByLabelText("Local"), "loc-1");
    expect(onChange).toHaveBeenCalledWith({ areaId: "area-1", localId: "loc-1" });
  });

  it("com Local escolhido, o select de Área fica desabilitado", () => {
    renderComQuery(
      <SeletorPosicao clienteId="cli-1" areaId="area-1" localId="loc-1" onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Área")).toBeDisabled();
  });

  it("voltar Local pra 'Sem Local' reabilita a Área, mantendo o valor atual", async () => {
    const onChange = vi.fn();
    renderComQuery(
      <SeletorPosicao clienteId="cli-1" areaId="area-1" localId="loc-1" onChange={onChange} />,
    );
    await screen.findByRole("option", { name: "Térreo" });
    await userEvent.selectOptions(screen.getByLabelText("Local"), "");
    expect(onChange).toHaveBeenCalledWith({ areaId: "area-1", localId: null });
  });

  it("sem cliente, os dois selects ficam desabilitados", () => {
    renderComQuery(
      <SeletorPosicao clienteId={null} areaId={null} localId={null} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Área")).toBeDisabled();
    expect(screen.getByLabelText("Local")).toBeDisabled();
  });
});
