// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// DEF-11 + item do caderno sobre "Tentar novamente": 403/42501 é negação determinística do
// servidor. A tela mostrava um erro genérico com um botão que repetia a mesma negação para
// sempre. Aqui a consulta de linhas é recusada com 42501 e a tela não pode oferecer repetir.
const obterLinhas = vi.fn();
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: { obterLinhas: (...a: unknown[]) => obterLinhas(...a) },
  validarSalvarLinhasMateriais: (v: unknown) => v,
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "usuario-1" } }, error: null }) },
  },
}));

import { EditorPersistido } from "./EditorPersistido";

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EditorPersistido
        usuario="usuario-1"
        cliente="cliente-1"
        ordemServico="os-1"
        listaId="lista-1"
        revisao={1}
        textoOriginal="2 disjuntores 25A"
      />
    </QueryClientProvider>,
  );
}

describe("EditorPersistido — falha ao consultar as linhas", () => {
  beforeEach(() => {
    obterLinhas.mockReset();
    sessionStorage.clear();
  });

  it("negação de autorização não oferece 'Tentar novamente'", async () => {
    obterLinhas.mockRejectedValue(Object.assign(new Error("permission denied"), { code: "42501" }));
    montar();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("não tem permissão");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });

  it("falha sem código conhecido continua oferecendo repetir", async () => {
    obterLinhas.mockRejectedValue(new Error("Failed to fetch"));
    montar();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível consultar as linhas");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });
});
