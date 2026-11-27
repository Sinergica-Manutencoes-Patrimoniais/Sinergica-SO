// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RevisaoBacklogModal } from "./InspecoesPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));

it("DEF-20: associa os dados revisáveis ao item de origem, mesmo em ordem diferente", () => {
  const origens = [
    {
      id: "a",
      descricao: "Vedação danificada",
      sistema: "hidrossanitario",
      localizacao: "Cobertura",
    },
    { id: "b", descricao: "Condutor exposto", sistema: "eletrico", localizacao: "Garagem" },
  ] as const;
  const itens = ["b", "a"].map((itemId) => ({
    itemId,
    gravidade: 3,
    urgencia: 3,
    tendencia: 3,
    dorCliente: null,
    esforcoHoras: 0,
    justificativaEsforco: null,
    citacaoNormativa: null,
  }));
  render(
    <RevisaoBacklogModal
      itens={itens}
      origens={origens}
      correlacionou
      confirmando={false}
      onClose={vi.fn()}
      onConfirmar={vi.fn()}
    />,
  );
  expect(screen.getByRole("group", { name: "Condutor exposto" })).toHaveTextContent("Garagem");
  expect(screen.getByRole("group", { name: "Vedação danificada" })).toHaveTextContent("Cobertura");
});
