// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { PcmGuia } from "./PcmGuia";
import { MANUAL_PCM } from "./pcm-manual";

beforeEach(() => window.history.replaceState(null, "", "/?guia=pcm"));

describe("Manual PCM — E01-S164", () => {
  it("AC-6: busca conteúdo sem acentos e recupera o índice após uma busca vazia", async () => {
    render(<PcmGuia />);
    const busca = screen.getByRole("searchbox", { name: "Buscar no manual" });
    const indice = screen.getByRole("navigation", { name: "Assuntos do manual" });
    await userEvent.type(busca, "ETIQUETA");
    expect(
      within(indice).getByRole("link", { name: "Preencher o Identificador e conferir etiquetas" }),
    ).toBeVisible();
    await userEvent.clear(busca);
    await userEvent.type(busca, "sincronizacao");
    expect(
      within(indice).getByRole("link", { name: "Resolver pendências e conferir sincronização" }),
    ).toBeVisible();
    await userEvent.clear(busca);
    await userEvent.type(busca, "zzzzzzzzzz");
    expect(screen.getByText(/Nenhum assunto encontrado/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(within(indice).getAllByRole("link")).toHaveLength(MANUAL_PCM.length);
  });

  it("AC-1, AC-4, AC-6: abre OS pelo endereço com passos e conferência de envio", () => {
    window.history.replaceState(null, "", "/?guia=pcm#pcm-os");
    render(<PcmGuia />);
    const titulo = screen.getByRole("heading", { name: "Abrir OS e encaminhar ao campo" });
    expect(titulo).toHaveFocus();
    const artigo = screen.getByRole("article", { name: "Abrir OS e encaminhar ao campo" });
    expect(within(artigo).getByRole("heading", { name: "Passo a passo" })).toBeVisible();
    expect(within(artigo).getByRole("heading", { name: "Como saber se deu certo" })).toBeVisible();
    expect(within(artigo).getByText(/Salvar a OS no PCM não confirma/)).toBeVisible();
  });

  it("AC-6: responde a voltar/avançar de assunto e usa início para fragmento inválido", async () => {
    render(<PcmGuia />);
    await act(async () => {
      window.location.hash = "pcm-componentes";
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByRole("heading", { name: "Cadastrar e editar Componentes" })).toHaveFocus();
    await act(async () => {
      window.location.hash = "pcm-nao-existe";
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByRole("heading", { name: "Começar o dia e escolher o fluxo" })).toBeVisible();
  });

  it("AC-2, AC-3, AC-4: todos os assuntos têm roteiro, conferência, dúvidas e referências válidas", () => {
    const ids = MANUAL_PCM.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const assunto of MANUAL_PCM) {
      expect(assunto.passos.length).toBeGreaterThanOrEqual(4);
      expect(assunto.conferir.length).toBeGreaterThanOrEqual(3);
      expect(assunto.duvidas.length).toBeGreaterThanOrEqual(2);
      for (const relacionado of assunto.relacionados) expect(ids).toContain(relacionado);
    }
  });
});
