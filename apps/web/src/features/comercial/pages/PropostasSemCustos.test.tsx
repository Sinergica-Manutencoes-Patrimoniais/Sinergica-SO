// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropostasSemCustos } from "./PropostasSemCustos";

const estado = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock("../application/propostas-sem-custos-queries", () => ({
  usePropostasSemCustos: () => estado.valor,
}));
vi.mock("../infrastructure/supabase-propostas-sem-custos-adapter", () => ({
  supabasePropostasSemCustosAdapter: {},
}));

describe("consulta comercial sem custos", () => {
  beforeEach(() => {
    estado.valor = {};
  });

  it("apresenta propostas e preço de venda sem composição interna", () => {
    estado.valor = {
      isSuccess: true,
      data: [
        {
          id: "1",
          tipo: "simples",
          status: "enviada",
          escopo: "Revisão",
          precoCentavos: 150000,
          versao: 2,
        },
      ],
    };
    render(
      <PropostasSemCustos userId="u1" clienteId="c1" oportunidadeId="o1" onVoltar={() => {}} />,
    );
    expect(screen.getByText(/Revisão/)).toBeTruthy();
    expect(screen.getByText(/1\.500,00/)).toBeTruthy();
    expect(screen.queryByText(/custo unitário/i)).toBeNull();
  });

  it("apresenta falha sem exibir dados anteriores", () => {
    estado.valor = { isError: true, isSuccess: false };
    render(
      <PropostasSemCustos userId="u1" clienteId="c1" oportunidadeId="o1" onVoltar={() => {}} />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível");
    expect(screen.queryByText(/1\.500,00/)).toBeNull();
  });
});
