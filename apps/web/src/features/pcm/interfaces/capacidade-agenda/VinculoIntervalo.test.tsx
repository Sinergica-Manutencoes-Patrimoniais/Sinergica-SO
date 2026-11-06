// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
import { VinculoIntervalo } from "./VinculoIntervalo";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});
it("exibe histórico e registra vínculo sem afirmar cobertura", async () => {
  api.rpc.mockImplementation((nome: string, p: Record<string, unknown>) =>
    nome === "sso_consultar_vinculo_intervalo"
      ? {
          abortSignal: () =>
            Promise.resolve({
              error: null,
              data: {
                clienteId: "c",
                disponibilidadeId: "d",
                intervaloId: "i",
                revisaoDisponibilidade: 1,
                revisaoVinculo: 0,
                historico: [],
                limiteAtingido: false,
                coberturaComprovada: false,
              },
            }),
        }
      : Promise.resolve({
          error: null,
          data: { requestId: p.p_request_id, revision: 1, coberturaComprovada: false },
        }),
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <VinculoIntervalo
        userId="u"
        clienteId="c"
        disponibilidadeId="d"
        intervaloId="i"
        revision={1}
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/não comprova cobertura/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Justificativa do vínculo"), {
    target: { value: "Conferido" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Declarar inclusão" }));
  expect(await screen.findByText(/Vínculo registrado/)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith(
    "sso_mediar_vinculo_intervalo",
    expect.objectContaining({ p_incluido: true }),
  );
});
it("preserva tentativa ao receber confirmação divergente", async () => {
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_consultar_vinculo_intervalo"
      ? {
          abortSignal: () =>
            Promise.resolve({
              error: null,
              data: {
                clienteId: "c",
                disponibilidadeId: "d",
                intervaloId: "i",
                revisaoDisponibilidade: 1,
                revisaoVinculo: 0,
                historico: [],
                limiteAtingido: false,
                coberturaComprovada: false,
              },
            }),
        }
      : Promise.resolve({
          error: null,
          data: { requestId: "outro", revision: 1, coberturaComprovada: false },
        }),
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <VinculoIntervalo
        userId="u"
        clienteId="c"
        disponibilidadeId="d"
        intervaloId="i"
        revision={1}
      />
    </QueryClientProvider>,
  );
  await screen.findByText(/não comprova cobertura/);
  fireEvent.change(screen.getByLabelText("Justificativa do vínculo"), {
    target: { value: "Conferido" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Declarar inclusão" }));
  await screen.findByText(/Resultado incerto/);
  expect(
    sessionStorage.getItem(`sso-vinculo-intervalo:${JSON.stringify(["u", "c", "d", "i"])}`),
  ).not.toBeNull();
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
});
