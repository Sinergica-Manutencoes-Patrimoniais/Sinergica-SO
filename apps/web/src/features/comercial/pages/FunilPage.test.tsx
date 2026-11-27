// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunilPage } from "./FunilPage";

const { mutateAsync, podeAcessar } = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  podeAcessar: vi.fn(),
}));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar }),
}));
vi.mock("../infrastructure/supabase-comercial-adapter", () => ({ supabaseComercialAdapter: {} }));
vi.mock("../application/comercial-queries", () => ({
  useEtapas: () => ({
    data: [
      { id: "lead", nome: "Lead", ordem: 0, ativo: true, tipo: "aberta" },
      { id: "qualificada", nome: "Qualificada", ordem: 1, ativo: true, tipo: "aberta" },
      { id: "perdida", nome: "Perdida", ordem: 2, ativo: true, tipo: "perdida" },
      { id: "inativa", nome: "Inativa", ordem: 3, ativo: false, tipo: "aberta" },
    ],
  }),
  useMotivosPerda: () => ({ data: [{ id: "prazo", nome: "Prazo", ativo: true }] }),
  useOportunidadesAbertas: () => ({
    data: [
      {
        id: "op-teste",
        etapaId: "lead",
        titulo: "Inspeção fictícia",
        clienteNome: "Cliente fictício",
        score: null,
        valorEstimadoCentavos: null,
      },
    ],
  }),
  useMoverOportunidade: () => ({ mutateAsync, isPending: false }),
}));

afterEach(cleanup);
beforeEach(() => {
  mutateAsync.mockClear();
  podeAcessar.mockReturnValue(true);
});

describe("movimentação pelo seletor do funil", () => {
  function escolher(destino: string) {
    fireEvent.change(screen.getByRole("combobox", { name: /Inspeção fictícia/ }), {
      target: { value: destino },
    });
  }

  it("aguarda confirmação e limita os destinos às etapas ativas", () => {
    render(<FunilPage />);
    expect(screen.queryByRole("option", { name: "Inativa" })).not.toBeInTheDocument();
    escolher("qualificada");
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mover oportunidade" }));
    expect(mutateAsync).toHaveBeenCalledWith({
      oportunidadeId: "op-teste",
      etapaDestinoId: "qualificada",
      motivoPerdaId: null,
    });
  });

  it("abre o motivo da perda e só grava na confirmação", () => {
    render(<FunilPage />);
    escolher("perdida");
    fireEvent.click(screen.getByRole("button", { name: "Mover oportunidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mover oportunidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar perda" }));
    expect(mutateAsync).toHaveBeenCalledWith({
      oportunidadeId: "op-teste",
      etapaDestinoId: "perdida",
      motivoPerdaId: "prazo",
    });
  });

  it("oculta movimentação em acesso de leitura", () => {
    podeAcessar.mockImplementation((_modulo, nivel) => nivel === "leitura");
    render(<FunilPage />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
