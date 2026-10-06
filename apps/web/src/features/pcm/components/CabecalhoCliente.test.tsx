// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ClienteHeader } from "../application/cliente-360-gateway";
import { CabecalhoCliente } from "./CabecalhoCliente";

vi.mock("@sinergica/ui", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const CLIENTE: ClienteHeader = {
  id: "cliente-1",
  nome: "Guainumbí",
  cnpj: "68.004.456/0001-63",
  auvoId: 12807216,
  ativo: true,
  tipo: "cliente",
  statusComercial: "ativo",
  endereco: "Av. Júlio de Mesquita, 36 — Cambuí",
  cidade: "Campinas",
  estado: "SP",
  cep: "13025-060",
  contatoNome: "Condomínio Edifício Guainumbí",
  contatoTelefone: "(19) 3251-7070",
  contatoEmail: "mrcfalivene@bol.com.br",
};

describe("CabecalhoCliente — E01-S163 AC-22", () => {
  it("reúne os dados essenciais em uma faixa contextual única e compacta", () => {
    render(<CabecalhoCliente cliente={CLIENTE} />);

    expect(screen.getByRole("banner", { name: "Contexto do cliente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guainumbí", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText(/Av\. Júlio de Mesquita/)).toBeInTheDocument();
    expect(screen.getByText("68.004.456/0001-63")).toBeInTheDocument();
    expect(screen.getByText("Condomínio Edifício Guainumbí")).toBeInTheDocument();
    expect(screen.getByText("(19) 3251-7070")).toBeInTheDocument();
    expect(screen.getByText("mrcfalivene@bol.com.br")).toBeInTheDocument();
    expect(screen.getByText("Campinas — SP")).toBeInTheDocument();
    expect(screen.getByText("12807216")).toBeInTheDocument();
  });

  it("não repete o estado ativo quando o status comercial também é ativo", () => {
    render(<CabecalhoCliente cliente={CLIENTE} />);

    expect(screen.getAllByText("Ativo")).toHaveLength(1);
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
  });
});
