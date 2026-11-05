// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../auth/infrastructure/supabase-auth-adapter", () => ({
  supabaseAuthAdapter: new Proxy({}, {
    get: () => { throw new Error("Acesso inesperado à autenticação em teste unitário"); },
  }),
}));

vi.mock("../../../../lib/supabase-client", () => ({
  supabase: new Proxy({}, {
    get: () => { throw new Error("Acesso inesperado ao Supabase em teste unitário"); },
  }),
  supabaseUrl: "http://127.0.0.1:1",
}));

const gateway = vi.hoisted(() => ({
  autorizarAcao: vi.fn(),
  listarGrupos: vi.fn(),
  salvarGrupo: vi.fn(),
  listarHistorico: vi.fn(),
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: gateway,
}));
vi.mock("../../infrastructure/supabase-estrutura-tecnica-adapter", () => ({
  supabaseEstruturaTecnicaAdapter: gateway,
}));
import { GruposQuantitativos } from "./GruposQuantitativos";

function montar(clienteId = "cliente-a") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GruposQuantitativos
        userId="usuario"
        clienteId={clienteId}
        locais={[
          { id: "17610000-0000-4000-8000-000000000031", nome: "Salão" },
          { id: "local-a", nome: "Local anterior" },
        ]}
        categorias={[{ id: "17610000-0000-4000-8000-000000000041", nome: "Iluminação" }]}
        sistemas={[{ id: "17610000-0000-4000-8000-000000000051", nome: "Iluminação do salão" }]}
      />
    </QueryClientProvider>,
  );
}
describe("consulta de Grupos Quantitativos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });
  it("mostra Sistema, categoria e características do grupo sem criar cadastros individuais", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([
      {
        id: "grupo",
        clienteId: "cliente-a",
        nome: "Luminárias",
        quantidade: 20,
        localId: "17610000-0000-4000-8000-000000000031",
        categoriaId: "17610000-0000-4000-8000-000000000041",
        sistemaId: "17610000-0000-4000-8000-000000000051",
        caracteristicas: { Potência: "12 W" },
        revisao: 1,
      },
    ]);
    montar();
    expect(await screen.findByText("Sistema: Iluminação do salão")).toBeTruthy();
    expect(screen.getByText("Categoria: Iluminação")).toBeTruthy();
    expect(screen.getByText("Potência: 12 W")).toBeTruthy();
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
  });
  it("oculta lista anterior quando atualização falha e permite recuperar", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    const grupo = {
      id: "grupo",
      nome: "Luminárias",
      quantidade: 20,
      localId: "17610000-0000-4000-8000-000000000031",
    };
    gateway.listarGrupos
      .mockResolvedValueOnce([grupo])
      .mockRejectedValueOnce(new Error("consulta indisponível"))
      .mockResolvedValueOnce([grupo]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GruposQuantitativos userId="usuario" clienteId="cliente-a" locais={[]} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: "Editar Luminárias" })).toBeTruthy();
    await client.invalidateQueries({
      queryKey: ["estrutura-tecnica", "usuario", "cliente-a", "grupos"],
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar Luminárias" })).toBeNull();
    expect(screen.queryByText(/Luminárias — 20 unidades/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: "Editar Luminárias" })).toBeTruthy();
  });
  it("impede iniciar edição com dados antigos durante atualização da lista", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    const grupo = {
      id: "grupo",
      clienteId: "cliente-a",
      nome: "Luminárias",
      quantidade: 20,
      localId: "17610000-0000-4000-8000-000000000031",
      categoriaId: "17610000-0000-4000-8000-000000000041",
      sistemaId: null,
      caracteristicas: {},
      revisao: 1,
    };
    let concluir!: (valor: (typeof grupo)[]) => void;
    gateway.listarGrupos.mockResolvedValueOnce([grupo]).mockReturnValueOnce(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GruposQuantitativos userId="usuario" clienteId="cliente-a" locais={[]} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Editar Luminárias" });
    void client.invalidateQueries({
      queryKey: ["estrutura-tecnica", "usuario", "cliente-a", "grupos"],
    });
    await waitFor(() => expect(gateway.listarGrupos).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Editar Luminárias" })).toBeNull(),
    );
    concluir([{ ...grupo, quantidade: 21, revisao: 2 }]);
    expect(await screen.findByText(/Luminárias — 21 unidades/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar Luminárias" })).toBeTruthy();
  });
  it("exibe grupo autorizado com Local e quantidade", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([
      {
        id: "grupo",
        nome: "Luminárias",
        quantidade: 20,
        localId: "17610000-0000-4000-8000-000000000031",
      },
    ]);
    montar();
    expect(await screen.findByText(/Luminárias — 20 unidades · Salão/)).toBeTruthy();
    expect(gateway.listarGrupos).toHaveBeenCalledWith("cliente-a", 0, 50, expect.any(AbortSignal));
  });
  it("não consulta grupos quando acesso é negado", async () => {
    gateway.autorizarAcao.mockResolvedValue(false);
    montar();
    await waitFor(() => expect(gateway.autorizarAcao).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Verificando acesso aos grupos...")).toBeNull());
    expect(gateway.listarGrupos).not.toHaveBeenCalled();
  });
  it("isola consultas de dois Clientes na mesma sessão", async () => {
    gateway.autorizarAcao.mockImplementation(
      async (_acao: string, cliente: string) => cliente === "cliente-a",
    );
    gateway.listarGrupos.mockResolvedValue([
      { id: "grupo", nome: "Luminárias", quantidade: 20, localId: "local-a" },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tela = render(
      <QueryClientProvider client={client}>
        <GruposQuantitativos
          userId="usuario"
          clienteId="cliente-a"
          locais={[{ id: "local-a", nome: "Salão" }]}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Luminárias — 20 unidades/)).toBeTruthy();
    tela.rerender(
      <QueryClientProvider client={client}>
        <GruposQuantitativos userId="usuario" clienteId="cliente-b" locais={[]} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(gateway.autorizarAcao).toHaveBeenCalledWith("cadastro.ler", "cliente-b"),
    );
    await waitFor(() => expect(screen.queryByText("Verificando acesso aos grupos...")).toBeNull());
    expect(screen.queryByText(/Luminárias — 20 unidades/)).toBeNull();
    expect(gateway.listarGrupos).not.toHaveBeenCalledWith(
      "cliente-b",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
  it("descarta formulário anterior ao trocar usuário no mesmo Cliente", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tela = render(
      <QueryClientProvider client={client}>
        <GruposQuantitativos userId="usuario-a" clienteId="cliente-a" locais={[]} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), {
      target: { value: "Dados do usuário A" },
    });
    tela.rerender(
      <QueryClientProvider client={client}>
        <GruposQuantitativos userId="usuario-b" clienteId="cliente-a" locais={[]} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Novo grupo" });
    expect(screen.queryByDisplayValue("Dados do usuário A")).toBeNull();
    expect(screen.queryByLabelText("Nome do grupo")).toBeNull();
  });
  it("permite iniciar cadastro somente com capacidade de gestão", async () => {
    gateway.autorizarAcao.mockImplementation(async (acao: string) => acao === "cadastro.gerir");
    gateway.listarGrupos.mockResolvedValue([]);
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    expect(screen.getByLabelText("Nome do grupo")).toBeTruthy();
    expect(screen.getByLabelText("Quantidade")).toBeTruthy();
  });
  it("recupera operação incerta com mesmo identificador e payload", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    gateway.salvarGrupo
      .mockRejectedValueOnce(new Error("conexão interrompida"))
      .mockResolvedValueOnce({});
    const tela = montar();
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    await screen.findByRole("alert");
    tela.unmount();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar salvar novamente" }));
    await waitFor(() => expect(gateway.salvarGrupo).toHaveBeenCalledTimes(2));
    expect(gateway.salvarGrupo.mock.calls[0]?.[0]).toEqual(gateway.salvarGrupo.mock.calls[1]?.[0]);
  });
  it("permite corrigir nome vazio sem registrar pedido pendente", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    montar("cliente-validacao");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText("Nome do grupo")).toBeTruthy();
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("sso-grupo-pendente:usuario:cliente-validacao")).toBeNull();
  });
  it("edita quantidade usando revisão atual e preserva Sistema e características", async () => {
    const grupoId = "17610000-0000-4000-8000-000000000061";
    const sistemaId = "17610000-0000-4000-8000-000000000051";
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([
      {
        id: grupoId,
        clienteId: "cliente-a",
        localId: "17610000-0000-4000-8000-000000000031",
        categoriaId: "17610000-0000-4000-8000-000000000041",
        sistemaId,
        nome: "Luminárias",
        quantidade: 20,
        caracteristicas: { " potencia ": "12 W" },
        revisao: 3,
      },
    ]);
    gateway.salvarGrupo.mockResolvedValue({});
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Editar Luminárias" }));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    await waitFor(() =>
      expect(gateway.salvarGrupo).toHaveBeenCalledWith(
        expect.objectContaining({
          grupoId,
          expectedRevision: 3,
          sistemaId,
          quantidade: 21,
          caracteristicas: { " potencia ": "12 W" },
        }),
      ),
    );
  });
  it("impede salvar edição aberta enquanto a lista é revalidada ou a revisão mudou", async () => {
    const grupo = {
      id: "17610000-0000-4000-8000-000000000061",
      clienteId: "cliente-a",
      nome: "Luminárias",
      quantidade: 20,
      localId: "17610000-0000-4000-8000-000000000031",
      categoriaId: "17610000-0000-4000-8000-000000000041",
      sistemaId: null,
      caracteristicas: {},
      revisao: 1,
    };
    gateway.autorizarAcao.mockResolvedValue(true);
    let concluir!: (valor: (typeof grupo)[]) => void;
    gateway.listarGrupos.mockResolvedValueOnce([grupo]).mockReturnValueOnce(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GruposQuantitativos
          userId="usuario"
          clienteId="cliente-a"
          locais={[{ id: grupo.localId, nome: "Salão" }]}
          categorias={[{ id: grupo.categoriaId, nome: "Iluminação" }]}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Editar Luminárias" }));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "22" } });
    void client.invalidateQueries({
      queryKey: ["estrutura-tecnica", "usuario", "cliente-a", "grupos"],
    });
    await waitFor(() => expect(gateway.listarGrupos).toHaveBeenCalledTimes(2));
    await screen.findByText("Atualizando grupos...");
    expect(
      (screen.getByRole("button", { name: "Salvar grupo" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    concluir([{ ...grupo, quantidade: 21, revisao: 2 }]);
    expect(await screen.findByText(/Luminárias — 21 unidades/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Salvar grupo" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Quantidade") as HTMLInputElement).value).toBe("22");
    expect(screen.getByRole("alert").textContent).toMatch(/revisão|atualiz/i);
  });
  it("mantém edição bloqueada após falha de consulta e permite retomar após retry", async () => {
    const grupo = {
      id: "17610000-0000-4000-8000-000000000061",
      clienteId: "cliente-a",
      nome: "Luminárias",
      quantidade: 20,
      localId: "17610000-0000-4000-8000-000000000031",
      categoriaId: "17610000-0000-4000-8000-000000000041",
      sistemaId: null,
      caracteristicas: {},
      revisao: 1,
    };
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos
      .mockResolvedValueOnce([grupo])
      .mockRejectedValueOnce(new Error("falha"))
      .mockResolvedValueOnce([grupo]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GruposQuantitativos userId="usuario" clienteId="cliente-a" locais={[]} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Editar Luminárias" }));
    await client.invalidateQueries({
      queryKey: ["estrutura-tecnica", "usuario", "cliente-a", "grupos"],
    });
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(
      (screen.getByRole("button", { name: "Salvar grupo" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(tentar);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Salvar grupo" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });
  it("conflito de revisão confirmado permite recarregar sem bloquear a próxima edição", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    gateway.salvarGrupo.mockRejectedValue({ code: "40001", message: "revisao_obsoleta" });
    montar("cliente-conflito");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/revisão/i);
    expect(sessionStorage.getItem("sso-grupo-pendente:usuario:cliente-conflito")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tentar salvar novamente" })).toBeNull();
  });
  it("cadastra grupo com Sistema e característica técnica", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    gateway.salvarGrupo.mockResolvedValue({});
    montar("cliente-caracteristicas");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    fireEvent.change(screen.getByLabelText("Sistema"), {
      target: { value: "17610000-0000-4000-8000-000000000051" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar característica" }));
    fireEvent.change(screen.getByLabelText("Nome da característica 1"), {
      target: { value: "Potência" },
    });
    fireEvent.change(screen.getByLabelText("Valor da característica 1"), {
      target: { value: "12 W" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    await waitFor(() =>
      expect(gateway.salvarGrupo).toHaveBeenCalledWith(
        expect.objectContaining({
          sistemaId: "17610000-0000-4000-8000-000000000051",
          caracteristicas: { Potência: "12 W" },
        }),
      ),
    );
  });
  it("consulta histórico do grupo selecionado ao solicitar", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([
      {
        id: "grupo",
        nome: "Luminárias",
        quantidade: 21,
        localId: "17610000-0000-4000-8000-000000000031",
      },
    ]);
    gateway.listarHistorico.mockResolvedValue([
      {
        id: "evento",
        data: "2026-10-27T10:00:00Z",
        acao: "grupo.atualizado",
        atorId: null,
        antes: { quantidade: 20 },
        depois: { quantidade: 21 },
      },
    ]);
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Histórico de Luminárias" }));
    expect(await screen.findByText(/Quantidade: 20 para 21/)).toBeTruthy();
    expect(gateway.listarHistorico).toHaveBeenCalledWith(
      "grupo",
      "grupo",
      20,
      null,
      expect.any(AbortSignal),
    );
  });
  it("atualiza histórico aberto depois de salvar edição", async () => {
    const grupoId = "17610000-0000-4000-8000-000000000061";
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([
      {
        id: grupoId,
        clienteId: "cliente-a",
        nome: "Luminárias",
        quantidade: 20,
        localId: "17610000-0000-4000-8000-000000000031",
        categoriaId: "17610000-0000-4000-8000-000000000041",
        sistemaId: null,
        caracteristicas: {},
        revisao: 1,
      },
    ]);
    gateway.listarHistorico
      .mockResolvedValueOnce([
        {
          id: "evento-a",
          data: "2026-10-27T10:00:00Z",
          acao: "grupo.atualizado",
          atorId: null,
          antes: { quantidade: 19 },
          depois: { quantidade: 20 },
        },
      ])
      .mockResolvedValue([
        {
          id: "evento-b",
          data: "2026-10-27T11:00:00Z",
          acao: "grupo.atualizado",
          atorId: null,
          antes: { quantidade: 20 },
          depois: { quantidade: 21 },
        },
      ]);
    gateway.salvarGrupo.mockResolvedValue({});
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Histórico de Luminárias" }));
    expect(await screen.findByText(/Quantidade: 19 para 20/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Editar Luminárias" }));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    expect(await screen.findByText(/Quantidade: 20 para 21/)).toBeTruthy();
  });
  it("permite corrigir dados após rejeição definitiva do servidor", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    gateway.salvarGrupo.mockRejectedValue({ code: "22023", message: "categoria_indisponivel" });
    montar("cliente-rejeicao");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/corrija/i);
    expect((screen.getByLabelText("Nome do grupo") as HTMLInputElement).value).toBe("Luminárias");
    expect(sessionStorage.getItem("sso-grupo-pendente:usuario:cliente-rejeicao")).toBeNull();
  });
  it("bloqueia novo cadastro quando operação guardada não pode ser recuperada", async () => {
    sessionStorage.setItem("sso-grupo-pendente:usuario:cliente-corrompido", "{invalido");
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    montar("cliente-corrompido");
    expect((await screen.findByRole("alert")).textContent).toMatch(/recuperar/i);
    expect(screen.queryByRole("button", { name: "Novo grupo" })).toBeNull();
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
  });
  it("não sobrescreve operação criada enquanto o formulário estava aberto", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    montar("cliente-concorrente");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    const chave = "sso-grupo-pendente:usuario:cliente-concorrente";
    sessionStorage.setItem(chave, "operação anterior");
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(sessionStorage.getItem(chave)).toBe("operação anterior");
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
  });
  it("não envia duas vezes ao submeter rapidamente o mesmo grupo", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    let concluir!: (valor: object) => void;
    gateway.salvarGrupo.mockReturnValue(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    montar("cliente-envio-rapido");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    const formulario = screen.getByRole("button", { name: "Salvar grupo" }).closest("form");
    if (!formulario) throw new Error("Formulário não encontrado.");
    act(() => {
      fireEvent.submit(formulario);
      fireEvent.submit(formulario);
    });
    await waitFor(() => expect(gateway.salvarGrupo).toHaveBeenCalledTimes(1));
    await act(async () => concluir({}));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("não apaga operação diferente quando resposta anterior chega", async () => {
    gateway.autorizarAcao.mockResolvedValue(true);
    gateway.listarGrupos.mockResolvedValue([]);
    let concluir!: (valor: object) => void;
    gateway.salvarGrupo.mockReturnValue(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    montar("cliente-resposta");
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Luminárias" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Local"), {
      target: { value: "17610000-0000-4000-8000-000000000031" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "17610000-0000-4000-8000-000000000041" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo" }));
    await waitFor(() => expect(gateway.salvarGrupo).toHaveBeenCalledTimes(1));
    const chave = "sso-grupo-pendente:usuario:cliente-resposta";
    sessionStorage.setItem(chave, "outra operação");
    concluir({});
    await screen.findByRole("alert");
    expect(sessionStorage.getItem(chave)).toBe("outra operação");
  });
});
