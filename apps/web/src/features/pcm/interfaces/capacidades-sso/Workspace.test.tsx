// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({
  listarPerfis: vi.fn(),
  listarVinculos: vi.fn(),
  listarConcessoes: vi.fn(),
  listarUsuarios: vi.fn(),
  listarClientes: vi.fn(),
  definirPerfil: vi.fn(),
  definirVinculoPerfil: vi.fn(),
  definirConcessao: vi.fn(),
  autorizarAcao: vi.fn(),
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: gateway,
}));
const servico = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: servico.getUser }, schema: servico.schema },
}));
import { CapacidadesWorkspace } from "./Workspace";

const usuario = "17020000-0000-0000-0000-000000000002";
const perfil = "17020000-0000-0000-0000-000000000010";
const cliente = "17020000-0000-0000-0000-00000000000a";
const request = "17020000-0000-0000-0000-000000000099";

function montar(userId = usuario) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CapacidadesWorkspace userId={userId} />
    </QueryClientProvider>,
  );
}

describe("configuração de capacidades", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    servico.getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
    servico.schema.mockReturnValue({ rpc: servico.rpc });
    servico.rpc.mockImplementation(async (_nome, args) => ({
      data: { requestId: args.p_request_id, confirmado: true },
      error: null,
    }));
    vi.stubGlobal("crypto", { randomUUID: () => request });
    gateway.listarPerfis.mockResolvedValue([
      { id: perfil, nome: "Equipe PCM", ativo: true, revisao: 1 },
    ]);
    gateway.listarVinculos.mockResolvedValue([]);
    gateway.listarConcessoes.mockResolvedValue([]);
    gateway.listarUsuarios.mockResolvedValue([
      { userId: usuario, nome: "Operador", papel: "colaborador", ativo: true },
    ]);
    gateway.listarClientes.mockResolvedValue([{ id: cliente, nome: "Condomínio A" }]);
    gateway.definirConcessao.mockImplementation(async (c) => ({
      aggregateId: usuario,
      revision: c.expectedRevision + 1,
      state: c.ativa,
      created: c.expectedRevision === 0,
      linkedIds: {},
      warnings: [],
      requestId: c.requestId,
    }));
    gateway.definirPerfil.mockImplementation(async (c) => ({
      aggregateId: c.perfilId,
      revision: c.expectedRevision + 1,
      state: c.ativo,
      created: c.expectedRevision === 0,
      linkedIds: {},
      warnings: [],
      requestId: c.requestId,
    }));
    gateway.definirVinculoPerfil.mockImplementation(async (c) => ({
      aggregateId: usuario,
      revision: c.expectedRevision + 1,
      state: c.ativo,
      created: c.expectedRevision === 0,
      linkedIds: { usuarioId: c.usuarioId, perfilId: c.perfilId },
      warnings: [],
      requestId: c.requestId,
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  async function iniciarConcessao() {
    montar();
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
  }

  async function prepararVinculo() {
    montar();
    await screen.findByRole("option", { name: "Operador" });
    await screen.findByRole("option", { name: "Equipe PCM" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Teste" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Perfil"), { target: { value: perfil } });
  }

  it("DEF-57: repete o mesmo vínculo quando a sessão responde e a fila de rede está pausada", async () => {
    sessionStorage.setItem(
      `sso-capacidades-pendente:${usuario}`,
      JSON.stringify({
        chave: "novo-vinculo",
        id: request,
        payload: {
          expectedRevision: 0,
          usuarioId: usuario,
          perfilId: perfil,
          ativo: true,
          motivo: "Teste",
        },
      }),
    );
    await prepararVinculo();
    act(() => onlineManager.setOnline(false));
    fireEvent.click(screen.getByRole("button", { name: "Repetir alteração pendente" }));
    await screen.findByText("Alteração registrada.");
    expect(gateway.definirVinculoPerfil).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: request }),
    );
    expect(sessionStorage.getItem(`sso-capacidades-pendente:${usuario}`)).toBeNull();
  });

  it.each(["revisao_obsoleta", "could not serialize access"])(
    "DEF-57: só libera a revisão no replay quando o servidor confirma %s",
    async (message) => {
      const chave = `sso-capacidades-pendente:${usuario}`;
      sessionStorage.setItem(
        chave,
        JSON.stringify({
          chave: "novo-vinculo",
          id: request,
          payload: {
            expectedRevision: 0,
            usuarioId: usuario,
            perfilId: perfil,
            ativo: true,
            motivo: "Teste",
          },
        }),
      );
      gateway.definirVinculoPerfil.mockRejectedValueOnce({ code: "40001", message });
      await prepararVinculo();
      fireEvent.click(screen.getByRole("button", { name: "Repetir alteração pendente" }));
      const aviso = await screen.findByRole("alert");
      if (message === "revisao_obsoleta") {
        expect(aviso).toHaveTextContent(/vínculo mudou.*nenhuma alteração foi aplicada/i);
        expect(sessionStorage.getItem(chave)).toBeNull();
      } else {
        expect(aviso).toHaveTextContent(/tentativa foi preservada/i);
        expect(sessionStorage.getItem(chave)).not.toBeNull();
      }
    },
  );

  it("DEF-57: encerra a espera da sessão sem registrar nem enviar uma nova tentativa", async () => {
    await prepararVinculo();
    const atribuir = screen.getByRole("button", { name: "Atribuir perfil ao usuário" });
    vi.useFakeTimers();
    servico.getUser.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.click(atribuir);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(screen.getByRole("alert")).toHaveTextContent(/sessão.*nenhuma alteração foi enviada/i);
    expect(atribuir).toBeEnabled();
    expect(gateway.definirVinculoPerfil).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`sso-capacidades-pendente:${usuario}`)).toBeNull();
  });

  it("DEF-57: orienta a reativação quando o par Usuário e Perfil já existe inativo", async () => {
    gateway.listarVinculos.mockResolvedValue([
      { id: "vinculo-ficticio", usuarioId: usuario, perfilId: perfil, ativo: false, revisao: 2 },
    ]);
    await prepararVinculo();
    await screen.findByRole("button", { name: "Reativar" });
    fireEvent.click(screen.getByRole("button", { name: "Atribuir perfil ao usuário" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/vínculo inativo.*reativar/i);
    expect(gateway.definirVinculoPerfil).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`sso-capacidades-pendente:${usuario}`)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    await screen.findByText("Alteração registrada.");
    expect(gateway.definirVinculoPerfil).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 2, ativo: true }),
    );
  });

  it("DEF-48: mostra processamento enquanto o vínculo ativo aguarda confirmação local", async () => {
    let confirmarSessao = () => {};
    gateway.listarVinculos.mockResolvedValueOnce([]);
    gateway.listarVinculos.mockResolvedValue([
      { id: "vinculo-ficticio", usuarioId: usuario, perfilId: perfil, ativo: true, revisao: 1 },
    ]);
    const definirVinculo = gateway.definirVinculoPerfil.getMockImplementation();
    gateway.definirVinculoPerfil.mockImplementationOnce(async (comando) => {
      servico.getUser.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            confirmarSessao = () => resolve({ data: { user: { id: usuario } }, error: null });
          }),
      );
      return definirVinculo?.(comando);
    });

    montar();
    await screen.findByRole("option", { name: "Operador" });
    await screen.findByRole("option", { name: "Equipe PCM" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Teste" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Perfil"), { target: { value: perfil } });
    fireEvent.click(screen.getByRole("button", { name: "Atribuir perfil ao usuário" }));

    await screen.findByRole("button", { name: "Revogar" });
    expect(screen.queryByRole("button", { name: /repetir alteração pendente/i })).toBeNull();
    expect(screen.getByText("Registrando alteração de capacidade…")).toBeTruthy();
    await act(async () => confirmarSessao());
    await screen.findByText("Alteração registrada.");
    expect(screen.queryByText("Registrando alteração de capacidade…")).toBeNull();
  });

  it("confirma recibo direto mesmo com consulta mediada indisponível", async () => {
    servico.rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
    await iniciarConcessao();
    await screen.findByText("Alteração registrada.");
    expect(servico.rpc).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /repetir alteração pendente/i })).toBeNull();
  });

  it.each(["requestId", "revision", "state", "created"])(
    "preserva pedido quando recibo direto diverge em %s",
    async (campo) => {
      gateway.definirConcessao.mockImplementationOnce(async (c) => ({
        aggregateId: usuario,
        revision: campo === "revision" ? 8 : c.expectedRevision + 1,
        state: campo === "state" ? !c.ativa : c.ativa,
        created: campo !== "created",
        linkedIds: {},
        warnings: [],
        requestId: campo === "requestId" ? "17020000-0000-0000-0000-000000000098" : c.requestId,
      }));
      await iniciarConcessao();
      await screen.findByRole("alert");
      expect(
        await screen.findByRole("button", { name: /repetir alteração pendente/i }),
      ).toBeTruthy();
      const enviado = gateway.definirConcessao.mock.calls[0]?.[0];
      fireEvent.click(screen.getByRole("button", { name: /repetir alteração pendente/i }));
      await waitFor(() => expect(gateway.definirConcessao).toHaveBeenCalledTimes(2));
      expect(gateway.definirConcessao.mock.calls[1]?.[0]).toEqual(enviado);
    },
  );

  it("preserva tentativa se a sessão mudar após a escrita", async () => {
    gateway.definirConcessao.mockImplementationOnce(async () => {
      servico.getUser.mockResolvedValue({
        data: { user: { id: "17020000-0000-0000-0000-000000000003" } },
        error: null,
      });
      return {};
    });
    await iniciarConcessao();
    await screen.findByText(
      "Resultado não confirmado. A tentativa foi preservada; confira o estado e procure suporte em caso de conflito.",
    );
    expect(servico.rpc).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /repetir alteração pendente/i })).toBeTruthy();
  });

  it("exige confirmação para escopo global e envia concessão individual", async () => {
    montar();
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "Responsabilidade PCM" },
    });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: "*" } });
    const botao = screen.getByRole("button", { name: "Conceder ação" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo/ }));
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    await waitFor(() =>
      expect(gateway.definirConcessao).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: usuario,
          perfilId: null,
          clienteId: null,
          acao: "plano.gerir",
          requestId: request,
        }),
      ),
    );
  });

  it("não oferece gestão de Plano para perfil", async () => {
    montar();
    await screen.findByRole("option", { name: "Equipe PCM" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "Responsabilidade PCM" },
    });
    fireEvent.change(screen.getByLabelText("Perfil"), { target: { value: perfil } });
    fireEvent.change(screen.getByLabelText("Conceder ação para"), { target: { value: "perfil" } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    expect(
      (screen.getByRole("button", { name: "Conceder ação" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(gateway.definirConcessao).not.toHaveBeenCalled();
  });

  it("bloqueia concessão durante reconsulta e após remoção do usuário selecionado", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CapacidadesWorkspace userId={usuario} />
      </QueryClientProvider>,
    );
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    const botao = screen.getByRole("button", { name: "Conceder ação" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    let resolver!: (dados: never[]) => void;
    gateway.listarUsuarios.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    void client.invalidateQueries({ queryKey: ["capacidades-sso", usuario, "usuarios"] });
    await waitFor(() => expect(botao.disabled).toBe(true));
    await act(async () => resolver([]));
    await waitFor(() => expect(screen.queryByRole("option", { name: "Operador" })).toBeNull());
    await waitFor(() => expect(botao.disabled).toBe(true));
    expect(gateway.definirConcessao).not.toHaveBeenCalled();
  });

  it.each([
    { tipo: "clientes", listar: "listarClientes" as const },
    { tipo: "perfis", listar: "listarPerfis" as const },
  ])("bloqueia concessão de perfil após falha ao atualizar $tipo", async ({ tipo, listar }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CapacidadesWorkspace userId={usuario} />
      </QueryClientProvider>,
    );
    await screen.findByRole("option", { name: "Equipe PCM" });
    await screen.findByRole("option", { name: "Condomínio A" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Perfil"), { target: { value: perfil } });
    fireEvent.change(screen.getByLabelText("Conceder ação para"), { target: { value: "perfil" } });
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "cadastro.ler" } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    const botao = screen.getByRole("button", { name: "Conceder ação" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    gateway[listar].mockRejectedValueOnce(new Error("indisponível"));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["capacidades-sso", usuario, tipo] });
    });
    await waitFor(() => expect(botao.disabled).toBe(true));
    expect(gateway.definirConcessao).not.toHaveBeenCalled();
  });

  it("edita nome do perfil com motivo e revisão existente", async () => {
    montar();
    await screen.findByRole("option", { name: "Equipe PCM" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "Atualização de função" },
    });
    fireEvent.change(screen.getByLabelText("Nome do perfil Equipe PCM"), {
      target: { value: "Equipe de Campo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() =>
      expect(gateway.definirPerfil).toHaveBeenCalledWith(
        expect.objectContaining({
          perfilId: perfil,
          nome: "Equipe de Campo",
          expectedRevision: 1,
          motivo: "Atualização de função",
        }),
      ),
    );
  });

  it("bloqueia alteração de perfil durante reconsulta da revisão", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CapacidadesWorkspace userId={usuario} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Desativar" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    let resolver!: (dados: never[]) => void;
    gateway.listarPerfis.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    void client.invalidateQueries({ queryKey: ["capacidades-sso", usuario, "perfis"] });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull());
    expect(gateway.definirPerfil).not.toHaveBeenCalled();
    await act(async () => resolver([]));
  });

  it.each(["vinculos", "concessoes"] as const)(
    "bloqueia alteração de %s durante reconsulta",
    async (tipo) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const listar = tipo === "vinculos" ? gateway.listarVinculos : gateway.listarConcessoes;
      const alterar = tipo === "vinculos" ? gateway.definirVinculoPerfil : gateway.definirConcessao;
      listar.mockResolvedValueOnce([
        tipo === "vinculos"
          ? { id: "v", usuarioId: usuario, perfilId: perfil, ativo: true, revisao: 1 }
          : {
              id: "c",
              usuarioId: usuario,
              perfilId: null,
              acao: "cadastro.ler",
              clienteId: cliente,
              ativa: true,
              revisao: 1,
            },
      ]);
      render(
        <QueryClientProvider client={client}>
          <CapacidadesWorkspace userId={usuario} />
        </QueryClientProvider>,
      );
      const botao = (await screen.findByRole("button", { name: "Revogar" })) as HTMLButtonElement;
      fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
      expect(botao.disabled).toBe(false);
      let resolver!: (dados: never[]) => void;
      listar.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolver = resolve;
          }),
      );
      void client.invalidateQueries({ queryKey: ["capacidades-sso", usuario, tipo] });
      await waitFor(() => expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull());
      expect(alterar).not.toHaveBeenCalled();
      await act(async () => resolver([]));
    },
  );

  it("não substitui concessão incerta e permite repetir os dados originais", async () => {
    gateway.definirConcessao.mockRejectedValueOnce(new Error("rede"));
    montar();
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Outro" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
    });
    expect(gateway.definirConcessao).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toMatch(/pendente/i);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
    await waitFor(() => expect(gateway.definirConcessao).toHaveBeenCalledTimes(2));
    expect(gateway.definirConcessao.mock.calls[1]?.[0]).toEqual(
      gateway.definirConcessao.mock.calls[0]?.[0],
    );
  });

  it("recupera concessão incerta após desmontar sem criar outro pedido", async () => {
    gateway.definirConcessao.mockRejectedValueOnce(new Error("rede"));
    const view = montar();
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
    await screen.findByRole("alert");
    const original = gateway.definirConcessao.mock.calls[0]?.[0];
    view.unmount();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /repetir alteração pendente/i }));
    await waitFor(() => expect(gateway.definirConcessao).toHaveBeenCalledTimes(2));
    expect(gateway.definirConcessao.mock.calls[1]?.[0]).toEqual(original);
  });

  it("permite corrigir dados rejeitados localmente sem criar pedido pendente", async () => {
    montar();
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Nome do perfil"), {
      target: { value: "x".repeat(121) },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));
    });
    expect(gateway.definirPerfil).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/confira/i);
    fireEvent.change(screen.getByLabelText("Nome do perfil"), { target: { value: "Campo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));
    await waitFor(() => expect(gateway.definirPerfil).toHaveBeenCalledTimes(1));
  });

  it("não oferece pedido pendente de outro usuário após troca de identidade", async () => {
    gateway.definirConcessao.mockRejectedValueOnce(new Error("rede"));
    const view = montar();
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
    await screen.findByRole("alert");
    view.unmount();
    const outra = montar("17020000-0000-0000-0000-000000000003");
    expect(screen.queryByRole("button", { name: /repetir alteração pendente/i })).toBeNull();
    outra.unmount();
    montar();
    expect(await screen.findByRole("button", { name: /repetir alteração pendente/i })).toBeTruthy();
  });

  it("limpa formulário e mensagens ao trocar usuário sem desmontar o componente externo", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <CapacidadesWorkspace userId={usuario} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "Motivo do usuário anterior" },
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <CapacidadesWorkspace userId="17020000-0000-0000-0000-000000000003" />
      </QueryClientProvider>,
    );
    expect((screen.getByLabelText("Motivo da alteração") as HTMLInputElement).value).toBe("");
  });

  it("não envia alteração quando armazenamento não aceita o pedido", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("indisponível");
    });
    montar();
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Nome do perfil"), { target: { value: "Campo" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Criar perfil" })));
    expect(gateway.definirPerfil).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/armazenamento/i);
    vi.restoreAllMocks();
  });

  it("bloqueia envio e preserva registro corrompido", async () => {
    const chave = `sso-capacidades-pendente:${usuario}`;
    sessionStorage.setItem(chave, "registro inválido");
    montar();
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Nome do perfil"), { target: { value: "Campo" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Criar perfil" })));
    expect(gateway.definirPerfil).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).toBe("registro inválido");
  });

  it("conserva pedido após revogação e permite repetir após recuperar acesso", async () => {
    gateway.definirConcessao.mockRejectedValueOnce({ code: "42501" });
    montar();
    await screen.findByRole("option", { name: "Operador" });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "PCM" } });
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: usuario } });
    fireEvent.change(screen.getByLabelText("Escopo"), { target: { value: cliente } });
    fireEvent.click(screen.getByRole("button", { name: "Conceder ação" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: /repetir alteração pendente/i }));
    await waitFor(() => expect(gateway.definirConcessao).toHaveBeenCalledTimes(2));
    expect(gateway.definirConcessao.mock.calls[1]?.[0]).toEqual(
      gateway.definirConcessao.mock.calls[0]?.[0],
    );
  });

  it("revoga usuário — E00-S27", async () => {
    const outro = "17020000-0000-0000-0000-000000000003";
    gateway.listarUsuarios.mockResolvedValue([
      { userId: usuario, nome: "Operador", papel: "colaborador", ativo: true },
      { userId: outro, nome: "Técnico Alvo", papel: "colaborador", ativo: true },
    ]);
    servico.rpc.mockImplementation(async (nome: string, args: Record<string, unknown>) => {
      if (nome === "sso_revogar_usuario") {
        return {
          data: { usuarioId: args.p_usuario_id, acao: "revogar", requestId: args.p_request_id },
          error: null,
        };
      }
      return { data: { requestId: args.p_request_id, confirmado: true }, error: null };
    });
    montar();
    await screen.findByRole("option", { name: "Técnico Alvo · ativo" });
    fireEvent.change(screen.getByLabelText("Usuário a revogar ou reativar"), {
      target: { value: outro },
    });
    fireEvent.change(screen.getByLabelText("Motivo da revogação ou reativação"), {
      target: { value: "Desligamento" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revogar usuário" }));
    await waitFor(() =>
      expect(servico.rpc).toHaveBeenCalledWith("sso_revogar_usuario", {
        p_request_id: request,
        p_usuario_id: outro,
        p_motivo: "Desligamento",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/revogado — efeito imediato/i),
    );
  });
});
