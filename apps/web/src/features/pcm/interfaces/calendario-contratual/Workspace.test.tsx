// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser } },
  supabaseUrl: "http://127.0.0.1:1",
}));
const api = vi.hoisted(() => ({
  autorizarAcao: vi.fn(),
  listarContratos: vi.fn(),
  listarRegras: vi.fn(),
  criarRegra: vi.fn(),
  getUser: vi.fn(),
  rejeicao: vi.fn(),
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: api,
}));
vi.mock("../../infrastructure/supabase-calendario-contratual-adapter", () => ({
  supabaseCalendarioContratualAdapter: api,
  rejeicaoInicialRegraComprovada: api.rejeicao,
}));
vi.mock("./FeriadosDeclarados", () => ({ FeriadosDeclarados: () => null }));
import { CalendarioContratualWorkspace } from "./Workspace";
const clienteId = "16600000-0000-4000-8000-00000000000a";
const contratoId = "16600000-0000-4000-8000-000000000051";
it("simula a regra carregada na tela sem gravar nenhuma alteração", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([]);
  api.listarRegras.mockResolvedValue([
    {
      id: "regra",
      contratoId,
      ancoraSemana: "2026-10-05",
      diaSemana: 5,
      horaInicio: "08:00",
      intervaloSemanas: 1,
      duracaoMinutos: 120,
      vigenciaInicio: "2026-10-01",
      vigenciaFim: null,
      numero: 1,
    },
  ]);
  montar();
  const abrir = await screen.findByRole("button", { name: "Simular regra" });
  expect(abrir.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(abrir);
  expect(
    screen.getByRole("button", { name: "Fechar simulação" }).getAttribute("aria-expanded"),
  ).toBe("true");
  fireEvent.change(screen.getByLabelText("Início da simulação"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-11" } });
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByText("2026-10-09")).toBeTruthy();
  expect(api.criarRegra).not.toHaveBeenCalled();
});
function montar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CalendarioContratualWorkspace
        userId="usuario"
        clienteId={clienteId}
        clienteNome="Guainumbi"
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  api.getUser.mockResolvedValue({data:{user:{id:"usuario"}},error:null});
  api.rejeicao.mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it("exibe âncora, fuso e deslocamento da versão consultada", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([]);
  api.listarRegras.mockResolvedValue([
    {
      id: "regra-1",
      serieId: "serie-1",
      contratoId,
      numero: 2,
      ancoraSemana: "2026-10-05",
      diaSemana: 5,
      intervaloSemanas: 2,
      horaInicio: "08:00",
      duracaoMinutos: 120,
      deslocamentoMinutos: 45,
      fuso: "America/Sao_Paulo",
      vigenciaInicio: "2026-10-01",
      vigenciaFim: null,
    },
  ]);
  montar();
  expect(await screen.findByText(/referência 2026-10-05/)).toBeTruthy();
  expect(screen.getByText(/America\/Sao_Paulo/)).toBeTruthy();
  expect(screen.getByText(/deslocamento 45 min/i)).toBeTruthy();
  expect(api.criarRegra).not.toHaveBeenCalled();
});
it("oferece simulação parcial a partir de uma regra consultada", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([]);
  api.listarRegras.mockResolvedValue([
    {
      id: "regra-1",
      serieId: "serie-1",
      contratoId,
      numero: 1,
      ancoraSemana: "2026-10-05",
      diaSemana: 5,
      intervaloSemanas: 1,
      horaInicio: "08:00",
      duracaoMinutos: 120,
      deslocamentoMinutos: 0,
      fuso: "America/Sao_Paulo",
      vigenciaInicio: "2026-10-01",
      vigenciaFim: null,
    },
  ]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Simular regra" }));
  fireEvent.change(screen.getByLabelText("Início da simulação"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-11" } });
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByText("2026-10-09")).toBeTruthy();
  expect(screen.getByText(/não consulta feriados oficiais/i)).toBeTruthy();
  expect(api.criarRegra).not.toHaveBeenCalled();
});
it("não consulta contratos ou regras sem permissão", async () => {
  api.autorizarAcao.mockResolvedValue(false);
  montar();
  expect(await screen.findByText(/sem permissão/i)).toBeTruthy();
  expect(api.listarContratos).not.toHaveBeenCalled();
  expect(api.listarRegras).not.toHaveBeenCalled();
});
it("salva regra e recupera pedido idêntico após falha incerta", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([
    {
      id: contratoId,
      tipo: "volante",
      status: "ativo",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRegras.mockResolvedValue([]);
  api.criarRegra
    .mockRejectedValueOnce(new Error("rede"))
    .mockResolvedValueOnce({ revision: 1, warnings: [] });
  const tela = montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova regra contratual" }));
  fireEvent.change(await screen.findByLabelText("Contrato"), { target: { value: contratoId } });
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("Segunda-feira de referência"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Dia contratual"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Horário de início"), { target: { value: "08:00" } });
  fireEvent.change(screen.getByLabelText("Duração em minutos"), { target: { value: "120" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar regra" }));
  expect(await screen.findByText(/não foi possível confirmar/i)).toBeTruthy();
  tela.unmount();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Tentar salvar regra novamente" }));
  await waitFor(() => expect(api.criarRegra).toHaveBeenCalledTimes(2));
  expect(api.criarRegra.mock.calls[0]?.[0]).toEqual(api.criarRegra.mock.calls[1]?.[0]);
  expect(api.criarRegra.mock.calls[0]?.[0]).toMatchObject({
    clienteId,
    contratoId,
    diaSemana: 5,
    expectedRevision: 0,
  });
});

it("troca de Cliente fecha edição anterior e consulta novo escopo", async () => {
  const outroCliente = "16600000-0000-4000-8000-00000000000b";
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([]);
  api.listarRegras.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const app = (id: string) => (
    <QueryClientProvider client={client}>
      <CalendarioContratualWorkspace
        userId="usuario"
        clienteId={id}
        clienteNome={id === clienteId ? "A" : "B"}
      />
    </QueryClientProvider>
  );
  const tela = render(app(clienteId));
  fireEvent.click(await screen.findByRole("button", { name: "Nova regra contratual" }));
  expect(screen.getByLabelText("Contrato")).toBeTruthy();
  tela.rerender(app(outroCliente));
  await screen.findByText(/Regras de B/);
  expect(screen.queryByLabelText("Contrato")).toBeNull();
  await waitFor(() =>
    expect(api.listarRegras).toHaveBeenCalledWith(outroCliente, 20, null, expect.any(AbortSignal)),
  );
});

it("impede envios simultâneos de uma mesma regra antes da atualização da tela", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([
    {
      id: contratoId,
      tipo: "volante",
      status: "ativo",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRegras.mockResolvedValue([]);
  let concluir!: (valor: { revision: number; warnings: string[] }) => void;
  api.criarRegra.mockImplementation(
    () =>
      new Promise((resolve) => {
        concluir = resolve;
      }),
  );
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova regra contratual" }));
  await screen.findByText(/volante — ativo/);
  fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: contratoId } });
  fireEvent.change(screen.getByLabelText("Início da vigência"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("Segunda-feira de referência"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Dia contratual"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Horário de início"), { target: { value: "08:00" } });
  fireEvent.change(screen.getByLabelText("Duração em minutos"), { target: { value: "120" } });
  const formulario = screen.getByRole("button", { name: "Salvar regra" }).closest("form");
  if (!formulario) throw new Error("Formulário não encontrado.");
  act(() => {
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
  });
  await waitFor(() => expect(api.criarRegra).toHaveBeenCalledTimes(1));
  await act(async () => concluir({ revision: 1, warnings: [] }));
  expect(await screen.findByText(/Regra contratual cadastrada/)).toBeTruthy();
});

it("oculta dados anteriores e bloqueia seleção e salvamento durante reconsulta e erro", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValueOnce([
    {
      id: contratoId,
      tipo: "volante",
      status: "ativo",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRegras.mockResolvedValueOnce([
    {
      id: "regra",
      contratoId,
      diaSemana: 5,
      horaInicio: "08:00",
      intervaloSemanas: 1,
      duracaoMinutos: 120,
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
      numero: 1,
    },
  ]);
  let rejeitarContratos!: (erro: Error) => void;
  let rejeitarRegras!: (erro: Error) => void;
  api.listarContratos.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejeitarContratos = reject;
      }),
  );
  api.listarRegras.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejeitarRegras = reject;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CalendarioContratualWorkspace
        userId="usuario"
        clienteId={clienteId}
        clienteNome="Guainumbi"
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Nova regra contratual" }));
  await screen.findByText(/volante — ativo/);
  await screen.findByText(/Sexta às 08:00/);
  fireEvent.change(screen.getByLabelText("Contrato"), { target: { value: contratoId } });
  act(() => {
    void client.invalidateQueries({
      queryKey: ["calendario-contratual", "usuario", clienteId, "contratos"],
    });
    void client.invalidateQueries({
      queryKey: ["calendario-contratual", "usuario", clienteId, "regras"],
    });
  });
  await waitFor(() => expect(rejeitarContratos).toBeTypeOf("function"));
  expect(screen.queryByText(/volante — ativo/)).toBeNull();
  expect(screen.queryByText(/Sexta às 08:00/)).toBeNull();
  expect((screen.getByLabelText("Contrato") as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  await act(async () => {
    rejeitarContratos(new Error("rede"));
    rejeitarRegras(new Error("rede"));
  });
  expect(await screen.findByText(/Não foi possível carregar contratos/)).toBeTruthy();
  expect(screen.queryByText(/volante — ativo/)).toBeNull();
  expect(screen.queryByText(/Sexta às 08:00/)).toBeNull();
  expect((screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  api.listarContratos.mockResolvedValueOnce([
    {
      id: contratoId,
      tipo: "volante",
      status: "ativo",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
    },
  ]);
  api.listarRegras.mockResolvedValueOnce([
    {
      id: "regra",
      contratoId,
      diaSemana: 5,
      horaInicio: "08:00",
      intervaloSemanas: 1,
      duracaoMinutos: 120,
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
      numero: 1,
    },
  ]);
  for (const botao of screen.getAllByRole("button", { name: "Tentar novamente" }))
    fireEvent.click(botao);
  await screen.findByText(/volante — ativo/);
  await screen.findByText(/Sexta às 08:00/);
  expect((screen.getByLabelText("Contrato") as HTMLSelectElement).value).toBe(contratoId);
  expect((screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});

async function preencherRegraParaTeste() {
  api.autorizarAcao.mockResolvedValue(true);
  api.listarContratos.mockResolvedValue([{id:contratoId,tipo:"volante",status:"ativo",vigenciaInicio:"2026-01-01",vigenciaFim:null}]);
  api.listarRegras.mockResolvedValue([]);
  const tela=montar();
  fireEvent.click(await screen.findByRole("button",{name:"Nova regra contratual"}));
  fireEvent.change(await screen.findByLabelText("Contrato"),{target:{value:contratoId}});
  fireEvent.change(screen.getByLabelText("Início da vigência"),{target:{value:"2026-10-01"}});
  fireEvent.change(screen.getByLabelText("Segunda-feira de referência"),{target:{value:"2026-10-05"}});
  fireEvent.change(screen.getByLabelText("Dia contratual"),{target:{value:"5"}});
  fireEvent.change(screen.getByLabelText("Horário de início"),{target:{value:"08:00"}});
  fireEvent.change(screen.getByLabelText("Duração em minutos"),{target:{value:"120"}});
  return tela;
}
it("primeira rejeição marcada libera edição após confirmar sessão e tentativa",async()=>{
  const erro={code:"22023"};api.rejeicao.mockImplementation((e:unknown)=>e===erro);api.criarRegra.mockRejectedValueOnce(erro);
  await preencherRegraParaTeste();fireEvent.click(screen.getByRole("button",{name:"Salvar regra"}));
  await screen.findByText(/regra foi recusada/i);
  expect(sessionStorage.getItem(`sso-calendario-pendente:usuario:${clienteId}`)).toBeNull();
  expect(screen.getByLabelText("Contrato")).toBeEnabled();
});
it("rejeição marcada após replay preserva tentativa incerta",async()=>{
  const erro={code:"22023"};api.rejeicao.mockImplementation((e:unknown)=>e===erro);
  api.criarRegra.mockRejectedValueOnce(new Error("rede")).mockRejectedValueOnce(erro);
  await preencherRegraParaTeste();fireEvent.click(screen.getByRole("button",{name:"Salvar regra"}));
  const repetir=await screen.findByRole("button",{name:"Tentar salvar regra novamente"});
  const chave=`sso-calendario-pendente:usuario:${clienteId}`, salvo=sessionStorage.getItem(chave);
  await waitFor(()=>expect(repetir).toBeEnabled());fireEvent.click(repetir);
  await waitFor(()=>expect(api.criarRegra).toHaveBeenCalledTimes(2));
  expect(sessionStorage.getItem(chave)).toBe(salvo);expect(api.criarRegra.mock.calls[1]).toEqual(api.criarRegra.mock.calls[0]);
});
it("erro genérico com mesmo código não é considerado rejeição comprovada",async()=>{
  api.criarRegra.mockRejectedValueOnce({code:"22023"});
  await preencherRegraParaTeste();fireEvent.click(screen.getByRole("button",{name:"Salvar regra"}));
  await screen.findByText(/não foi possível confirmar/i);
  expect(sessionStorage.getItem(`sso-calendario-pendente:usuario:${clienteId}`)).not.toBeNull();
});
it("sessão alterada após rejeição marcada preserva pedido",async()=>{
  const erro={code:"22023"};api.rejeicao.mockImplementation((e:unknown)=>e===erro);
  api.criarRegra.mockImplementation(async()=>{api.getUser.mockResolvedValue({data:{user:{id:"outra"}},error:null});throw erro;});
  await preencherRegraParaTeste();fireEvent.click(screen.getByRole("button",{name:"Salvar regra"}));
  await screen.findByText(/não foi possível confirmar/i);
  expect(sessionStorage.getItem(`sso-calendario-pendente:usuario:${clienteId}`)).not.toBeNull();
});
it("desmontagem durante envio preserva pedido confirmado",async()=>{
  let concluir:(v:{revision:number;warnings:string[]})=>void=()=>{throw new Error("envio ausente");};
  api.criarRegra.mockImplementation(()=>new Promise((resolve)=>{concluir=resolve;}));
  const tela=await preencherRegraParaTeste();fireEvent.click(screen.getByRole("button",{name:"Salvar regra"}));
  await waitFor(()=>expect(api.criarRegra).toHaveBeenCalledTimes(1));
  const chave=`sso-calendario-pendente:usuario:${clienteId}`,salvo=sessionStorage.getItem(chave);tela.unmount();
  await act(async()=>{concluir({revision:1,warnings:[]});});
  expect(sessionStorage.getItem(chave)).toBe(salvo);
});
