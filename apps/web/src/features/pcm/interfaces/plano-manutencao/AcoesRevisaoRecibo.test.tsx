// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AprovarPlanoCommand } from "../../application/plano-manutencao-gateway";

const api = vi.hoisted(() => ({ aprovar: vi.fn(), iniciar: vi.fn(), transicionar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  aprovarRevisaoPreparada: api.aprovar,
  supabasePlanoManutencaoAdapter: { iniciarRevisao: api.iniciar, transicionarRevisao: api.transicionar },
}));
import { AcoesRevisaoPlano } from "./AcoesRevisaoPlano";

const clienteId = "16500000-0000-4000-8000-00000000000a";
const planoId = "16500000-0000-4000-8000-000000000011";
const versaoId = "16500000-0000-4000-8000-000000000012";
const outroId = "16500000-0000-4000-8000-000000000013";
const chave = `sso-plano-revisao:usuario:${clienteId}:${planoId}`;
const recibo = (c: AprovarPlanoCommand) => ({
  requestId: c.requestId, aggregateId: c.planoId, revision: c.expectedRevision + 1,
  state: "aprovado", created: false, linkedIds: { clienteId, versaoId }, warnings: [],
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

function iniciar() {
  vi.stubEnv("VITE_SSO_APROVAR_REVISAO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED", "true");
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <AcoesRevisaoPlano userId="usuario" clienteId={clienteId}
      plano={{ id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 3 }} bloqueado={false} />
  </QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Aprovar revisão de versão" }));
  fireEvent.change(screen.getByLabelText("Início da vigência"), { target: { value: "2026-11-06" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
}

it.each(["pedido", "plano", "estado", "revisao", "cliente", "versao"] as const)(
  "preserva aprovação quando o recibo diverge em %s e repete o mesmo pedido",
  async (campo) => {
    api.aprovar.mockImplementationOnce(async (c: AprovarPlanoCommand) => {
      const r = recibo(c);
      if (campo === "pedido") r.requestId = outroId;
      if (campo === "plano") r.aggregateId = outroId;
      if (campo === "estado") r.state = "em_revisao";
      if (campo === "revisao") r.revision += 1;
      if (campo === "cliente") r.linkedIds.clienteId = outroId;
      if (campo === "versao") r.linkedIds.versaoId = "inválida";
      return r;
    }).mockImplementation(async (c: AprovarPlanoCommand) => recibo(c));
    iniciar();
    await screen.findByText(/Não foi possível confirmar a operação/);
    const pendente = sessionStorage.getItem(chave);
    expect(pendente).not.toBeNull();
    const primeira = api.aprovar.mock.calls[0];
    if (!primeira) throw new Error("Aprovação não foi enviada");
    fireEvent.click(screen.getByRole("button", { name: /Tentar operação de Preventivo novamente/ }));
    await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
    expect(api.aprovar).toHaveBeenCalledTimes(2);
    const repeticao = api.aprovar.mock.calls[1];
    if (!repeticao) throw new Error("Repetição não foi enviada");
    expect(repeticao[0]).toEqual(primeira[0]);
  },
);


it.each(["inicio", "submeter", "devolver"].flatMap(modo => ["requestId", "aggregateId", "revision", "state", "created", "clienteId", ...(modo === "inicio" ? ["versaoId"] : [])].map(campo => ({modo, campo}))))("preserva recibo divergente em $campo e repete $modo", async ({modo, campo}) => {
  const requestId = "16500000-0000-4000-8000-000000000014";
  const comando = modo === "inicio"
    ? { requestId, expectedRevision: 3, planoId, novaVersaoId: versaoId }
    : { requestId, expectedRevision: 3, planoId, acao: modo };
  const pedido = { tipo: modo === "inicio" ? "inicio" : "transicao", comando };
  const retorno = {
    requestId, aggregateId: planoId, revision: 4,
    state: modo === "submeter" ? "em_revisao" : "rascunho",
    created: modo === "inicio", linkedIds: { clienteId, ...(modo === "inicio" ? { versaoId } : {}) }, warnings: [],
  };
  const funcao = modo === "inicio" ? api.iniciar : api.transicionar;
  const divergente = { ...retorno, linkedIds: { ...retorno.linkedIds } };
  if (campo === "requestId") divergente.requestId = outroId;
  if (campo === "aggregateId") divergente.aggregateId = outroId;
  if (campo === "revision") divergente.revision++;
  if (campo === "state") divergente.state = "encerrado";
  if (campo === "created") divergente.created = !divergente.created;
  if (campo === "clienteId") divergente.linkedIds.clienteId = outroId;
  if (campo === "versaoId") divergente.linkedIds.versaoId = outroId;
  funcao.mockResolvedValueOnce(divergente).mockResolvedValueOnce(retorno);
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>
    <AcoesRevisaoPlano userId="usuario" clienteId={clienteId} plano={{id:planoId,clienteId,nome:"Preventivo",estado:"rascunho",revisao:3}} bloqueado={false}/>
  </QueryClientProvider>);
  const repetir = screen.getByRole("button", {name:/Tentar operação de Preventivo novamente/});
  fireEvent.click(repetir);
  await screen.findByText(/Não foi possível confirmar a operação/);
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  await waitFor(()=>expect(repetir).toBeEnabled()); fireEvent.click(repetir);
  await waitFor(()=>expect(sessionStorage.getItem(chave)).toBeNull());
  expect(funcao).toHaveBeenCalledTimes(2);
  expect(funcao.mock.calls[0]?.[0]).toEqual(comando);
  expect(funcao.mock.calls[1]?.[0]).toEqual(comando);
});
