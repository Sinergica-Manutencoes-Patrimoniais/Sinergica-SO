// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  autorizarAcao: vi.fn(),
  listarPlanos: vi.fn(),
  salvarPlano: vi.fn(),
  listarVersoes: vi.fn(),
  listarRotinas: vi.fn(),
  adicionarRotina: vi.fn(),
  adicionarRotinaCompleta: vi.fn(),
  listarAlvos: vi.fn(),
  editarRotina: vi.fn(),
  transicionarRevisao: vi.fn(),
  aprovarPlano: vi.fn(),
  iniciarRevisao: vi.fn(),
  preverCiclos: vi.fn(),
  preverRevisao: vi.fn(),
  preverRevisaoRevisionada: vi.fn(),
  consultarQuestionarioAprovado: vi.fn(),
  retirarRotina: vi.fn(),
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: api,
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { AcoesRevisaoPlano } from "./AcoesRevisaoPlano";
import { DetalhePlano } from "./DetalhePlano";
import { PreviaCiclos } from "./PreviaCiclos";
import { PreviaRevisao } from "./PreviaRevisao";
import { PlanoManutencaoWorkspace } from "./Workspace";
const clienteId = "16500000-0000-4000-8000-00000000000a";
function montar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlanoManutencaoWorkspace userId="usuario" clienteId={clienteId} clienteNome="Guainumbi" />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it("bloqueia outro Cliente e preserva edição ao voltar ao contexto original", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const outro = "16500000-0000-4000-8000-00000000000b";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([]);
  const compor = (id: string) => (
    <QueryClientProvider client={client}>
      <PlanoManutencaoWorkspace userId="usuario" clienteId={id} clienteNome={id} />
    </QueryClientProvider>
  );
  const tela = render(compor(clienteId));
  await waitFor(() => expect(screen.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Novo Plano de Manutenção" }));
  fireEvent.change(screen.getByLabelText("Nome do Plano"), {
    target: { value: "Rascunho original" },
  });
  tela.rerender(compor(outro));
  expect(screen.getByRole("alert")).toHaveTextContent(/contexto mudou/i);
  expect(screen.getByDisplayValue("Rascunho original")).not.toBeVisible();
  expect(screen.queryByRole("button", { name: "Salvar rascunho" })).toBeNull();
  tela.rerender(compor(clienteId));
  expect(await screen.findByDisplayValue("Rascunho original")).toBeTruthy();
});
it("não mostra operação em andamento de outro Cliente e conserva comando original", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const outro = "16500000-0000-4000-8000-00000000000b";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([]);
  let resolver!: (valor: unknown) => void;
  api.salvarPlano.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  const compor = (id: string) => (
    <QueryClientProvider client={client}>
      <PlanoManutencaoWorkspace userId="usuario" clienteId={id} clienteNome={id} />
    </QueryClientProvider>
  );
  const tela = render(compor(clienteId));
  await waitFor(() => expect(screen.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Novo Plano de Manutenção" }));
  fireEvent.change(screen.getByLabelText("Nome do Plano"), { target: { value: "Plano pendente" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(api.salvarPlano).toHaveBeenCalledTimes(1));
  tela.rerender(compor(outro));
  expect(screen.getByRole("alert")).toHaveTextContent(/contexto mudou/i);
  expect(screen.getByText(/salvamento aguardando confirmação/i)).not.toBeVisible();
  expect(api.salvarPlano.mock.calls[0]?.[0]).toMatchObject({ clienteId, nome: "Plano pendente" });
  await act(async () => resolver({}));
  tela.rerender(compor(clienteId));
  expect(await screen.findByRole("button", { name: "Novo Plano de Manutenção" })).toBeTruthy();
});
it("consulta a versão aprovada por data sem assumir que a versão futura está vigente", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "aprovado" as const,
    revisao: 3,
  };
  api.listarVersoes.mockResolvedValue([
    {
      id: "versao-1",
      planoId,
      numero: 1,
      estado: "aprovado",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: "2026-12-31",
    },
    {
      id: "versao-2",
      planoId,
      numero: 2,
      estado: "aprovado",
      vigenciaInicio: "2027-01-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([]);
  render(
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={plano}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Consultar vigência na data"), {
    target: { value: "2026-12-31" },
  });
  expect(screen.getByText("Versão 1 cobre a data informada.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver versão 1" }));
  expect(screen.getByLabelText("Versão do Plano")).toHaveValue("versao-1");
  fireEvent.change(screen.getByLabelText("Consultar vigência na data"), {
    target: { value: "2027-01-01" },
  });
  expect(screen.getByText("Versão 2 cobre a data informada.")).toBeTruthy();
});
it("permite consultar questionário congelado da Rotina aprovada", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "aprovado" as const,
    revisao: 3,
  };
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "aprovado",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: "rotina",
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "sistema",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: "Inspecionar",
      questionarioId: "q",
      questionarioNome: "Original",
    },
  ]);
  api.consultarQuestionarioAprovado.mockResolvedValue({
    rotinaId: "rotina",
    versaoId,
    questionario: {
      id: "q",
      nome: "Original congelado",
      cabecalho: null,
      rodape: null,
      perguntas: [{ texto: "Pergunta histórica" }],
    },
  });
  render(
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={plano}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Ver questionário de Inspeção" }));
  expect(await screen.findByText("Pergunta histórica")).toBeTruthy();
  expect(screen.getByText("Original congelado")).toBeTruthy();
  expect(api.consultarQuestionarioAprovado).toHaveBeenCalledWith(
    planoId,
    versaoId,
    "rotina",
    expect.any(AbortSignal),
  );
});
it("não informa ausência de Rotinas durante atualização de versões", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "rascunho" as const,
    revisao: 3,
  };
  api.listarVersoes.mockResolvedValueOnce([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([]);
  let concluir!: (valor: unknown[]) => void;
  api.listarVersoes.mockReturnValueOnce(
    new Promise((resolve) => {
      concluir = resolve;
    }),
  );
  render(
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={plano}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>,
  );
  await screen.findByLabelText("Versão do Plano");
  void client.invalidateQueries({
    queryKey: planoManutencaoKeys.versoes("usuario", clienteId, planoId),
  });
  await screen.findByText("Carregando versões...");
  expect(screen.queryByText("Nenhuma Rotina cadastrada neste Plano.")).toBeNull();
  await act(async () => {
    concluir([
      {
        id: versaoId,
        planoId,
        numero: 1,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ]);
  });
});
it("não troca silenciosamente a versão escolhida quando ela desaparece na atualização", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const anterior = "16500000-0000-4000-8000-000000000090";
  const rascunho = "16500000-0000-4000-8000-000000000091";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "rascunho" as const,
    revisao: 3,
  };
  api.listarVersoes
    .mockResolvedValueOnce([
      {
        id: anterior,
        planoId,
        numero: 1,
        estado: "aprovado",
        vigenciaInicio: "2026-01-01",
        vigenciaFim: null,
      },
      {
        id: rascunho,
        planoId,
        numero: 2,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: rascunho,
        planoId,
        numero: 2,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ]);
  api.listarRotinas.mockResolvedValue([]);
  render(
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={plano}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>,
  );
  const seletor = await screen.findByLabelText("Versão do Plano");
  fireEvent.change(seletor, { target: { value: anterior } });
  await waitFor(() => expect(seletor).toHaveValue(anterior));
  await act(async () => {
    await client.invalidateQueries({
      queryKey: planoManutencaoKeys.versoes("usuario", clienteId, planoId),
    });
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "A versão escolhida não está disponível",
  );
  expect(screen.getByLabelText("Versão do Plano")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Nova Rotina" })).toBeNull();
});
it("bloqueia criação aberta se versão escolhida deixa de estar disponível", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const rascunho = "16500000-0000-4000-8000-000000000091";
  const anterior = "16500000-0000-4000-8000-000000000090";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "rascunho" as const,
    revisao: 3,
  };
  api.listarVersoes
    .mockResolvedValueOnce([
      {
        id: rascunho,
        planoId,
        numero: 2,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: anterior,
        planoId,
        numero: 1,
        estado: "aprovado",
        vigenciaInicio: "2026-01-01",
        vigenciaFim: null,
      },
    ]);
  api.listarRotinas.mockResolvedValue([]);
  api.listarAlvos.mockResolvedValue([]);
  render(
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={plano}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Versão do Plano"), {
    target: { value: rascunho },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Nova Rotina" }));
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), {
    target: { value: "Rascunho preservado" },
  });
  await act(async () => {
    await client.invalidateQueries({
      queryKey: planoManutencaoKeys.versoes("usuario", clienteId, planoId),
    });
  });
  expect(screen.getByLabelText("Nome da Rotina")).toHaveValue("Rascunho preservado");
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar Rotina" })).toBeDisabled());
});
it.each(["versoes", "rotinas"])(
  "oculta Rotina antiga e sua edição quando consulta de %s perde acesso",
  async (consulta) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const planoId = "16500000-0000-4000-8000-000000000011";
    const versaoId = "16500000-0000-4000-8000-000000000091";
    const plano = {
      id: planoId,
      clienteId,
      nome: "Preventivo",
      estado: "rascunho" as const,
      revisao: 3,
    };
    api.listarVersoes.mockResolvedValue([
      {
        id: versaoId,
        planoId,
        numero: 1,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ]);
    api.listarRotinas.mockResolvedValue([
      {
        id: "rotina",
        planoId,
        versaoId,
        nome: "Inspeção",
        alvoTipo: "sistema",
        alvoId: "sistema",
        alvoNome: "Extintores",
        alvoAtivo: true,
        modo: "calendario",
        intervalo: 1,
        unidade: "meses",
        dataBase: "2026-11-01",
        tempoMinutos: 45,
        tipoTempo: "total",
        toleranciaAntes: 0,
        toleranciaDepois: 0,
        instrucao: "Inspecionar",
        questionarioId: null,
        questionarioNome: null,
      },
    ]);
    render(
      <QueryClientProvider client={client}>
        <DetalhePlano
          userId="usuario"
          clienteId={clienteId}
          plano={plano}
          onAtualizar={() => {}}
          onEdicaoAtiva={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: "Editar Rotina Inspeção" })).toBeTruthy();
    if (consulta === "versoes") api.listarVersoes.mockRejectedValue({ code: "42501" });
    else api.listarRotinas.mockRejectedValue({ code: "42501" });
    const chave =
      consulta === "versoes"
        ? planoManutencaoKeys.versoes("usuario", clienteId, planoId)
        : planoManutencaoKeys.rotinas("usuario", clienteId, planoId, versaoId);
    await act(async () => {
      await client.invalidateQueries({ queryKey: chave });
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Inspeção")).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar Rotina Inspeção" })).toBeNull();
  },
);
it("preserva edição e impede salvar Rotina antiga após revisão concorrente do Plano", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "rascunho" as const,
    revisao: 3,
  };
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: "rotina",
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "sistema",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: "Inspecionar",
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  api.listarAlvos.mockResolvedValue([]);
  const compor = (revisao: number) => (
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={{ ...plano, revisao }}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>
  );
  const tela = render(compor(3));
  fireEvent.click(await screen.findByRole("button", { name: "Editar Rotina Inspeção" }));
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), {
    target: { value: "Alteração não salva" },
  });
  tela.rerender(compor(4));
  expect(screen.getByLabelText("Nome da Rotina")).toHaveValue("Alteração não salva");
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar Rotina" })).toBeDisabled());
  expect(api.editarRotina).not.toHaveBeenCalled();
});

it("bloqueia edição de Rotina quando versão padrão muda durante atualização", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const plano = {
    id: planoId,
    clienteId,
    nome: "Preventivo",
    estado: "rascunho" as const,
    revisao: 3,
  };
  const versao = {
    id: versaoId,
    planoId,
    numero: 1,
    estado: "rascunho",
    vigenciaInicio: null,
    vigenciaFim: null,
  };
  api.listarVersoes
    .mockResolvedValueOnce([versao])
    .mockResolvedValueOnce([{ ...versao, id: "16500000-0000-4000-8000-000000000092", numero: 2 }]);
  api.listarRotinas.mockResolvedValue([
    {
      id: "rotina",
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "sistema",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: "Inspecionar",
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  api.listarAlvos.mockResolvedValue([]);
  render(
    <QueryClientProvider client={client}>
      <DetalhePlano
        userId="usuario"
        clienteId={clienteId}
        plano={plano}
        onAtualizar={() => {}}
        onEdicaoAtiva={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Editar Rotina Inspeção" }));
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), {
    target: { value: "Alteração preservada" },
  });
  await act(async () => {
    await client.invalidateQueries({
      queryKey: planoManutencaoKeys.versoes("usuario", clienteId, planoId),
    });
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Versão do Plano")).toHaveValue(
      "16500000-0000-4000-8000-000000000092",
    ),
  );
  await waitFor(() => expect(api.listarRotinas).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("Nome da Rotina")).toHaveValue("Alteração preservada");
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar Rotina" })).toBeDisabled());
  expect(api.editarRotina).not.toHaveBeenCalled();
});
it.each(["versoes", "rotinas"])(
  "bloqueia formulário aberto quando consulta de %s perde acesso, sem apagar edição",
  async (consulta) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const planoId = "16500000-0000-4000-8000-000000000011";
    const versaoId = "16500000-0000-4000-8000-000000000091";
    const plano = {
      id: planoId,
      clienteId,
      nome: "Preventivo",
      estado: "rascunho" as const,
      revisao: 3,
    };
    api.listarVersoes.mockResolvedValue([
      {
        id: versaoId,
        planoId,
        numero: 1,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ]);
    api.listarRotinas.mockResolvedValue([
      {
        id: "rotina",
        planoId,
        versaoId,
        nome: "Inspeção",
        alvoTipo: "sistema",
        alvoId: "sistema",
        alvoNome: "Extintores",
        alvoAtivo: true,
        modo: "calendario",
        intervalo: 1,
        unidade: "meses",
        dataBase: "2026-11-01",
        tempoMinutos: 45,
        tipoTempo: "total",
        toleranciaAntes: 0,
        toleranciaDepois: 0,
        instrucao: "Inspecionar",
        questionarioId: null,
        questionarioNome: null,
      },
    ]);
    api.listarAlvos.mockResolvedValue([]);
    render(
      <QueryClientProvider client={client}>
        <DetalhePlano
          userId="usuario"
          clienteId={clienteId}
          plano={plano}
          onAtualizar={() => {}}
          onEdicaoAtiva={() => {}}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Editar Rotina Inspeção" }));
    fireEvent.change(screen.getByLabelText("Nome da Rotina"), {
      target: { value: "Alteração não salva" },
    });
    if (consulta === "versoes") api.listarVersoes.mockRejectedValue({ code: "42501" });
    else api.listarRotinas.mockRejectedValue({ code: "42501" });
    const chave =
      consulta === "versoes"
        ? planoManutencaoKeys.versoes("usuario", clienteId, planoId)
        : planoManutencaoKeys.rotinas("usuario", clienteId, planoId, versaoId);
    await act(async () => {
      await client.invalidateQueries({ queryKey: chave });
    });
    expect(screen.getByLabelText("Nome da Rotina")).toHaveValue("Alteração não salva");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvar Rotina" })).toBeDisabled(),
    );
    expect(api.editarRotina).not.toHaveBeenCalled();
  },
);
it("exige escolha explícita entre versões aprovadas e mostra períodos", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const futura = "16500000-0000-4000-8000-000000000090";
  const atual = "16500000-0000-4000-8000-000000000091";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "aprovado", revisao: 7 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: futura,
      planoId,
      numero: 2,
      estado: "aprovado",
      vigenciaInicio: "2999-01-01",
      vigenciaFim: null,
    },
    {
      id: atual,
      planoId,
      numero: 1,
      estado: "aprovado",
      vigenciaInicio: "2000-01-01",
      vigenciaFim: "2998-12-31",
    },
  ]);
  api.listarRotinas.mockResolvedValue([]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /Rotinas.*Preventivo/i }));
  const seletor = (await screen.findByLabelText("Versão do Plano")) as HTMLSelectElement;
  expect(seletor.value).toBe("");
  expect(api.listarRotinas).not.toHaveBeenCalled();
  expect(screen.getByRole("option", { name: /Versão 2.*2999-01-01/i })).toBeTruthy();
  expect(screen.getByRole("option", { name: /Versão 1.*2000-01-01.*2998-12-31/i })).toBeTruthy();
  fireEvent.change(seletor, { target: { value: atual } });
  await waitFor(() =>
    expect(api.listarRotinas).toHaveBeenCalledWith(planoId, atual, 50, null, expect.anything()),
  );
});
it("consulta ciclos da Rotina aprovada sem criar Ocorrências", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const rotinaId = "16500000-0000-4000-8000-000000000089";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "aprovado", revisao: 4 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "aprovado",
      vigenciaInicio: "2026-11-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: rotinaId,
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "16500000-0000-4000-8000-000000000051",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 2,
      toleranciaDepois: 3,
      instrucao: "Inspecionar",
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  api.preverCiclos.mockResolvedValue([
    { ciclo: 0, vencimento: "2026-11-01", toleranciaAntes: 2, toleranciaDepois: 3 },
  ]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /Rotinas.*Preventivo/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Prévia de Inspeção" }));
  fireEvent.change(screen.getByLabelText("Início da prévia"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fim da prévia"), { target: { value: "2026-12-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar ciclos" }));
  expect(await screen.findByText(/Ciclo 0: 01\/11\/2026/)).toBeTruthy();
  expect(screen.getByText(/Janela: 30\/10\/2026 a 04\/11\/2026/)).toBeTruthy();
  expect(screen.getByText(/Prévia informativa: não cria Ocorrências/i)).toBeTruthy();
  expect(api.preverCiclos).toHaveBeenCalledWith(
    planoId,
    versaoId,
    rotinaId,
    "2026-11-01",
    "2026-12-01",
    expect.any(AbortSignal),
  );
});
it("compara conteúdo da revisão sem afirmar impacto operacional", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const rascunhoId = "16500000-0000-4000-8000-000000000092";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 5 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "aprovado",
      vigenciaInicio: "2026-11-01",
      vigenciaFim: null,
    },
    {
      id: rascunhoId,
      planoId,
      numero: 2,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([]);
  api.preverRevisaoRevisionada.mockResolvedValue({
    revision: 5,
    versaoAnteriorId: versaoId,
    versaoRascunhoId: rascunhoId,
    nextCursor: null,
    impactosOperacionaisPendentes: true,
    items: [
      {
        rotinaLogicaId: "16500000-0000-4000-8000-000000000081",
        anterior: { nome: "Inspeção" },
        rascunho: { nome: "Inspeção mensal" },
        classificacao: "alterada",
        questionarioConteudoPendente: false,
      },
    ],
  });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /Rotinas.*Preventivo/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Comparar revisão" }));
  expect(await screen.findByText(/Inspeção mensal.*Alterada/)).toBeTruthy();
  expect(screen.getByText(/impactos.*Ocorrências.*OS.*não foram calculados/i)).toBeTruthy();
  expect(api.preverRevisaoRevisionada).toHaveBeenCalledWith(
    planoId,
    5,
    20,
    null,
    expect.any(AbortSignal),
  );
  expect(api.preverRevisao).not.toHaveBeenCalled();
  expect(api.aprovarPlano).not.toHaveBeenCalled();
});
it("retira Rotina de rascunho com motivo e recupera pedido incerto", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const rotinaId = "16500000-0000-4000-8000-000000000081";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: rotinaId,
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "16500000-0000-4000-8000-000000000051",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: "Inspecionar",
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  api.retirarRotina
    .mockRejectedValueOnce(new Error("rede"))
    .mockResolvedValueOnce({ warnings: [] });
  const tela = montar();
  fireEvent.click(await screen.findByRole("button", { name: /Rotinas.*Preventivo/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Retirar Rotina" }));
  fireEvent.change(screen.getByLabelText("Rotina a retirar"), { target: { value: rotinaId } });
  fireEvent.change(screen.getByLabelText("Motivo da retirada"), {
    target: { value: "Escopo revisado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
  expect(await screen.findByText(/não foi possível confirmar a retirada/i)).toBeTruthy();
  tela.unmount();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /Rotinas.*Preventivo/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Tentar retirada novamente" }));
  await waitFor(() => expect(api.retirarRotina).toHaveBeenCalledTimes(2));
  expect(api.retirarRotina.mock.calls[0]?.[0]).toEqual(api.retirarRotina.mock.calls[1]?.[0]);
  expect(api.retirarRotina.mock.calls[0]?.[0]).toMatchObject({
    planoId,
    rotinaId,
    expectedRevision: 3,
    motivo: "Escopo revisado",
  });
});
it.each([
  "sso-rotina-nova",
  "sso-rotina-editar:16500000-0000-4000-8000-000000000082",
  "sso-plano-revisao",
])("não retira Rotina enquanto %s está pendente no mesmo Plano", async (tipo) => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const rotinaId = "16500000-0000-4000-8000-000000000081";
  const chave = `${tipo}:usuario:${clienteId}:${planoId}`;
  sessionStorage.setItem(chave, "pedido ainda não confirmado");
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: rotinaId,
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "16500000-0000-4000-8000-000000000051",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: "Inspecionar",
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /Rotinas.*Preventivo/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Retirar Rotina" }));
  fireEvent.change(screen.getByLabelText("Rotina a retirar"), { target: { value: rotinaId } });
  fireEvent.change(screen.getByLabelText("Motivo da retirada"), {
    target: { value: "Escopo revisado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
  expect(await screen.findByText(/operação pendente/i)).toBeTruthy();
  expect(api.retirarRotina).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(chave)).toBe("pedido ainda não confirmado");
});
it("não mostra comparação de outra revisão do Plano", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.preverRevisao.mockResolvedValue([
    {
      rotinaLogicaId: "16500000-0000-4000-8000-000000000081",
      rotinaAnteriorId: null,
      rotinaRascunhoId: "16500000-0000-4000-8000-000000000083",
      nomeAnterior: null,
      nomeRascunho: "Alteração concorrente",
      classificacao: "adicionada",
      revisao: 6,
      impactosOperacionaisPendentes: true,
    },
  ]);
  render(
    <QueryClientProvider client={client}>
      <PreviaRevisao userId="usuario" clienteId={clienteId} planoId="plano" revisao={5} />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/Plano mudou/i);
  expect(screen.queryByText(/Alteração concorrente/)).toBeNull();
});
it("oculta comparação quando atualização do Plano perde autorização", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.preverRevisao
    .mockResolvedValueOnce([
      {
        rotinaLogicaId: "16500000-0000-4000-8000-000000000081",
        rotinaAnteriorId: null,
        rotinaRascunhoId: "16500000-0000-4000-8000-000000000083",
        nomeAnterior: null,
        nomeRascunho: "Inspeção",
        classificacao: "adicionada",
        revisao: 5,
        impactosOperacionaisPendentes: true,
      },
    ])
    .mockRejectedValueOnce({ code: "42501" });
  render(
    <QueryClientProvider client={client}>
      <PreviaRevisao userId="usuario" clienteId={clienteId} planoId="plano" revisao={5} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/Inspeção.*Adicionada/)).toBeTruthy();
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["plano-manutencao", "usuario", clienteId] });
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível comparar/i);
  expect(screen.queryByText(/Inspeção.*Adicionada/)).toBeNull();
});
it("não mostra ciclos antigos quando nova consulta perde autorização", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.preverCiclos
    .mockResolvedValueOnce([
      { ciclo: 0, vencimento: "2026-11-01", toleranciaAntes: 0, toleranciaDepois: 0 },
    ])
    .mockRejectedValueOnce({ code: "42501" });
  render(
    <QueryClientProvider client={client}>
      <PreviaCiclos
        userId="usuario"
        clienteId={clienteId}
        planoId="plano"
        versaoId="versao"
        rotinaId="rotina"
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Início da prévia"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fim da prévia"), { target: { value: "2026-12-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar ciclos" }));
  expect(await screen.findByText(/Ciclo 0: 01\/11\/2026/)).toBeTruthy();
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["plano-manutencao", "usuario", clienteId] });
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível consultar/i);
  expect(screen.queryByText(/Ciclo 0: 01\/11\/2026/)).toBeNull();
});
it("cria rascunho e repete o mesmo pedido após falha incerta", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([]);
  api.salvarPlano.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({});
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Novo Plano de Manutenção" }));
  fireEvent.change(screen.getByLabelText("Nome do Plano"), {
    target: { value: "Preventivo Guainumbi" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar salvar novamente" }));
  await waitFor(() => expect(api.salvarPlano).toHaveBeenCalledTimes(2));
  expect(api.salvarPlano.mock.calls[0]?.[0]).toEqual(api.salvarPlano.mock.calls[1]?.[0]);
  expect(api.salvarPlano.mock.calls[0]?.[0]).toMatchObject({
    clienteId,
    nome: "Preventivo Guainumbi",
    expectedRevision: 0,
  });
});
it("não sobrescreve salvamento de Plano surgido após abrir formulário", async () => {
  const chave = `sso-plano-pendente:usuario:${clienteId}`;
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([]);
  montar();
  await waitFor(() => expect(screen.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Novo Plano de Manutenção" }));
  fireEvent.change(screen.getByLabelText("Nome do Plano"), { target: { value: "Preventivo" } });
  sessionStorage.setItem(chave, "pedido anterior ainda incerto");
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  expect(await screen.findByText(/operação pendente/i)).toBeTruthy();
  expect(api.salvarPlano).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(chave)).toBe("pedido anterior ainda incerto");
});
it("não oferece gestão nem consulta quando a capacidade é negada", async () => {
  api.autorizarAcao.mockResolvedValue(false);
  montar();
  expect(await screen.findByText(/sem permissão para gerir Planos/i)).toBeTruthy();
  expect(api.listarPlanos).not.toHaveBeenCalled();
});
it("edita o mesmo Plano usando revisão recebida", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.salvarPlano.mockResolvedValue({});
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Editar Preventivo" }));
  fireEvent.change(screen.getByLabelText("Nome do Plano"), {
    target: { value: "Preventivo anual" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() =>
    expect(api.salvarPlano).toHaveBeenCalledWith(
      expect.objectContaining({
        planoId,
        clienteId,
        expectedRevision: 3,
        nome: "Preventivo anual",
      }),
    ),
  );
});
it("abre Rotinas da versão selecionada sem misturar outros Planos", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: "r",
      nome: "Inspeção mensal",
      alvoTipo: "sistema",
      alvoId: "s",
      alvoNome: "Extintores Torre A",
      alvoAtivo: true,
      planoId,
      versaoId,
      modo: "calendario",
      intervalo: null,
      unidade: null,
      dataBase: null,
      tempoMinutos: 0,
      tipoTempo: null,
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: null,
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  expect(await screen.findByText("Inspeção mensal")).toBeTruthy();
  expect(screen.getByText(/Extintores Torre A/)).toBeTruthy();
  expect(screen.getByText("Tempo a validar")).toBeTruthy();
  expect(screen.getByText(/Recorrência não informada/)).toBeTruthy();
  expect(screen.getByText(/Data-base não informada/)).toBeTruthy();
  expect(screen.getByText(/Instrução ou questionário não informado/)).toBeTruthy();
  expect(api.listarRotinas).toHaveBeenCalledWith(
    planoId,
    versaoId,
    50,
    null,
    expect.any(AbortSignal),
  );
});
it("cria Rotina completa e repete mesmo pedido após falha incerta", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const alvoId = "16500000-0000-4000-8000-000000000051";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([]);
  api.listarAlvos.mockImplementation(async (_plano: string, tipo: string) =>
    tipo === "sistema" ? [{ id: alvoId, nome: "Extintores" }] : [],
  );
  api.adicionarRotinaCompleta.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({});
  const tela = montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Nova Rotina" }));
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), {
    target: { value: "Inspeção mensal" },
  });
  await screen.findByRole("option", { name: "Extintores" });
  fireEvent.change(screen.getByLabelText("Alvo da Rotina"), { target: { value: alvoId } });
  fireEvent.change(screen.getByLabelText("Intervalo"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Tempo estimado em minutos"), { target: { value: "45" } });
  fireEvent.change(screen.getByLabelText("Referência do tempo"), { target: { value: "total" } });
  fireEvent.change(screen.getByLabelText("Instrução"), { target: { value: "Inspecionar" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar Rotina" }));
  await screen.findByRole("alert");
  tela.unmount();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Nova Rotina" }));
  fireEvent.click(screen.getByRole("button", { name: "Tentar salvar Rotina novamente" }));
  await waitFor(() => expect(api.adicionarRotinaCompleta).toHaveBeenCalledTimes(2));
  expect(api.adicionarRotinaCompleta.mock.calls[0]?.[0]).toEqual(
    api.adicionarRotinaCompleta.mock.calls[1]?.[0],
  );
  expect(api.adicionarRotinaCompleta.mock.calls[0]?.[0]).toMatchObject({
    planoId,
    expectedRevision: 3,
    alvoId,
    tipoTempo: "total",
    tempoMinutos: 45,
  });
});
it.each([
  "sso-rotina-nova",
  "sso-rotina-editar:16500000-0000-4000-8000-000000000082",
  "sso-rotina-retirada",
  "sso-plano-revisao",
])("não inicia salvamento de Rotina com %s pendente no mesmo Plano", async (tipo) => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const alvoId = "16500000-0000-4000-8000-000000000051";
  const chave = `${tipo}:usuario:${clienteId}:${planoId}`;
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([]);
  api.listarAlvos.mockResolvedValue([{ id: alvoId, nome: "Extintores" }]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Nova Rotina" }));
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), { target: { value: "Inspeção" } });
  await screen.findByRole("option", { name: "Extintores" });
  fireEvent.change(screen.getByLabelText("Alvo da Rotina"), { target: { value: alvoId } });
  sessionStorage.setItem(chave, "pedido ainda não confirmado");
  fireEvent.click(screen.getByRole("button", { name: "Salvar Rotina" }));
  expect(await screen.findByText(/operação pendente/i)).toBeTruthy();
  expect(api.adicionarRotinaCompleta).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(chave)).toBe("pedido ainda não confirmado");
});
it("edita Rotina em rascunho preservando identidade e revisão do Plano", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  const rotinaId = "16500000-0000-4000-8000-000000000081";
  const alvoId = "16500000-0000-4000-8000-000000000051";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: rotinaId,
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId,
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 2,
      toleranciaDepois: 3,
      instrucao: "Inspecionar",
      questionarioId: null,
      questionarioNome: null,
    },
  ]);
  api.listarAlvos.mockImplementation(async (_plano: string, tipo: string) =>
    tipo === "sistema" ? [{ id: alvoId, nome: "Extintores" }] : [],
  );
  api.editarRotina.mockResolvedValue({});
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  expect(await screen.findByText(/Data-base: 01\/11\/2026/)).toBeTruthy();
  expect(screen.getByText(/Inspecionar/)).toBeTruthy();
  expect(screen.getByText(/2 dias antes.*3 dias depois/)).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Editar Rotina Inspeção" }));
  fireEvent.change(screen.getByLabelText("Tempo estimado em minutos"), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar Rotina" }));
  await waitFor(() =>
    expect(api.editarRotina).toHaveBeenCalledWith(
      expect.objectContaining({
        planoId,
        rotinaId,
        expectedRevision: 3,
        alvoId,
        tempoMinutos: 60,
        tipoTempo: "total",
        toleranciaAntes: 2,
      }),
    ),
  );
});
it("identifica conteúdo histórico e não oferece edição de versão aprovada", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const versaoId = "16500000-0000-4000-8000-000000000091";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "aprovado", revisao: 4 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 1,
      estado: "aprovado",
      vigenciaInicio: "2026-11-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  expect(await screen.findByText(/dados congelados na aprovação/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Nova Rotina" })).toBeNull();
});

it("recupera submissão incerta e repete o mesmo comando", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.transicionarRevisao
    .mockRejectedValueOnce(new Error("rede"))
    .mockResolvedValueOnce({ warnings: [] });
  const tela = montar();
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Preventivo para revisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para revisão" }));
  expect(await screen.findByText(/não foi possível confirmar a operação/i)).toBeTruthy();
  tela.unmount();
  montar();
  fireEvent.click(
    await screen.findByRole("button", { name: "Tentar operação de Preventivo novamente" }),
  );
  await waitFor(() => expect(api.transicionarRevisao).toHaveBeenCalledTimes(2));
  expect(api.transicionarRevisao.mock.calls[0]?.[0]).toEqual(
    api.transicionarRevisao.mock.calls[1]?.[0],
  );
});

it("preserva pedido incerto quando retry perde permissão", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.transicionarRevisao
    .mockRejectedValueOnce(new Error("rede"))
    .mockRejectedValueOnce({ code: "42501" })
    .mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Preventivo para revisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para revisão" }));
  expect(await screen.findByText(/não foi possível confirmar a operação/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação de Preventivo novamente" }));
  await waitFor(() => expect(api.transicionarRevisao).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/permissão.*pendente/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação de Preventivo novamente" }));
  await waitFor(() => expect(api.transicionarRevisao).toHaveBeenCalledTimes(3));
  expect(api.transicionarRevisao.mock.calls[0]?.[0]).toEqual(
    api.transicionarRevisao.mock.calls[2]?.[0],
  );
});

it("inicia rascunho de nova versão com confirmação e retry idêntico", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "aprovado", revisao: 4 },
  ]);
  api.iniciarRevisao
    .mockRejectedValueOnce(new Error("rede"))
    .mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Iniciar revisão de Preventivo" }));
  expect(api.iniciarRevisao).not.toHaveBeenCalled();
  expect(screen.getByText(/nova versão.*não será aprovada/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar início da revisão" }));
  expect(await screen.findByText(/não foi possível confirmar a operação/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação de Preventivo novamente" }));
  await waitFor(() => expect(api.iniciarRevisao).toHaveBeenCalledTimes(2));
  expect(api.iniciarRevisao.mock.calls[0]?.[0]).toEqual(api.iniciarRevisao.mock.calls[1]?.[0]);
  expect(api.iniciarRevisao.mock.calls[0]?.[0]).toMatchObject({ planoId, expectedRevision: 4 });
  expect(api.aprovarPlano).not.toHaveBeenCalled();
});

it("não confirma revisão se Plano mudou com diálogo aberto", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const plano = {
    id: "16500000-0000-4000-8000-000000000011",
    clienteId,
    nome: "Preventivo",
    estado: "aprovado" as const,
    revisao: 4,
  };
  const tela = render(
    <QueryClientProvider client={client}>
      <AcoesRevisaoPlano userId="usuario" clienteId={clienteId} plano={plano} bloqueado={false} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Iniciar revisão de Preventivo" }));
  tela.rerender(
    <QueryClientProvider client={client}>
      <AcoesRevisaoPlano
        userId="usuario"
        clienteId={clienteId}
        plano={{ ...plano, revisao: 5 }}
        bloqueado={false}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/Plano mudou/i);
  expect(screen.getByRole("button", { name: "Confirmar início da revisão" })).toBeDisabled();
  expect(api.iniciarRevisao).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: "Iniciar revisão de Preventivo" })).toBeEnabled();
});

it("não habilita aprovação da revisão com preflight desligado", () => {
  vi.stubEnv("VITE_SSO_APROVAR_REVISAO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_PREFLIGHT_APROVACAO_REVISAO_ENABLED", "false");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const plano = { id: "16500000-0000-4000-8000-000000000011", clienteId, nome: "Preventivo", estado: "em_revisao" as const, revisao: 3 };
  render(<QueryClientProvider client={client}><AcoesRevisaoPlano userId="usuario" clienteId={clienteId} plano={plano} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Aprovar revisão de versão" }));
  expect(screen.getByRole("button", { name: "Confirmar aprovação" })).toBeDisabled();
  expect(screen.getByText(/bloqueada até comprovar integralmente os impactos/i)).toBeTruthy();
  vi.unstubAllEnvs();
});

it("solicita vigência e apresenta avisos após aprovação", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const rotinaId = "16500000-0000-4000-8000-000000000081";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 3 },
  ]);
  api.aprovarPlano.mockResolvedValue({ warnings: [{ rotinaId, pendencias: ["tempo_a_validar"] }] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Aprovar Preventivo" }));
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
  expect(await screen.findByText(/tempo a validar/i)).toBeTruthy();
  expect(api.aprovarPlano).toHaveBeenCalledWith(
    expect.objectContaining({ planoId, expectedRevision: 3, vigencia: "2026-11-01" }),
  );
});

it("explica que segunda aprovação está bloqueada quando servidor recusa vigência insegura", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 3 },
  ]);
  api.aprovarPlano.mockRejectedValue({ code: "23514", message: "revisao_sem_vigencia_segura" });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Aprovar Preventivo" }));
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
  expect(await screen.findByText(/aprovação de nova versão está bloqueada/i)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Tentar operação de Preventivo novamente" }),
  ).toBeNull();
});

it("mostra pendências retornadas na recusa e não repete aprovação rejeitada", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const rotinaId = "16500000-0000-4000-8000-000000000081";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 3 },
  ]);
  api.aprovarPlano.mockRejectedValue({
    code: "23514",
    details: JSON.stringify([{ rotinaId, pendencias: ["data_base"] }]),
  });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Aprovar Preventivo" }));
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
  expect(await screen.findByText(/data-base não informada/i)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Tentar operação de Preventivo novamente" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Devolver Preventivo para rascunho" })).toBeTruthy();
});

it("impede envio para revisão enquanto formulário de Rotina está aberto", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([]);
  api.listarAlvos.mockResolvedValue([]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Nova Rotina" }));
  expect(
    screen.getByRole("button", { name: "Enviar Preventivo para revisão" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(
    screen.getByRole("button", { name: "Enviar Preventivo para revisão" }).hasAttribute("disabled"),
  ).toBe(false);
});

it("não inicia novo Plano enquanto uma Rotina está em edição", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  api.listarVersoes.mockResolvedValue([]);
  api.listarAlvos.mockResolvedValue([]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Nova Rotina" }));
  expect(screen.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: "Novo Plano de Manutenção" })).toBeEnabled();
});

it("não envia revisão com salvamento de Rotina ainda incerto", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  sessionStorage.setItem(`sso-rotina-nova:usuario:${clienteId}:${planoId}`, "operação pendente");
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Preventivo para revisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para revisão" }));
  expect(await screen.findByText(/resolva o salvamento pendente da Rotina/i)).toBeTruthy();
  expect(api.transicionarRevisao).not.toHaveBeenCalled();
});

it("não sobrescreve operação de revisão surgida após abrir a confirmação", async () => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  const chave = `sso-plano-revisao:usuario:${clienteId}:${planoId}`;
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 },
  ]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Preventivo para revisão" }));
  sessionStorage.setItem(chave, "pedido anterior ainda incerto");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para revisão" }));
  expect(await screen.findByText(/operação pendente/i)).toBeTruthy();
  expect(api.transicionarRevisao).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(chave)).toBe("pedido anterior ainda incerto");
});

it.each(["22023", "23514", "40001"])("preserva submissão incerta quando retry retorna %s", async (code) => {
  const planoId = "16500000-0000-4000-8000-000000000011";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([{ id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 3 }]);
  api.transicionarRevisao.mockRejectedValueOnce(new Error("rede")).mockRejectedValueOnce({ code }).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Preventivo para revisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para revisão" }));
  await screen.findByText(/não foi possível confirmar a operação/i);
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação de Preventivo novamente" }));
  await waitFor(() => expect(api.transicionarRevisao).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Tentar operação de Preventivo novamente" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação de Preventivo novamente" }));
  await waitFor(() => expect(api.transicionarRevisao).toHaveBeenCalledTimes(3));
  expect(api.transicionarRevisao.mock.calls[0]?.[0]).toEqual(api.transicionarRevisao.mock.calls[2]?.[0]);
});
