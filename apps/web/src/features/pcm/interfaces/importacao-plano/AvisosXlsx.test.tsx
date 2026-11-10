// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AvisosXlsx } from "./AvisosXlsx";

afterEach(cleanup);

it("diferencia pendências impeditivas dos avisos auxiliares", () => {
  render(<AvisosXlsx estado="pendente" itens={[{ referencia: "P5", motivo: "formula" }, { referencia: "Q6", motivo: "erro" }]} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/corrija/i);
  expect(screen.getByText(/P5.*fórmula/i)).toBeInTheDocument();
  expect(screen.getByText(/Q6.*erro/i)).toBeInTheDocument();
});

it("informa que valores de fórmulas auxiliares foram ignorados e limita a exibição", () => {
  const itens = Array.from({ length: 120 }, (_, i) => ({ referencia: `M${i + 1}`, motivo: "formula" as const }));
  render(<AvisosXlsx estado="conferivel" itens={itens} />);
  expect(screen.getByText(/não foram usados/i)).toBeInTheDocument();
  expect(screen.getByText(/100 de 120/i)).toBeInTheDocument();
  expect(screen.queryByText(/M120.*fórmula/i)).not.toBeInTheDocument();
});

it("não mostra avisos quando lista está vazia", () => {
  const { container } = render(<AvisosXlsx estado="conferivel" itens={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("permite consultar avisos além da primeira página", () => {
  const itens = Array.from({ length: 120 }, (_, i) => ({ referencia: `M${i + 1}`, motivo: "formula" as const }));
  render(<AvisosXlsx estado="pendente" itens={itens} />);
  fireEvent.click(screen.getByRole("button", { name: "Próximos avisos" }));
  expect(screen.getByText(/M120.*fórmula/i)).toBeInTheDocument();
  expect(screen.queryByText(/M1: fórmula/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Avisos anteriores" }));
  expect(screen.getByText(/M1: fórmula/i)).toBeInTheDocument();
});
