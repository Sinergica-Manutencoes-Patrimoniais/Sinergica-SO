// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
import { ExcecaoVisita } from "./ExcecaoVisita";
const id = (n: number) => `17600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const chave=`sso-excecao-visita:${JSON.stringify([id(1),id(2),id(3)])}`;
const sucesso=(args: Record<string, unknown>)=>({ data: { requestId: args.p_request, visitaId: id(3), revisaoVisita: 2, aprovada: true, visitaAlterada: false, osAlteradas: false, tarefaAuvoCriada: false }, error: null });
let resposta: (args: Record<string, unknown>) => Promise<unknown>;
beforeEach(()=>{ vi.resetAllMocks(); sessionStorage.clear(); vi.stubEnv("VITE_SSO_EXCECAO_VISITA_ENABLED","true"); api.getUser.mockResolvedValue({data:{user:{id:id(1)}},error:null}); api.rpc.mockImplementation((nome: string, args: Record<string,unknown>) => nome === "sso_consultar_excecao_visita" ? {abortSignal: async()=>({data:{visitaId:id(3),aprovada:false,revisaoAtual:2,dataAtual:"2026-11-06"},error:null})} : resposta(args)); });
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();});
function montar(aoAprovar=vi.fn()) { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ExcecaoVisita userId={id(1)} clienteId={id(2)} visitaId={id(3)} aoAprovar={aoAprovar}/></QueryClientProvider>); }
async function iniciar() { await screen.findByText(/Data local/); fireEvent.change(screen.getByLabelText("Origem"),{target:{value:"PCM"}}); fireEvent.change(screen.getByLabelText("Natureza"),{target:{value:"ajuste"}}); fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido"}}); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button",{name:"Aprovar exceção"})); }
it("40001 preserva pedido e repetição usa mesmo identificador e payload",async()=>{
 let numero=0; resposta=async(args)=> ++numero===1 ? {data:null,error:{code:"40001",message:"serialization_failure"}} : sucesso(args);
 montar(); await iniciar(); await screen.findByText(/Resultado não confirmado/);
 const salvo=sessionStorage.getItem(chave); expect(salvo).toBeTruthy();
 const repetir=screen.getByRole("button",{name:"Repetir mesma aprovação"}); await waitFor(()=>expect(repetir).toBeEnabled()); fireEvent.click(repetir);
 await waitFor(()=>expect(sessionStorage.getItem(chave)).toBeNull());
 const chamadas=api.rpc.mock.calls.filter(([nome])=>nome==="sso_aprovar_excecao_visita"); expect(chamadas).toHaveLength(2); expect(chamadas[1]).toEqual(chamadas[0]);
});
it("desmontagem antes da resposta preserva pedido e não informa aprovação",async()=>{
 let concluir!: (valor:unknown)=>void; resposta=()=>new Promise(resolve=>{concluir=resolve;}); const aoAprovar=vi.fn(); const tela=montar(aoAprovar); await iniciar();
 await waitFor(()=>expect(concluir).toBeTypeOf("function")); const salvo=sessionStorage.getItem(chave); expect(salvo).toBeTruthy();
 const chamada=api.rpc.mock.calls.find(([nome])=>nome==="sso_aprovar_excecao_visita"); if(!chamada) throw new Error("Chamada ausente");
 tela.unmount(); const chamadas=api.getUser.mock.calls.length; concluir(sucesso(chamada[1])); await waitFor(()=>expect(api.getUser.mock.calls.length).toBeGreaterThan(chamadas));
 expect(sessionStorage.getItem(chave)).toBe(salvo); expect(aoAprovar).not.toHaveBeenCalled();
});
