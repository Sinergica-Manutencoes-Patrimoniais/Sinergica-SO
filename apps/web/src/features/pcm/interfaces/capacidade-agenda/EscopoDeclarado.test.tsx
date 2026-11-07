// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ ler: vi.fn(), salvar: vi.fn() }));
vi.mock("../../infrastructure/supabase-escopo-origem-adapter", () => ({
  consultarEscopo: api.ler,
  declararEscopo: api.salvar,
}));
import { EscopoDeclarado } from "./EscopoDeclarado";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it("guarda escopo declarado sem afirmar execução e repete pedido após recarga", async () => {
  api.ler.mockResolvedValue({
    osId: "os",
    revision: 0,
    executadoDeclarado: null,
    restanteDeclarado: null,
    execucaoComprovada: false,
    origem: { preparadaId: "ocorrencia" },
  });
  api.salvar.mockRejectedValueOnce(new Error("incerto")).mockResolvedValueOnce(undefined);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  const montar = () =>
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <EscopoDeclarado userId="u" clienteId="c" osId="os" />
      </QueryClientProvider>,
    );
  const primeira = montar();
  fireEvent.change(await screen.findByLabelText("Executado declarado"), {
    target: { value: "Revisão feita" },
  });
  fireEvent.change(screen.getByLabelText("Restante declarado"), { target: { value: "Ajustar" } });
  fireEvent.change(screen.getByLabelText("Justificativa"), {
    target: { value: "Informado pelo PCM" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar escopo declarado" }));
  await screen.findByRole("alert");
  primeira.unmount();
  montar();
  expect(await screen.findByText(/não comprova execução/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledTimes(2));
  expect(api.salvar.mock.calls[1]?.[0]).toEqual(api.salvar.mock.calls[0]?.[0]);
});
