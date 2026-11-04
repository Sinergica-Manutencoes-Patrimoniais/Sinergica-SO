// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  autorizarAcao: vi.fn(),
  listarAreas: vi.fn(),
  listarLocaisDoCliente: vi.fn(),
  listarPorCliente: vi.fn(),
  listarDestinos: vi.fn(),
  moverComponente: vi.fn(),
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: api,
}));
vi.mock("../../infrastructure/supabase-hierarquia-adapter", () => ({
  supabaseHierarquiaAdapter: api,
}));
vi.mock("../../infrastructure/supabase-equipamentos-adapter", () => ({
  supabaseEquipamentosAdapter: api,
}));
vi.mock("../../infrastructure/supabase-estrutura-tecnica-adapter", () => ({
  supabaseEstruturaTecnicaAdapter: api,
}));
import { MovimentacaoDetalhe } from "./MovimentacaoDetalhe";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("só habilita movimentação para gestor autorizado", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarAreas.mockResolvedValue([]);
  api.listarLocaisDoCliente.mockResolvedValue([]);
  api.listarPorCliente.mockResolvedValue([]);
  api.listarDestinos.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  expect(await screen.findByLabelText("Área de destino")).toBeTruthy();
});
it("não oferece movimentação nem consulta destinos sem capacidade", async () => {
  api.autorizarAcao.mockResolvedValue(false);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  await screen.findByText("Verificando permissão de movimentação...");
  await waitForElementToBeRemoved(() =>
    screen.queryByText("Verificando permissão de movimentação..."),
  );
  expect(screen.queryByRole("button", { name: "Movimentar Componente" })).toBeNull();
  expect(api.listarDestinos).not.toHaveBeenCalled();
});
it("carrega páginas adicionais de destinos sem substituir seleção atual", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarAreas.mockResolvedValue([]);
  api.listarLocaisDoCliente.mockResolvedValue([]);
  api.listarPorCliente.mockResolvedValue([]);
  api.listarDestinos.mockImplementation(
    async (_cliente: string, tipo: string, _limite: number, apos: string | null) => {
      if (tipo !== "area") return [];
      return apos
        ? [{ id: "area-extra", nome: "Área extra", areaId: null }]
        : Array.from({ length: 20 }, (_, i) => ({
            id: `area-${i}`,
            nome: `Área ${i}`,
            areaId: null,
          }));
    },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  fireEvent.change(await screen.findByLabelText("Área de destino"), {
    target: { value: "area-0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Mais Áreas" }));
  expect(await screen.findByRole("option", { name: "Área extra" })).toBeTruthy();
  expect((screen.getByLabelText("Área de destino") as HTMLSelectElement).value).toBe("area-0");
});
it("busca destinos no servidor sem apagar a escolha anterior", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarDestinos.mockImplementation(
    async (_c: string, tipo: string, _l: number, _apos: string | null, busca: string | null) => {
      if (tipo !== "area") return [];
      return busca
        ? [{ id: "area-extra", nome: "Área extra", areaId: null }]
        : [{ id: "area-inicial", nome: "Área inicial", areaId: null }];
    },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  fireEvent.change(await screen.findByLabelText("Área de destino"), {
    target: { value: "area-inicial" },
  });
  fireEvent.change(screen.getByLabelText("Buscar Áreas"), { target: { value: "extra" } });
  expect(await screen.findByRole("option", { name: "Área extra" })).toBeTruthy();
  expect((screen.getByLabelText("Área de destino") as HTMLSelectElement).value).toBe(
    "area-inicial",
  );
});
it("não permite selecionar destinos antigos quando busca falha", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarDestinos.mockImplementation(
    async (_c: string, tipo: string, _l: number, _apos: string | null, busca: string | null) => {
      if (tipo === "area" && busca) throw new Error("falha na busca");
      return tipo === "area" ? [{ id: "area-inicial", nome: "Área inicial", areaId: null }] : [];
    },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  await screen.findByRole("option", { name: "Área inicial" });
  fireEvent.change(screen.getByLabelText("Buscar Áreas"), { target: { value: "outra" } });
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(
    (screen.getByLabelText("Área de destino").closest("fieldset") as HTMLFieldSetElement).disabled,
  ).toBe(true);
});
it("não apresenta destinos desatualizados quando revalidação falha", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarDestinos.mockImplementation(async (_c: string, tipo: string) =>
    tipo === "area" ? [{ id: "area-inicial", nome: "Área inicial", areaId: null }] : [],
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  await screen.findByRole("option", { name: "Área inicial" });
  api.listarDestinos.mockRejectedValue(new Error("falha de revalidação"));
  await client.invalidateQueries({ queryKey: ["estrutura-tecnica", "u", "c", "destinos"] });
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(
    (screen.getByLabelText("Área de destino").closest("fieldset") as HTMLFieldSetElement).disabled,
  ).toBe(true);
});
it("preserva seleção e bloqueia comando durante falha de nova busca, retomando após retry", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  let falharBusca = true;
  api.listarDestinos.mockImplementation(
    async (
      _cliente: string,
      tipo: string,
      _limite: number,
      _apos: string | null,
      busca: string | null,
    ) => {
      if (tipo !== "area") return [];
      if (busca && falharBusca) throw new Error("falha na busca");
      return [{ id: "area-inicial", nome: "Área inicial", areaId: null }];
    },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe
        userId="u"
        clienteId="c"
        item={{ id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null }}
        onConcluido={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  fireEvent.change(await screen.findByLabelText("Área de destino"), {
    target: { value: "area-inicial" },
  });
  fireEvent.change(screen.getByLabelText("Buscar Áreas"), { target: { value: "teste" } });
  await screen.findByRole("alert");
  const selecao = screen.getByLabelText("Área de destino") as HTMLSelectElement;
  expect(selecao.value).toBe("area-inicial");
  expect((selecao.closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
  falharBusca = false;
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitForElementToBeRemoved(() => screen.queryByRole("alert"));
  expect((screen.getByLabelText("Área de destino") as HTMLSelectElement).value).toBe(
    "area-inicial",
  );
  expect(
    (screen.getByLabelText("Área de destino").closest("fieldset") as HTMLFieldSetElement).disabled,
  ).toBe(false);
});
it("não transfere formulário nem destinos entre usuários no mesmo Cliente", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarDestinos.mockImplementation(async (_c: string, tipo: string) =>
    tipo === "area" ? [{ id: "area-inicial", nome: "Área inicial", areaId: null }] : [],
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const item = { id: "i", estruturaRevisao: 1, areaId: null, localId: null, parentItemId: null };
  const tela = render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe userId="u1" clienteId="c" item={item} onConcluido={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  await screen.findByRole("option", { name: "Área inicial" });
  tela.rerender(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe userId="u2" clienteId="c" item={item} onConcluido={() => {}} />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Movimentar Componente" });
  expect(screen.queryByLabelText("Área de destino")).toBeNull();
  expect(screen.queryByRole("option", { name: "Área inicial" })).toBeNull();
});
it("resposta atrasada não atualiza tela após troca de usuário", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarDestinos.mockResolvedValue([]);
  let concluir!: (valor: object) => void;
  api.moverComponente.mockReturnValue(
    new Promise((resolve) => {
      concluir = resolve;
    }),
  );
  const aoConcluir = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const item = {
    id: "17610000-0000-4000-8000-000000000061",
    estruturaRevisao: 1,
    areaId: null,
    localId: null,
    parentItemId: null,
  };
  const tela = render(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe userId="u1" clienteId="c" item={item} onConcluido={aoConcluir} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Movimentar Componente" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar movimentação" }));
  tela.rerender(
    <QueryClientProvider client={client}>
      <MovimentacaoDetalhe userId="u2" clienteId="c" item={item} onConcluido={aoConcluir} />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Movimentar Componente" });
  concluir({});
  await waitFor(() => expect(sessionStorage.getItem(`sso-movimento:u1:c:${item.id}`)).toBeNull());
  expect(aoConcluir).not.toHaveBeenCalled();
});
