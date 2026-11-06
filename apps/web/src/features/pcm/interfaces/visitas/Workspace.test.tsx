// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ autorizarAcao: vi.fn(), listar: vi.fn(), detalhar: vi.fn(), listarOs: vi.fn(), listarEquipe: vi.fn(), conferirCiencia: vi.fn(), planejar: vi.fn(), confirmar: vi.fn(), registrarCiencia: vi.fn(), criar: vi.fn(), selecionarOs: vi.fn(), selecionarFuncionarios: vi.fn(), selecionarPosicoes: vi.fn(), associarOs: vi.fn(), adicionarMembro: vi.fn(), editar: vi.fn(), encerrarMembro: vi.fn(), desvincularOs: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "17100000-0000-4000-8000-000000000001" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({ supabaseCapacidadesSsoAdapter: api }));
vi.mock("../../infrastructure/supabase-visitas-adapter", () => ({ supabaseVisitasAdapter: api }));
import { VisitasWorkspace } from "./Workspace";
import { AcoesVisita } from "./AcoesVisita";

const clienteId = "17100000-0000-4000-8000-00000000000a";
const visitaId = "17100000-0000-4000-8000-000000000064";
const usuarioId = "17100000-0000-4000-8000-000000000001";
const resumo = { id: visitaId, clienteId, inicioEm: "2026-11-02T11:00:00Z", fimEm: "2026-11-02T13:00:00Z",
  fuso: "America/Sao_Paulo", natureza: "extra", estado: "planejada", revisao: 3, responsavelId: null };
function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); sessionStorage.clear(); });

it("não consulta Visitas sem permissão para o Cliente", async () => {
  api.autorizarAcao.mockResolvedValue(false);
  montar();
  expect(await screen.findByText(/sem permissão para consultar Visitas/i)).toBeTruthy();
  expect(api.listar).not.toHaveBeenCalled();
});

it("mostra lista e abre composição da Visita selecionada", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([{ id: "os-vinculo", osId: "os", numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", sequencia: 1, estimativaMinutos: 30, criadoEm: "2026-10-01T10:00:00Z", encerradoEm: null, encerradoPor: null, encerramentoMotivo: null }]);
  api.listarEquipe.mockResolvedValue([{ id: "membro", funcionarioId: "pessoa", nome: "Ana", papel: "Técnica", estimativaMinutos: 30, criadoEm: "2026-10-01T10:00:00Z", encerradoEm: null, encerradoPor: null, encerramentoMotivo: null }]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  expect(await screen.findByText(/OS-1/)).toBeTruthy();
  expect(await screen.findByText(/Ana/)).toBeTruthy();
  expect(api.detalhar).toHaveBeenCalledWith(clienteId, visitaId, expect.any(AbortSignal));
  expect(api.listarOs).toHaveBeenCalledWith(expect.objectContaining({ clienteId, visitaId, incluirHistorico: false }), expect.any(AbortSignal));
});

it("não apresenta ciência anterior como atual durante reconsulta ou após falha", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 0, quantidadeEquipe: 0 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValueOnce({ situacao: "ciencia_conferida", autorizaEnvio: false });
  let recusar!: (erro: unknown) => void;
  api.conferirCiencia.mockImplementationOnce(() => new Promise((_resolve, reject) => { recusar = reject; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  expect(await screen.findByText(/ciência do Cliente registrada/i)).toBeTruthy();
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, "detalhe", visitaId, "ciencia"] }); });
  expect(await screen.findByText(/conferindo ciência/i)).toBeTruthy();
  expect(screen.queryByText(/ciência do Cliente registrada/i)).toBeNull();
  await act(async () => { recusar(new Error("rede")); });
  expect(await screen.findByText(/não foi possível conferir a ciência/i)).toBeTruthy();
  expect(screen.queryByText(/ciência do Cliente registrada/i)).toBeNull();
});

it.each([
  { tipo: "os", dado: "OS-1", erro: /não foi possível carregar OS/i },
  { tipo: "equipe", dado: "Ana", erro: /não foi possível carregar equipe/i },
])("oculta dados anteriores de $tipo durante reconsulta e após recusa", async ({ tipo, dado, erro }) => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([{ id: "v", osId: "os", numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", sequencia: 1 }]);
  api.listarEquipe.mockResolvedValue([{ id: "p", nome: "Ana", papel: "Técnica", estimativaMinutos: 30 }]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  expect(await screen.findByText(new RegExp(dado))).toBeTruthy();
  let recusar!: (erro: unknown) => void;
  (tipo === "os" ? api.listarOs : api.listarEquipe).mockImplementationOnce(() => new Promise((_resolve, reject) => { recusar = reject; }));
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, "detalhe", visitaId, tipo] }); });
  await waitFor(() => expect(screen.queryByText(new RegExp(dado))).toBeNull());
  await act(async () => { recusar({ code: "42501" }); });
  expect(await screen.findByText(erro)).toBeTruthy();
  expect(screen.queryByText(new RegExp(dado))).toBeNull();
});

it("apresenta erro recuperável sem confundir com lista vazia", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce([]);
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar Visitas/i);
  fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
  await waitFor(() => expect(screen.getByText(/nenhuma Visita neste período/i)).toBeTruthy());
});

it("oculta Visitas antigas durante reconsulta e após falha, recuperando na nova tentativa", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockResolvedValueOnce([resumo]);
  let recusar!: (erro: unknown) => void;
  api.listar.mockImplementationOnce(() => new Promise((_resolve, reject) => { recusar = reject; }));
  api.listar.mockResolvedValueOnce([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
  expect(await screen.findByRole("button", { name: /abrir visita/i })).toBeTruthy();
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, "lista"] }); });
  await waitFor(() => expect(api.listar).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("button", { name: /abrir visita/i })).toBeNull();
  await act(async () => { recusar(new Error("rede")); });
  expect(await screen.findByText(/não foi possível carregar Visitas/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /abrir visita/i })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
  expect(await screen.findByText(/nenhuma Visita neste período/i)).toBeTruthy();
});

it("oculta detalhe aberto após recusa de leitura e preserva formulário até nova consulta", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockResolvedValueOnce([resumo]).mockRejectedValueOnce({ code: "42501" }).mockResolvedValueOnce([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 0, quantidadeEquipe: 0 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Editar programação" }));
  fireEvent.change(screen.getByLabelText("Deslocamento em minutos"), { target: { value: "45" } });
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, "lista"] }); });
  expect(await screen.findByText(/não foi possível carregar Visitas/i)).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Detalhe da Visita" })).toBeNull();
  expect(api.editar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
  expect(await screen.findByRole("region", { name: "Detalhe da Visita" })).toBeVisible();
  expect(screen.getByLabelText("Deslocamento em minutos")).toHaveValue(45);
});

it("oculta dados do detalhe quando sua própria reconsulta é recusada", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  const dados = { ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 0, quantidadeEquipe: 0 };
  api.detalhar.mockResolvedValueOnce(dados).mockRejectedValueOnce({ code: "42501" }).mockResolvedValueOnce(dados);
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Editar programação" }));
  fireEvent.change(screen.getByLabelText("Deslocamento em minutos"), { target: { value: "45" } });
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, "detalhe", visitaId, "dados"] }); });
  expect(await screen.findByText(/não foi possível carregar o detalhe/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Salvar programação" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
  expect(await screen.findByRole("button", { name: "Salvar programação" })).toBeEnabled();
  expect(screen.getByLabelText("Deslocamento em minutos")).toHaveValue(45);
});

it("troca de Cliente fecha detalhe anterior e não exibe dados do Cliente anterior", async () => {
  const outroCliente = "17100000-0000-4000-8000-00000000000b";
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockImplementation(async (consulta: { clienteId: string }) => consulta.clienteId === clienteId ? [resumo] : []);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 0, quantidadeEquipe: 0 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { rerender } = render(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={clienteId} clienteNome="Guainumbi" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  expect(await screen.findByRole("region", { name: "Detalhe da Visita" })).toBeTruthy();
  rerender(<QueryClientProvider client={client}><VisitasWorkspace userId={usuarioId} clienteId={outroCliente} clienteNome="Outro" /></QueryClientProvider>);
  expect(await screen.findByText(/nenhuma Visita neste período/i)).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Detalhe da Visita" })).toBeNull();
  expect(screen.queryByRole("button", { name: /abrir visita/i })).toBeNull();
});

it("confirma PCM após escolha explícita e recupera resultado incerto com mesmo pedido", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.confirmar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar Visita" }));
  expect(api.confirmar).not.toHaveBeenCalled();
  expect(screen.getByText(/não envia tarefas ao Auvo/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão PCM" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.confirmar).toHaveBeenCalledTimes(2));
  expect(api.confirmar.mock.calls[0]?.[0]).toEqual(api.confirmar.mock.calls[1]?.[0]);
  expect(api.confirmar.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3 });
});

it("oferece planejamento de rascunho sem confirmar ou enviar", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockResolvedValue([{ ...resumo, estado: "rascunho" }]);
  api.detalhar.mockResolvedValue({ ...resumo, estado: "rascunho", contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 0, quantidadeEquipe: 0 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.planejar.mockResolvedValue({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Planejar Visita" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar planejamento" }));
  await waitFor(() => expect(api.planejar).toHaveBeenCalledWith(expect.objectContaining({ visitaId, expectedRevision: 3 })));
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("registra ciência completa e repete o mesmo pedido após falha de conexão", async () => {
  api.autorizarAcao.mockResolvedValue(true);
  api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.registrarCiencia.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Registrar ciência do Cliente" }));
  fireEvent.change(screen.getByLabelText("Data e hora da ciência"), { target: { value: "2026-10-20T09:00" } });
  fireEvent.change(screen.getByLabelText("Responsável do Cliente"), { target: { value: "Síndica" } });
  fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "Telefone" } });
  fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Ciente da programação" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar ciência" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.registrarCiencia).toHaveBeenCalledTimes(2));
  expect(api.registrarCiencia.mock.calls[0]?.[0]).toEqual(api.registrarCiencia.mock.calls[1]?.[0]);
  expect(api.registrarCiencia.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3, responsavel: "Síndica", canal: "Telefone", observacao: "Ciente da programação" });
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("mantém formulário de ciência ao recusar informação em branco", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Registrar ciência do Cliente" }));
  fireEvent.change(screen.getByLabelText("Data e hora da ciência"), { target: { value: "2026-10-20T09:00" } });
  fireEvent.change(screen.getByLabelText("Responsável do Cliente"), { target: { value: "Síndica" } });
  fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "Telefone" } });
  fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar ciência" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/confira os dados/i);
  expect(screen.getByLabelText("Responsável do Cliente")).toHaveValue("Síndica");
  expect(api.registrarCiencia).not.toHaveBeenCalled();
});

it("cria rascunho e recupera a mesma solicitação após troca de tela", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  api.criar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  const tela = montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova Visita" }));
  fireEvent.change(screen.getByLabelText("Início da Visita"), { target: { value: "2026-11-02T08:00" } });
  fireEvent.change(screen.getByLabelText("Fim da Visita"), { target: { value: "2026-11-02T10:00" } });
  fireEvent.change(screen.getByLabelText("Natureza da Visita"), { target: { value: "extra" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho de Visita" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  tela.unmount();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Tentar criar Visita novamente" }));
  await waitFor(() => expect(api.criar).toHaveBeenCalledTimes(2));
  expect(api.criar.mock.calls[0]?.[0]).toEqual(api.criar.mock.calls[1]?.[0]);
  expect(api.criar.mock.calls[0]?.[0]).toMatchObject({ clienteId, expectedRevision: 0, natureza: "extra",
    inicioEm: new Date("2026-11-02T08:00").toISOString(), fimEm: new Date("2026-11-02T10:00").toISOString() });
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("não cria rascunho com janela invertida", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova Visita" }));
  fireEvent.change(screen.getByLabelText("Início da Visita"), { target: { value: "2026-11-02T10:00" } });
  fireEvent.change(screen.getByLabelText("Fim da Visita"), { target: { value: "2026-11-02T08:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho de Visita" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/confira/i);
  expect(api.criar).not.toHaveBeenCalled();
});

it("bloqueia criação se pedido anterior não puder ser recuperado", async () => {
  sessionStorage.setItem(`sso-visita-criacao:${usuarioId}:${clienteId}`, "registro inválido");
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  montar();
  expect(await screen.findByText(/não foi possível recuperar pedido anterior/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Nova Visita" })).toBeNull();
  expect(api.criar).not.toHaveBeenCalled();
});

it.each(["sucesso", "recusa", "incerto"])("mantém nova criação pendente após resposta antiga: %s", async (resultado) => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  let concluir!: (valor: { warnings: string[] }) => void;
  let recusar!: (erro: unknown) => void;
  api.criar.mockImplementationOnce(() => new Promise((resolve, reject) => { concluir = resolve; recusar = reject; }));
  api.criar.mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova Visita" }));
  fireEvent.change(screen.getByLabelText("Início da Visita"), { target: { value: "2026-11-02T08:00" } });
  fireEvent.change(screen.getByLabelText("Fim da Visita"), { target: { value: "2026-11-02T10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho de Visita" }));
  await waitFor(() => expect(api.criar).toHaveBeenCalledTimes(1));
  const novo = { ...api.criar.mock.calls[0]![0], requestId: "17100000-0000-4000-8000-000000000091", visitaId: "17100000-0000-4000-8000-000000000092" };
  const chave = `sso-visita-criacao:${usuarioId}:${clienteId}`;
  sessionStorage.setItem(chave, JSON.stringify(novo));
  if (resultado === "sucesso") concluir({ warnings: [] });
  else recusar(resultado === "recusa" ? { code: "40001" } : new Error("rede"));
  const repetir = await screen.findByRole("button", { name: "Tentar criar Visita novamente" });
  await waitFor(() => expect(repetir).not.toBeDisabled());
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toEqual(novo);
  fireEvent.click(repetir);
  await waitFor(() => expect(api.criar).toHaveBeenCalledTimes(2));
  expect(api.criar.mock.calls[1]![0]).toEqual(novo);
});

it("confere pedido salvo novamente antes de repetir criação", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  api.criar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova Visita" }));
  fireEvent.change(screen.getByLabelText("Início da Visita"), { target: { value: "2026-11-02T08:00" } });
  fireEvent.change(screen.getByLabelText("Fim da Visita"), { target: { value: "2026-11-02T10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho de Visita" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  const novo = { ...api.criar.mock.calls[0]![0], requestId: "17100000-0000-4000-8000-000000000091", visitaId: "17100000-0000-4000-8000-000000000092" };
  sessionStorage.setItem(`sso-visita-criacao:${usuarioId}:${clienteId}`, JSON.stringify(novo));
  fireEvent.click(screen.getByRole("button", { name: "Tentar criar Visita novamente" }));
  expect(await screen.findByText(/outra criação pendente/i)).toBeTruthy();
  expect(api.criar).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Tentar criar Visita novamente" }));
  await waitFor(() => expect(api.criar).toHaveBeenCalledTimes(2));
  expect(api.criar.mock.calls[1]![0]).toEqual(novo);
});

it("bloqueia criação se pedido salvo ficar inválido durante resposta antiga", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  let concluir!: (valor: { warnings: string[] }) => void;
  api.criar.mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; }));
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova Visita" }));
  fireEvent.change(screen.getByLabelText("Início da Visita"), { target: { value: "2026-11-02T08:00" } });
  fireEvent.change(screen.getByLabelText("Fim da Visita"), { target: { value: "2026-11-02T10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho de Visita" }));
  await waitFor(() => expect(api.criar).toHaveBeenCalledTimes(1));
  sessionStorage.setItem(`sso-visita-criacao:${usuarioId}:${clienteId}`, "inválido");
  concluir({ warnings: [] });
  expect(await screen.findByText(/não foi possível recuperar o pedido/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tentar criar Visita novamente" })).toBeDisabled();
  expect(api.criar).toHaveBeenCalledTimes(1);
});

it("associa OS do Cliente e recupera pedido após falha incerta", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 0, quantidadeEquipe: 0 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const osId = "17100000-0000-4000-8000-000000000051";
  api.selecionarOs.mockResolvedValue([{ id: osId, numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", status: "planejamento" }]);
  api.associarOs.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Adicionar OS" }));
  const campo = await screen.findByLabelText("Ordem de Serviço");
  await screen.findByRole("option", { name: /OS-1/ });
  fireEvent.change(campo, { target: { value: osId } });
  fireEvent.change(screen.getByLabelText("Sequência da OS"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Associar OS" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.associarOs).toHaveBeenCalledTimes(2));
  expect(api.associarOs.mock.calls[0]?.[0]).toEqual(api.associarOs.mock.calls[1]?.[0]);
  expect(api.associarOs.mock.calls[0]?.[0]).toMatchObject({ visitaId, osId, sequencia: 1, expectedRevision: 3 });
});

it("adiciona integrante ativo à equipe com papel e tempo", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 0, quantidadeEquipe: 0 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const funcionarioId = "17100000-0000-4000-8000-000000000041";
  api.selecionarFuncionarios.mockResolvedValue([{ id: funcionarioId, nome: "Ana" }]);
  api.adicionarMembro.mockResolvedValue({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Adicionar pessoa" }));
  await screen.findByRole("option", { name: "Ana" });
  fireEvent.change(screen.getByLabelText("Pessoa da equipe"), { target: { value: funcionarioId } });
  fireEvent.change(screen.getByLabelText("Papel na Visita"), { target: { value: "Técnica" } });
  fireEvent.change(screen.getByLabelText("Tempo estimado da pessoa (minutos)"), { target: { value: "90" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar pessoa" }));
  await waitFor(() => expect(api.adicionarMembro).toHaveBeenCalledWith(expect.objectContaining({ visitaId, funcionarioId, papel: "Técnica", estimativaMinutos: 90, expectedRevision: 3 })));
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("define responsável incluindo integrante existente e preserva dados e pedido após falha", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  const funcionarioId = "17100000-0000-4000-8000-000000000041";
  api.selecionarFuncionarios.mockResolvedValue([{ id: funcionarioId, nome: "Ana" }]);
  api.editar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Definir responsável" }));
  await screen.findByRole("option", { name: "Ana" });
  expect(api.selecionarFuncionarios).toHaveBeenCalledWith(expect.objectContaining({ clienteId, visitaId, excluirVinculados: false }), expect.any(AbortSignal));
  fireEvent.change(screen.getByLabelText("Responsável da Visita"), { target: { value: funcionarioId } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar responsável" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.editar).toHaveBeenCalledTimes(2));
  expect(api.editar.mock.calls[0]?.[0]).toEqual(api.editar.mock.calls[1]?.[0]);
  expect(api.editar.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3, responsavelId: funcionarioId, areaId: null, localId: null, inicioEm: resumo.inicioEm, fimEm: resumo.fimEm, fuso: resumo.fuso, deslocamentoMinutos: 30 });
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("encerra participação com motivo e recupera o mesmo pedido após falha", async () => {
  const participacaoId = "17100000-0000-4000-8000-000000000081";
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([{ id: participacaoId, funcionarioId: "17100000-0000-4000-8000-000000000041", nome: "Ana", papel: "Técnica", estimativaMinutos: 30, criadoEm: "2026-10-01T10:00:00Z", encerradoEm: null, encerradoPor: null, encerramentoMotivo: null }]);
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.encerrarMembro.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Encerrar participação" }));
  await screen.findByRole("option", { name: /Ana/ });
  fireEvent.change(screen.getByLabelText("Participação"), { target: { value: participacaoId } });
  fireEvent.change(screen.getByLabelText("Motivo do encerramento"), { target: { value: "Reprogramação" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar encerramento" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.encerrarMembro).toHaveBeenCalledTimes(2));
  expect(api.encerrarMembro.mock.calls[0]?.[0]).toEqual(api.encerrarMembro.mock.calls[1]?.[0]);
  expect(api.encerrarMembro.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3, participacaoId, motivo: "Reprogramação" });
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("consulta histórico de composição sem confundir vínculos encerrados com vigentes", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.listarOs.mockImplementation(async (q: { incluirHistorico: boolean }) => q.incluirHistorico ? [{ id: "os-antiga", osId: "os", numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", sequencia: 1, estimativaMinutos: 30, criadoEm: "2026-10-01T10:00:00Z", encerradoEm: "2026-10-10T10:00:00Z", encerradoPor: "usuario", encerramentoMotivo: "Alteração" }] : []);
  api.listarEquipe.mockImplementation(async (q: { incluirHistorico: boolean }) => q.incluirHistorico ? [{ id: "membro-antigo", funcionarioId: "pessoa", nome: "Ana", papel: "Técnica", estimativaMinutos: 30, criadoEm: "2026-10-01T10:00:00Z", encerradoEm: "2026-10-10T10:00:00Z", encerradoPor: "usuario", encerramentoMotivo: "Reprogramação" }] : []);
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  expect(await screen.findByText("Nenhuma pessoa vinculada.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar histórico" }));
  expect(await screen.findByText(/Ana.*encerrada.*Reprogramação/i)).toBeTruthy();
  expect(await screen.findByText(/OS-1.*encerrado.*Alteração/i)).toBeTruthy();
  expect(screen.getByText(/nomes e títulos atuais/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar somente vigentes" }));
  expect(await screen.findByText("Nenhuma pessoa vinculada.")).toBeTruthy();
  expect(screen.queryByText(/Ana.*encerrada/i)).toBeNull();
});

it("desvincula OS com motivo e recupera o mesmo pedido após falha", async () => {
  const vinculoId = "17100000-0000-4000-8000-000000000081";
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([{ id: vinculoId, osId: "17100000-0000-4000-8000-000000000051", numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", sequencia: 1, estimativaMinutos: 30, criadoEm: "2026-10-01T10:00:00Z", encerradoEm: null, encerradoPor: null, encerramentoMotivo: null }]);
  api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.desvincularOs.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Desvincular OS" }));
  await screen.findByRole("option", { name: /OS-1/ });
  fireEvent.change(screen.getByLabelText("Vínculo de OS"), { target: { value: vinculoId } });
  fireEvent.change(screen.getByLabelText("Motivo da desvinculação"), { target: { value: "Reprogramação" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar desvinculação" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.desvincularOs).toHaveBeenCalledTimes(2));
  expect(api.desvincularOs.mock.calls[0]?.[0]).toEqual(api.desvincularOs.mock.calls[1]?.[0]);
  expect(api.desvincularOs.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3, vinculoId, motivo: "Reprogramação" });
  expect(api.confirmar).not.toHaveBeenCalled();
});

it("pagina Áreas e permite selecionar uma posição da segunda página", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  const primeiraPagina = Array.from({ length: 20 }, (_, i) => ({ id: `17100000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, nome: `Área ${i + 1}`, areaId: null }));
  const areaId = "17100000-0000-4000-8000-000000000099";
  api.selecionarPosicoes.mockImplementation(async (c: { tipo: string; apos: string | null }) => c.tipo === "local" ? [] : c.apos ? [{ id: areaId, nome: "Área posterior", areaId: null }] : primeiraPagina);
  api.editar.mockResolvedValue({ warnings: [] });
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar posição" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mais Áreas" }));
  await screen.findByRole("option", { name: "Área posterior" });
  expect(api.selecionarPosicoes).toHaveBeenCalledWith(expect.objectContaining({ tipo: "area", apos: primeiraPagina[19]!.id }), expect.any(AbortSignal));
  fireEvent.change(screen.getByLabelText("Área da Visita"), { target: { value: areaId } });
  await screen.findByText("Nenhum Local encontrado.");
  fireEvent.click(screen.getByRole("button", { name: "Salvar posição" }));
  await waitFor(() => expect(api.editar).toHaveBeenCalledWith(expect.objectContaining({ areaId, localId: null })));
});

it("recupera erro de consulta de Área sem salvar posição incompleta", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  api.selecionarPosicoes.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce([]);
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar posição" }));
  expect(await screen.findByText(/não foi possível carregar Áreas/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Salvar posição" })).toBeDisabled();
  expect(api.editar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Nenhuma Área encontrada.")).toBeTruthy();
});

it("busca Área e Local da Visita sem misturar seleções anteriores", async () => {
  const areaId = "17100000-0000-4000-8000-000000000021";
  const localId = "17100000-0000-4000-8000-000000000031";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  api.selecionarPosicoes.mockImplementation(async (c: { tipo: string; busca: string }) => c.tipo === "area" ? [{ id: areaId, nome: "Torre A", areaId: null }] : [{ id: localId, nome: "Casa de máquinas", areaId }]);
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar posição" }));
  fireEvent.change(screen.getByLabelText("Buscar Área"), { target: { value: "Torre" } });
  await waitFor(() => expect(api.selecionarPosicoes).toHaveBeenCalledWith(expect.objectContaining({ tipo: "area", busca: "Torre", clienteId, visitaId }), expect.any(AbortSignal)));
  await screen.findByRole("option", { name: "Torre A" });
  fireEvent.change(screen.getByLabelText("Área da Visita"), { target: { value: areaId } });
  fireEvent.change(screen.getByLabelText("Buscar Local"), { target: { value: "Casa" } });
  await waitFor(() => expect(api.selecionarPosicoes).toHaveBeenCalledWith(expect.objectContaining({ tipo: "local", areaId, busca: "Casa" }), expect.any(AbortSignal)));
  await screen.findByRole("option", { name: "Casa de máquinas" });
  fireEvent.change(screen.getByLabelText("Local da Visita"), { target: { value: localId } });
  fireEvent.change(screen.getByLabelText("Buscar Área"), { target: { value: "Outra" } });
  expect(screen.getByLabelText("Área da Visita")).toHaveValue("");
  expect(screen.queryByLabelText("Local da Visita")).toBeNull();
});

it("edita posição da Visita e repete o mesmo pedido após falha incerta", async () => {
  const areaId = "17100000-0000-4000-8000-000000000021";
  const localId = "17100000-0000-4000-8000-000000000031";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  api.selecionarPosicoes.mockImplementation(async (c: { tipo: string }) => c.tipo === "area" ? [{ id: areaId, nome: "Torre A", areaId: null }] : [{ id: localId, nome: "Casa de máquinas", areaId }]);
  api.editar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar posição" }));
  await screen.findByRole("option", { name: "Torre A" });
  fireEvent.change(screen.getByLabelText("Área da Visita"), { target: { value: areaId } });
  await screen.findByRole("option", { name: "Casa de máquinas" });
  fireEvent.change(screen.getByLabelText("Local da Visita"), { target: { value: localId } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar posição" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.editar).toHaveBeenCalledTimes(2));
  expect(api.editar.mock.calls[0]?.[0]).toEqual(api.editar.mock.calls[1]?.[0]);
  expect(api.editar.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3, areaId, localId, inicioEm: visita.inicioEm, fimEm: visita.fimEm, responsavelId: null, deslocamentoMinutos: 30 });
});

it("edita janela preservando posição, responsável e fuso com retry seguro", async () => {
  const responsavelId = "17100000-0000-4000-8000-000000000041";
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, responsavelId, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.editar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Editar programação" }));
  fireEvent.change(screen.getByLabelText("Novo início da Visita"), { target: { value: "2026-11-03T08:00" } });
  fireEvent.change(screen.getByLabelText("Novo fim da Visita"), { target: { value: "2026-11-03T10:00" } });
  fireEvent.change(screen.getByLabelText("Deslocamento em minutos"), { target: { value: "40" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar programação" }));
  expect(await screen.findByText(/não foi possível confirmar o resultado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.editar).toHaveBeenCalledTimes(2));
  expect(api.editar.mock.calls[0]?.[0]).toEqual(api.editar.mock.calls[1]?.[0]);
  expect(api.editar.mock.calls[0]?.[0]).toMatchObject({ visitaId, expectedRevision: 3, areaId: null, localId: null, responsavelId, fuso: resumo.fuso, deslocamentoMinutos: 40, inicioEm: new Date("2026-11-03T08:00").toISOString(), fimEm: new Date("2026-11-03T10:00").toISOString() });
});

it("preserva e oferece retry de pedido diferente após resposta atrasada da edição", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  let concluir!: (valor: object) => void;
  api.editar.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar programação" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar programação" }));
  await waitFor(() => expect(api.editar).toHaveBeenCalledTimes(1));
  const chave = `sso-visita-operacao:${usuarioId}:${clienteId}:${visitaId}`;
  const outro = JSON.parse(sessionStorage.getItem(chave) as string);
  outro.comando.requestId = "17100000-0000-4000-8000-000000000077";
  sessionStorage.setItem(chave, JSON.stringify(outro));
  concluir({ warnings: [] });
  expect(await screen.findByRole("button", { name: "Tentar operação novamente" })).toBeEnabled();
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(outro));
  expect(screen.queryByRole("button", { name: "Editar programação" })).toBeNull();
});

it("impede salvar formulário aberto quando a revisão da Visita muda", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  const tela = render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar programação" }));
  fireEvent.change(screen.getByLabelText("Deslocamento em minutos"), { target: { value: "40" } });
  tela.rerender(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={{ ...visita, revisao: 4 }} bloqueado={false} /></QueryClientProvider>);
  expect(screen.getByRole("alert")).toHaveTextContent(/Visita mudou/i);
  expect(screen.getByRole("button", { name: "Salvar programação" })).toBeDisabled();
  expect(api.editar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: "Editar programação" })).toBeEnabled();
});

it("não associa OS durante revalidação nem depois de ela ficar indisponível", async () => {
  const osId = "17100000-0000-4000-8000-000000000091";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  let concluir!: (valor: object[]) => void;
  api.selecionarOs.mockResolvedValueOnce([{ id: osId, numero: "OS-1", titulo: "Inspeção", status: "aberta" }]).mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar OS" }));
  await screen.findByRole("option", { name: /OS-1/ });
  fireEvent.change(screen.getByLabelText("Ordem de Serviço"), { target: { value: osId } });
  fireEvent.change(screen.getByLabelText("Sequência da OS"), { target: { value: "1" } });
  void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, visitaId, "selecionar-os"] });
  await waitFor(() => expect(api.selecionarOs).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Associar OS" })).toBeDisabled();
  concluir([]);
  await screen.findByText("Nenhuma OS disponível nesta busca.");
  expect(screen.getByRole("button", { name: "Associar OS" })).toBeDisabled();
  expect(api.associarOs).not.toHaveBeenCalled();
});

it("não adiciona pessoa que deixou de estar disponível durante revalidação", async () => {
  const pessoaId = "17100000-0000-4000-8000-000000000092";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  api.selecionarFuncionarios.mockResolvedValueOnce([{ id: pessoaId, nome: "Ana" }]).mockResolvedValueOnce([]);
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar pessoa" }));
  await screen.findByRole("option", { name: "Ana" });
  fireEvent.change(screen.getByLabelText("Pessoa da equipe"), { target: { value: pessoaId } });
  fireEvent.change(screen.getByLabelText("Papel na Visita"), { target: { value: "Técnica" } });
  await client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, visitaId, "selecionar-pessoas"] });
  expect(await screen.findByText(/seleção deixou de estar disponível/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Salvar pessoa" })).toBeDisabled();
  expect(api.adicionarMembro).not.toHaveBeenCalled();
});

it.each([
  { tipo: "OS", abrir: "Desvincular OS", campo: "Vínculo de OS", opcao: "OS-1 — Inspeção", motivo: "Motivo da desvinculação", confirmar: "Confirmar desvinculação", consulta: "os-para-desvincular", leitura: "listarOs", comando: "desvincularOs", dados: { id: "17100000-0000-4000-8000-000000000091", numero: "OS-1", titulo: "Inspeção", sequencia: 1 } },
  { tipo: "participação", abrir: "Encerrar participação", campo: "Participação", opcao: "Ana — Técnica", motivo: "Motivo do encerramento", confirmar: "Confirmar encerramento", consulta: "equipe-para-encerrar", leitura: "listarEquipe", comando: "encerrarMembro", dados: { id: "17100000-0000-4000-8000-000000000092", nome: "Ana", papel: "Técnica" } },
] as const)("não altera $tipo durante revalidação nem quando vínculo não existe mais", async (caso) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  let concluir!: (valor: object[]) => void;
  api[caso.leitura].mockResolvedValueOnce([caso.dados]).mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: caso.abrir }));
  await screen.findByRole("option", { name: caso.opcao });
  fireEvent.change(screen.getByLabelText(caso.campo), { target: { value: caso.dados.id } });
  fireEvent.change(screen.getByLabelText(caso.motivo), { target: { value: "Reorganização" } });
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, visitaId, caso.consulta] }); });
  await waitFor(() => expect(api[caso.leitura]).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", { name: caso.confirmar })).toBeDisabled());
  fireEvent.submit(screen.getByRole("button", { name: caso.confirmar }).closest("form")!);
  expect(api[caso.comando]).not.toHaveBeenCalled();
  await act(async () => { concluir([]); });
  expect(await screen.findByText(/seleção deixou de estar disponível/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: caso.confirmar })).toBeDisabled();
  fireEvent.submit(screen.getByRole("button", { name: caso.confirmar }).closest("form")!);
  expect(api[caso.comando]).not.toHaveBeenCalled();
});

it.each(["area", "local"] as const)("não salva posição quando %s está em revalidação ou deixou de existir", async (tipo) => {
  const areaId = "17100000-0000-4000-8000-000000000093";
  const localId = "17100000-0000-4000-8000-000000000094";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { ...resumo, natureza: "extra" as const, estado: "planejada" as const, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 };
  let concluir!: (valor: object[]) => void;
  let chamadasTipo = 0;
  api.selecionarPosicoes.mockImplementation((entrada: { tipo: string }) => {
    if (entrada.tipo === tipo && ++chamadasTipo === 2) return new Promise((resolve) => { concluir = resolve; });
    return Promise.resolve(entrada.tipo === "area" ? [{ id: areaId, nome: "Torre A" }] : [{ id: localId, nome: "QGBT" }]);
  });
  render(<QueryClientProvider client={client}><AcoesVisita userId={usuarioId} clienteId={clienteId} visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Editar posição" }));
  await screen.findByRole("option", { name: "Torre A" });
  fireEvent.change(screen.getByLabelText("Área da Visita"), { target: { value: areaId } });
  await screen.findByRole("option", { name: "QGBT" });
  fireEvent.change(screen.getByLabelText("Local da Visita"), { target: { value: localId } });
  act(() => { void client.invalidateQueries({ queryKey: ["visitas", usuarioId, clienteId, visitaId, "posicoes", tipo] }); });
  await waitFor(() => expect(chamadasTipo).toBe(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar posição" })).toBeDisabled());
  fireEvent.submit(screen.getByRole("button", { name: "Salvar posição" }).closest("form")!);
  expect(api.editar).not.toHaveBeenCalled();
  await act(async () => { concluir([]); });
  expect(await screen.findByText(/seleção deixou de estar disponível/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Salvar posição" })).toBeDisabled();
  fireEvent.submit(screen.getByRole("button", { name: "Salvar posição" }).closest("form")!);
  expect(api.editar).not.toHaveBeenCalled();
});

it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== "America/New_York")("recusa horário inexistente na mudança de horário de verão", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 30, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.editar.mockResolvedValue({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Editar programação" }));
  fireEvent.change(screen.getByLabelText("Novo início da Visita"), { target: { value: "2026-03-08T02:30" } });
  fireEvent.change(screen.getByLabelText("Novo fim da Visita"), { target: { value: "2026-03-08T04:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar programação" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/horário/i);
  expect(api.editar).not.toHaveBeenCalled();
});

it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== "America/New_York")("não cria Visita com horário local inexistente", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([]);
  api.criar.mockResolvedValue({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Nova Visita" }));
  fireEvent.change(screen.getByLabelText("Início da Visita"), { target: { value: "2026-03-08T02:30" } });
  fireEvent.change(screen.getByLabelText("Fim da Visita"), { target: { value: "2026-03-08T04:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho de Visita" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/horário/i);
  expect(api.criar).not.toHaveBeenCalled();
});

it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== "America/New_York")("não registra ciência com horário local inexistente", async () => {
  api.autorizarAcao.mockResolvedValue(true); api.listar.mockResolvedValue([resumo]);
  api.detalhar.mockResolvedValue({ ...resumo, contratoId: null, areaId: null, localId: null, deslocamentoMinutos: 0, quantidadeOs: 1, quantidadeEquipe: 1 });
  api.listarOs.mockResolvedValue([]); api.listarEquipe.mockResolvedValue([]); api.conferirCiencia.mockResolvedValue({ situacao: "pendente_pcm", autorizaEnvio: false });
  api.registrarCiencia.mockResolvedValue({ warnings: [] });
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /abrir visita/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Registrar ciência do Cliente" }));
  fireEvent.change(screen.getByLabelText("Data e hora da ciência"), { target: { value: "2026-03-08T02:30" } });
  fireEvent.change(screen.getByLabelText("Responsável do Cliente"), { target: { value: "Síndica" } });
  fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "Telefone" } });
  fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Ciente" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar ciência" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/horário/i);
  expect(api.registrarCiencia).not.toHaveBeenCalled();
});
