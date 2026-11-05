// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
    schema: () => ({ rpc: api.rpc }),
  },
}));
vi.mock("./IncluirFilaSelecionada", () => ({
  IncluirFilaSelecionada: ({ itens }: { itens: Array<{ preparada_id: string }> }) => (
    <p>Itens conferidos: {itens.map((i) => i.preparada_id).join(", ")}</p>
  ),
}));
import { FilaDasOcorrenciasPreparadas } from "./FilaDasOcorrenciasPreparadas";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const linha = (n: number) => ({
  tipo: "calendario",
  preparada_id: id(n),
  versao_id: id(20),
  rotina_id: id(21),
  alvo_tipo: "sistema",
  alvo_id: id(22),
  vencimento_original: "2026-11-10",
  ocorrencia_grupo_id: null,
  estado: "preparada_sem_estado_execucao",
  fila_executavel: false,
});
function montar(preparadas: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FilaDasOcorrenciasPreparadas
        userId="usuario"
        clienteId={id(23)}
        planoId={id(24)}
        preparadas={preparadas}
      />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("confere as ocorrências do Plano antes de oferecer inclusão selecionada", async () => {
  api.rpc.mockReturnValue({
    abortSignal: async () => ({ data: [linha(1), linha(2)], error: null }),
  });
  montar([id(1), id(2)]);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar ocorrências para fila" }));
  expect(await screen.findByText(`Itens conferidos: ${id(1)}, ${id(2)}`)).toBeInTheDocument();
  expect(api.rpc).toHaveBeenCalledWith(
    "sso_obrigacoes_calendario_por_ids",
    expect.objectContaining({
      p_cliente_id: id(23),
      p_plano_id: id(24),
      p_preparadas: [id(1), id(2)],
    }),
  );
});

it("não oferece inclusão se um recibo não estiver na fonte do Plano", async () => {
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: [linha(1)], error: null }) });
  montar([id(1), id(2)]);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar ocorrências para fila" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível confirmar todos");
  expect(screen.queryByText(/Itens conferidos/)).toBeNull();
});
