// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { NavGuardProvider } from "../../../../app/nav-guard-context";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "16797005-0000-4000-8000-000000000001" } }, error: null }) } },
}));
import { ConversaoIntegral } from "./ConversaoIntegral";

const usuario="16797005-0000-4000-8000-000000000001", cliente="16797005-0000-4000-8000-000000000002", chamado="16797005-0000-4000-8000-000000000003";
const criar=vi.fn(), revisao=vi.fn(async()=>1);
const chamadoCompleto={id:chamado,numero:"CH-1",clienteId:cliente,titulo:"Chamado A",descricao:"Descrição",local:null,origem:"manual" as const,status:"aberto" as const,solicitante:"Pessoa",ordemServicoId:null,cancelamentoJustificativa:null,cancelamentoAnexoPath:null,createdAt:"2026-01-01",dataPlanejada:null,dataExecucao:null,replanejamentos:0,fotoUrls:[]};
const tipo="16797005-0000-4000-8000-000000000004",tecnico="16797005-0000-4000-8000-000000000005";
const equipamento="16797005-0000-4000-8000-000000000006";
const listarEquipamentos=vi.fn(async()=>[{id:equipamento,nome:"Bomba A"}]);
const dadosOs={clientes:[],tecnicos:[{id:tecnico,nome:"Técnico",auvoUserId:1}],tiposTarefa:[{id:tipo,nome:"Tipo",auvoId:1}]};
const props={ habilitado:"true", usuario, cliente, chamado, chamadoEsperado:chamado, chamadoCompleto,dadosOs, criar, consultarRevisao:revisao, listarEquipamentos };
function tela(p:ComponentProps<typeof ConversaoIntegral>=props) { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><NavGuardProvider><ConversaoIntegral {...p}/></NavGuardProvider></QueryClientProvider>); }
async function confirmar(){const botao=await screen.findByRole("button",{name:"Confirmar"});await waitFor(()=>expect(botao).toBeEnabled());await act(async()=>{fireEvent.click(botao);});}
async function preparar(){const botao=await screen.findByRole("button",{name:"Criar OS integral"});await waitFor(()=>expect(botao).toBeEnabled());fireEvent.click(botao);await confirmar();}
afterEach(()=>{ cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); criar.mockReset(); revisao.mockClear(); });
it("mantém pedido idêntico após erro e reenvia sem gerar novas identidades",async()=>{
  criar.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({});
  const view=tela();
  await preparar();
  await screen.findByText(/Resultado não confirmado/);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Repetir mesma operação"})).toBeEnabled());
  const original=criar.mock.calls[0]?.[0];
  view.unmount(); tela();
  const repetir=await screen.findByRole("button",{name:"Repetir mesma operação"});
  await waitFor(()=>expect(repetir).toBeEnabled());
  await act(async()=>{fireEvent.click(repetir);});
  await waitFor(()=>expect(criar).toHaveBeenCalledTimes(2));
  expect(criar.mock.calls[1]?.[0]).toEqual(original);
  await waitFor(()=>expect(sessionStorage.length).toBe(0));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Criar OS integral"})).toBeEnabled());
});
it("isola tentativa pendente por Cliente e bloqueia dados persistidos corrompidos",async()=>{
  const key=`sso-conversao-integral:${usuario}:${cliente}:${chamado}`;
  sessionStorage.setItem(key,"inválido"); tela();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível recuperar");
  expect(screen.getByRole("button",{name:"Criar OS integral"})).toBeDisabled();
  expect(criar).not.toHaveBeenCalled();
});
it("não exibe pedido de outro usuário ou Cliente",async()=>{
  const outraChave=`sso-conversao-integral:${usuario}:16797005-0000-4000-8000-000000000099:${chamado}`;
  sessionStorage.setItem(outraChave,"inválido"); tela();
  const botao=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(botao).toBeEnabled());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(sessionStorage.getItem(outraChave)).toBe("inválido");
});
it("atualiza contexto após confirmação mesmo se a limpeza local falhar",async()=>{
  criar.mockResolvedValueOnce({});
  const aoConcluir=vi.fn();
  vi.spyOn(Storage.prototype,"removeItem").mockImplementation(()=>{throw new Error("armazenamento indisponível");});
  tela({...props,aoConcluir});
  await preparar();
  expect(await screen.findByRole("alert")).toHaveTextContent("OS confirmada, mas não foi possível limpar");
  expect(aoConcluir).toHaveBeenCalledTimes(1);
  expect(sessionStorage.length).toBe(1);
  expect(criar).toHaveBeenCalledTimes(1);
});
it("não apaga outra tentativa criada durante atualização da lista após confirmação",async()=>{
  criar.mockResolvedValueOnce({});
  let liberar!:()=>void;
  const cache=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  const invalidar=vi.spyOn(cache,"invalidateQueries").mockImplementation(()=>new Promise<void>((resolve)=>{liberar=resolve;}));
  render(<QueryClientProvider client={cache}><NavGuardProvider><ConversaoIntegral {...props}/></NavGuardProvider></QueryClientProvider>);
  await preparar();
  await waitFor(()=>expect(invalidar).toHaveBeenCalled());
  const chave=`sso-conversao-integral:${usuario}:${cliente}:${chamado}`;
  sessionStorage.setItem(chave,"outra tentativa");
  await act(async()=>{liberar();});
  await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent(/tentativa/i));
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
it("reutiliza formulário legado e conserva tipo, técnico, data e solicitante no pedido",async()=>{
  criar.mockRejectedValueOnce(new Error("timeout")); tela();
  const botao=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(botao).toBeEnabled()); fireEvent.click(botao);
  fireEvent.change(screen.getByLabelText("Técnico responsável"),{target:{value:tecnico}});
  fireEvent.change(screen.getByLabelText("Data prevista"),{target:{value:"2026-11-03"}});
  await confirmar();
  await screen.findByText(/Resultado não confirmado/);
  expect(criar.mock.calls[0]?.[0].abertura).toMatchObject({tipoTarefaId:tipo,tecnicoId:tecnico,dataPrevista:"2026-11-03",prioridade:"media",solicitante:"Pessoa"});
});
it("permite definir escopo próprio da OS e repete o mesmo conteúdo após erro",async()=>{
  criar.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({}); tela();
  const botao=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(botao).toBeEnabled()); fireEvent.click(botao);
  fireEvent.change(screen.getByLabelText("Título da OS *"),{target:{value:"Trocar bomba"}});
  fireEvent.change(screen.getByLabelText("Descrição da OS"),{target:{value:"Substituir bomba do reservatório"}});
  await confirmar(); await screen.findByText(/Resultado não confirmado/);
  expect(criar.mock.calls[0]?.[0]).toMatchObject({chamadoId:chamado,abertura:{titulo:"Trocar bomba",descricao:"Substituir bomba do reservatório"}});
  const repetir=screen.getByRole("button",{name:"Repetir mesma operação"});
  await waitFor(()=>expect(repetir).toBeEnabled()); fireEvent.click(repetir);
  await waitFor(()=>expect(criar).toHaveBeenCalledTimes(2));
  expect(criar.mock.calls[1]?.[0]).toEqual(criar.mock.calls[0]?.[0]);
});
it("permite revisar conflito de revisão sem perder o escopo ou reenviar automaticamente",async()=>{
  criar.mockRejectedValueOnce({code:"40001",message:"revisao_obsoleta"}).mockResolvedValueOnce({});
  const consultar=vi.fn().mockResolvedValueOnce(1).mockResolvedValue(2);
  tela({...props,consultarRevisao:consultar});
  const abrir=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(abrir).toBeEnabled()); fireEvent.click(abrir);
  fireEvent.change(screen.getByLabelText("Título da OS *"),{target:{value:"Trocar bomba"}});
  fireEvent.change(screen.getByLabelText("Descrição da OS"),{target:{value:"Bomba do reservatório"}});
  fireEvent.change(screen.getByLabelText("Técnico responsável"),{target:{value:tecnico}});
  await confirmar();
  const revisar=await screen.findByRole("button",{name:"Revisar e tentar novamente"});
  expect(criar).toHaveBeenCalledTimes(1);
  fireEvent.click(revisar);
  expect(await screen.findByLabelText("Título da OS *")).toHaveValue("Trocar bomba");
  expect(screen.getByLabelText("Descrição da OS")).toHaveValue("Bomba do reservatório");
  expect(screen.getByLabelText("Técnico responsável")).toHaveValue(tecnico);
  expect(criar).toHaveBeenCalledTimes(1);
  await confirmar(); await waitFor(()=>expect(criar).toHaveBeenCalledTimes(2));
  expect(criar.mock.calls[1]?.[0]).toMatchObject({expectedRevision:2,abertura:{titulo:"Trocar bomba",descricao:"Bomba do reservatório",tecnicoId:tecnico}});
  expect(criar.mock.calls[1]?.[0].requestId).not.toBe(criar.mock.calls[0]?.[0].requestId);
});
it("não substitui tentativa guardada se outra operação alterar o armazenamento",async()=>{
  criar.mockRejectedValueOnce({code:"40001",message:"revisao_obsoleta"}); tela();
  await preparar();
  const revisar=await screen.findByRole("button",{name:"Revisar e tentar novamente"});
  const chave=`sso-conversao-integral:${usuario}:${cliente}:${chamado}`;
  sessionStorage.setItem(chave,"outro pedido"); fireEvent.click(revisar);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível revisar");
  expect(sessionStorage.getItem(chave)).toBe("outro pedido");
  expect(criar).toHaveBeenCalledTimes(1);
});
it("não presume conflito confirmado para outro erro de transação",async()=>{
  criar.mockRejectedValueOnce({code:"40001",message:"serialization failure"}); tela();
  await preparar();
  expect(await screen.findByText(/Resultado não confirmado/)).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Revisar e tentar novamente"})).toBeNull();
  expect(screen.getByRole("button",{name:"Repetir mesma operação"})).toBeInTheDocument();
});
it("não confirma OS com título vazio",async()=>{
  tela(); const botao=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(botao).toBeEnabled()); fireEvent.click(botao);
  fireEvent.change(screen.getByLabelText("Título da OS *"),{target:{value:"   "}});
  await screen.findByRole("option",{name:"Bomba A"});
  expect(screen.getByRole("button",{name:"Confirmar"})).toBeDisabled();
  expect(criar).not.toHaveBeenCalled();
});
it("preserva GUT definido no backlog",async()=>{
  criar.mockRejectedValueOnce(new Error("timeout")); tela();
  const botao=await screen.findByRole("button",{name:"Criar OS integral"}); await waitFor(()=>expect(botao).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Destino"),{target:{value:"backlog"}}); fireEvent.click(botao);
  fireEvent.change(screen.getByLabelText("Gravidade *"),{target:{value:"5"}});
  fireEvent.change(screen.getByLabelText("Urgência *"),{target:{value:"4"}});
  fireEvent.change(screen.getByLabelText("Tendência *"),{target:{value:"2"}});
  await confirmar();
  await screen.findByText(/Resultado não confirmado/);
  expect(criar.mock.calls[0]?.[0]).toMatchObject({destino:"backlog",abertura:{gravidade:5,urgencia:4,tendencia:2}});
});
it("conserva o status do movimento por arraste no pedido",async()=>{
  criar.mockRejectedValueOnce(new Error("timeout")); tela({...props,statusHubInicial:"planejamento"});
  await preparar(); await screen.findByText(/Resultado não confirmado/);
  expect(criar.mock.calls[0]?.[0]).toMatchObject({destino:"convertido_os",statusHub:"planejamento"});
});
it("inclui o componente escolhido no pedido e o preserva no retry",async()=>{
  criar.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({}); tela();
  const botao=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(botao).toBeEnabled()); fireEvent.click(botao);
  const seletor=await screen.findByLabelText("Componente (Alvo)");
  await screen.findByRole("option",{name:"Bomba A"});
  expect(listarEquipamentos).toHaveBeenCalledWith(cliente,chamado);
  fireEvent.change(seletor,{target:{value:equipamento}});
  await confirmar();
  await screen.findByText(/Resultado não confirmado/);
  expect(criar.mock.calls[0]?.[0].abertura.equipamentoId).toBe(equipamento);
  const repetir=screen.getByRole("button",{name:"Repetir mesma operação"});
  await waitFor(()=>expect(repetir).toBeEnabled()); fireEvent.click(repetir);
  await waitFor(()=>expect(criar).toHaveBeenCalledTimes(2));
  expect(criar.mock.calls[1]?.[0].abertura.equipamentoId).toBe(equipamento);
});
it("bloqueia a confirmação quando o cadastro de componentes falha e permite nova consulta",async()=>{
  const consulta=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{id:equipamento,nome:"Bomba A"}]);
  tela({...props,listarEquipamentos:consulta});
  const botao=await screen.findByRole("button",{name:"Criar OS integral"});
  await waitFor(()=>expect(botao).toBeEnabled()); fireEvent.click(botao);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar componentes");
  expect(screen.getByRole("button",{name:"Confirmar"})).toBeDisabled();
  expect(criar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));
  await screen.findByRole("option",{name:"Bomba A"});
  await waitFor(()=>expect(screen.getByRole("button",{name:"Confirmar"})).toBeEnabled());
});
it("bloqueia segundo envio enquanto o primeiro está pendente",async()=>{
  let concluir:(valor:unknown)=>void=()=>{};
  criar.mockImplementation(()=>new Promise((resolve)=>{concluir=resolve;})); tela();
  await preparar(); await waitFor(()=>expect(criar).toHaveBeenCalledTimes(1));
  const repetir=screen.getByRole("button",{name:"Repetir mesma operação"});
  expect(repetir).toBeDisabled(); fireEvent.click(repetir); expect(criar).toHaveBeenCalledTimes(1);
  await act(async()=>{concluir({});}); await waitFor(()=>expect(sessionStorage.length).toBe(0));
});
