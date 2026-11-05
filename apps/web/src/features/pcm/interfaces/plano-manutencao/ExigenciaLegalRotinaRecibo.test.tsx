// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
import { ExigenciaLegalRotina } from "./ExigenciaLegalRotina";
const id = (n: number) => `16500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userId=id(1), clienteId=id(2), planoId=id(3), versaoId=id(4), rotinaId=id(5), requestId=id(6);
const chave=`sso-exigencia-rotina:${JSON.stringify([userId,clienteId,planoId,versaoId,rotinaId])}`;
const pedido={ requestId, clienteId, planoId, versaoId, rotinaId, planoRevision:3, declaracaoRevision:2, classificacao:"nao_classificada", referencia:"", justificativa:"Conferido" };
const recibo={ requestId, rotinaId, revisao:3, modo:"calendario", toleranciaAntes:0, toleranciaDepois:0, referenciaValidada:false, toleranciaValidada:false, snapshotAlterado:false };
const auth=()=>({data:{user:{id:userId}},error:null});
let respostas: Array<() => Promise<unknown>>;
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); vi.stubEnv("VITE_SSO_EXIGENCIA_ROTINA_MEDIADA_ENABLED","true"); vi.stubEnv("VITE_SSO_RECIBO_EXIGENCIA_ROTINA_ENABLED","true"); vi.stubEnv("VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED","false"); api.getUser.mockResolvedValue(auth()); respostas=[]; api.rpc.mockImplementation((nome: string) => nome === "sso_historico_exigencia_rotina_mediado" ? { abortSignal: async () => ({data:[],error:null}) } : respostas.shift()?.()); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); });
function montar() { sessionStorage.setItem(chave, JSON.stringify(pedido)); return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ExigenciaLegalRotina userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} planoRevision={3} modo="calendario" /></QueryClientProvider>); }
it.each(["Repetir tentativa pendente","Consultar recibo"] as const)("%s preserva tentativa em revisão e snapshot divergentes", async (botao) => {
  respostas.push(async()=>({data:{...recibo,revisao:4},error:null}),async()=>({data:{...recibo,snapshotAlterado:true},error:null}),async()=>({data:recibo,error:null}));
  montar();
  fireEvent.click(screen.getByRole("button",{name:botao}));
  await screen.findByText(/Resultado não confirmado|Recibo indisponível/);
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  await waitFor(()=>expect(screen.getByRole("button",{name:botao})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:botao}));
  await waitFor(()=>expect(api.rpc.mock.calls.filter(([nome])=>nome!=='sso_historico_exigencia_rotina_mediado')).toHaveLength(2));
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  await waitFor(()=>expect(screen.getByRole("button",{name:botao})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:botao}));
  await waitFor(()=>expect(sessionStorage.getItem(chave)).toBeNull());
  const comandos=api.rpc.mock.calls.filter(([nome])=>nome!=='sso_historico_exigencia_rotina_mediado');
  expect(comandos[1]).toEqual(comandos[0]); expect(comandos[2]).toEqual(comandos[0]);
});
it("troca de sessão após escrita mantém pedido", async()=>{
  respostas.push(async()=>{api.getUser.mockResolvedValue({data:{user:{id:id(9)}},error:null});return {data:recibo,error:null};});
  montar(); fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa pendente"}));
  await screen.findByText(/Resultado não confirmado/); expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
});
it("desmontagem antes da resposta mantém pedido para recuperação", async()=>{
  let concluir!: (valor: unknown)=>void;
  respostas.push(()=>new Promise(resolve=>{concluir=resolve;}));
  const tela=montar(); fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa pendente"}));
  await waitFor(()=>expect(concluir).toBeTypeOf("function")); tela.unmount(); const chamadas=api.getUser.mock.calls.length; concluir({data:recibo,error:null});
  await waitFor(()=>expect(api.getUser.mock.calls.length).toBeGreaterThan(chamadas));
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
});
