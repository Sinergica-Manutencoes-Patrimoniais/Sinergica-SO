// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorMateriais } from "./EditorMateriais";

afterEach(cleanup);

it("junta linhas selecionadas com descrição informada e conserva evidências", async () => {
  const salvar = vi.fn().mockResolvedValue(undefined);
  render(
    <EditorMateriais contexto="os1" textoOriginal={"- 2 tubos\n- 1 válvula"} salvar={salvar} />,
  );
  fireEvent.click(screen.getByLabelText("Selecionar linha 1 para juntar"));
  fireEvent.click(screen.getByLabelText("Selecionar linha 2 para juntar"));
  fireEvent.change(screen.getByLabelText("Descrição da linha reunida"), {
    target: { value: "Conjunto hidráulico" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Juntar linhas selecionadas" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar linhas" }));
  await waitFor(() =>
    expect(salvar).toHaveBeenCalledWith({
      textoOriginal: "- 2 tubos\n- 1 válvula",
      linhas: [
        {
          descricao: "Conjunto hidráulico",
          quantidade: null,
          unidade: null,
          trechosOriginais: ["- 2 tubos", "- 1 válvula"],
        },
      ],
    }),
  );
});

it("divide linha com descrições informadas sem alterar texto e evidência originais", async () => {
  const salvar = vi.fn().mockResolvedValue(undefined);
  render(<EditorMateriais contexto="os1" textoOriginal="- 2 tubos" salvar={salvar} />);
  fireEvent.click(screen.getByRole("button", { name: "Dividir linha 1" }));
  fireEvent.change(screen.getByLabelText("Primeira descrição"), {
    target: { value: "tubo curto" },
  });
  fireEvent.change(screen.getByLabelText("Segunda descrição"), { target: { value: "tubo longo" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar divisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar linhas" }));
  await waitFor(() =>
    expect(salvar).toHaveBeenCalledWith({
      textoOriginal: "- 2 tubos",
      linhas: [
        {
          descricao: "tubo curto",
          quantidade: null,
          unidade: null,
          trechosOriginais: ["- 2 tubos"],
        },
        {
          descricao: "tubo longo",
          quantidade: null,
          unidade: null,
          trechosOriginais: ["- 2 tubos"],
        },
      ],
    }),
  );
});

it("mostra original e impede gravação sem gateway configurado", () => {
  render(<EditorMateriais contexto="os1" textoOriginal={"- 2 tubos\nConfirmar em campo"} />);
  expect(screen.getByLabelText("Texto original")).toHaveProperty(
    "value",
    "- 2 tubos\nConfirmar em campo",
  );
  expect(screen.getByText(/não está conectada à gravação/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Salvar linhas" })).toBeNull();
});

it("encaminha edição com texto e evidência originais ao gateway e preserva em erro", async () => {
  const salvar = vi.fn().mockRejectedValue(new Error("indisponível"));
  render(<EditorMateriais contexto="os1" textoOriginal="- 2 tubos" salvar={salvar} />);
  fireEvent.change(screen.getByLabelText("Descrição da linha 1"), {
    target: { value: "Tubos de cobre" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar linhas" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toMatch(/não foi possível salvar/i),
  );
  expect(screen.getByLabelText("Descrição da linha 1")).toHaveProperty("value", "Tubos de cobre");
  expect(salvar).toHaveBeenCalledWith({
    textoOriginal: "- 2 tubos",
    linhas: [
      {
        descricao: "Tubos de cobre",
        quantidade: "2",
        unidade: null,
        trechosOriginais: ["- 2 tubos"],
      },
    ],
  });
});

it("descarta edição anterior ao trocar de OS", () => {
  const tela = render(<EditorMateriais contexto="os1" textoOriginal="- 2 tubos" />);
  fireEvent.change(screen.getByLabelText("Descrição da linha 1"), { target: { value: "Editado" } });
  tela.rerender(<EditorMateriais contexto="os2" textoOriginal="- 3 válvulas" />);
  expect(screen.getByLabelText("Descrição da linha 1")).toHaveProperty("value", "válvulas");
  expect(screen.getByLabelText("Texto original")).toHaveProperty("value", "- 3 válvulas");
});

it("impede envios repetidos enquanto o gateway está pendente", () => {
  const salvar = vi.fn(() => new Promise<void>(() => {}));
  render(<EditorMateriais contexto="os1" textoOriginal="- 2 tubos" salvar={salvar} />);
  const botao = screen.getByRole("button", { name: "Salvar linhas" });
  fireEvent.click(botao);
  fireEvent.click(botao);
  expect(salvar).toHaveBeenCalledTimes(1);
  expect((botao as HTMLButtonElement).disabled).toBe(true);
});
