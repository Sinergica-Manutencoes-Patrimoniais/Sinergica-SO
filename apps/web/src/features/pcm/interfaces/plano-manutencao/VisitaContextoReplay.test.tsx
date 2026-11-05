// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoteOcorrenciasVisita } from "./LoteOcorrenciasVisita";
import { GerarVisitaContratual } from "./GerarVisitaContratual";
const api=vi.hoisted(()=>({getUser:vi.fn(),conferir:vi.fn(),rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:api.getUser},schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:api.conferir}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const usuario=id(1),cliente=id(2),plano=id(3),versao=id(4),rotina=id(5),serie=id(6),request=id(7),visita=id(8),ocorrencia=id(9);
const auth={data:{user:{id:usuario}},error:null};
const lote={requestId:request,clienteId:cliente,planoId:plano,versaoId:versao,rotinaId:rotina,revision:1,itens:[{visitaId:visita,ocorrenciaId:ocorrencia,fonteDiaUtil:"PCM"}]};
const geracao={requestId:request,clienteId:cliente,serieId:serie,regraId:id(10),semana:"2026-11-02",visitaId:visita,inicio:"2026-11-06T09:00:00-03:00",cobertura:"PCM",protocolo:"coordenado"};
const casos=[
 {nome:"lote",chave:`lote-visita:${JSON.stringify([usuario,cliente,plano,versao,rotina,serie])}`,pedido:lote,botao:"Repetir mesmo lote",rpc:"sso_preparar_lote_visita_canonica",elemento:()=> <LoteOcorrenciasVisita userId={usuario} clienteId={cliente} planoId={plano} versaoId={versao} rotinaId={rotina} serieId={serie} revision={1} candidatos={[]} consultando={false}/>,recibo:{data:{requestId:request,itens:[{requestId:id(11),ocorrenciaId:ocorrencia,cicloVisitaId:id(12),visitaId:visita,criada:true,osCriada:false,tarefaAuvoCriada:false,fonteFeriadosCompleta:false}],atomico:true,osCriada:false,tarefaAuvoCriada:false,fonteFeriadosCompleta:false},error:null}},
 {nome:"geração",chave:`sso-gerar-visita-contratual:${JSON.stringify([usuario,cliente,serie])}`,pedido:geracao,botao:"Repetir tentativa pendente",rpc:"sso_gerar_visita_ou_suprimir",elemento:()=> <GerarVisitaContratual userId={usuario} clienteId={cliente} serieId={serie}/>,recibo:{data:{requestId:request,clienteId:cliente,serieId:serie,semana:geracao.semana,efeitoRemoto:false,decisao:"gerada",detalhe:{requestId:request,decisao:"criada",visitaCriada:true,visitaId:visita}},error:null}},
];
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.getUser.mockResolvedValue(auth);api.conferir.mockResolvedValue(undefined);vi.stubEnv("VITE_SSO_GERACAO_OU_SUPRESSAO_ENABLED","true");});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();});
function montar(c:(typeof casos)[number]) {
 sessionStorage.setItem(c.chave,JSON.stringify(c.pedido));
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<QueryClientProvider client={client}>{c.elemento()}</QueryClientProvider>);
}
function rpcLeituraOu(c:(typeof casos)[number],resultado:()=>unknown) {
 api.rpc.mockImplementation((nome:string)=>nome===c.rpc?resultado():{abortSignal:async()=>({data:[],error:null})});
}
it.each(casos)("$nome preserva pedido quando desmonta durante autenticação",async(c)=>{
 rpcLeituraOu(c,()=>Promise.reject(new Error("não deveria enviar")));const tela=montar(c);
 if(c.nome==="geração") await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("sso_pcm_listar_regras_visita",expect.anything()));
 let liberar:(v:unknown)=>void=()=>{throw new Error("autenticação ausente");};
 let iniciou=false;const aguardando=()=>new Promise((resolve)=>{iniciou=true;liberar=resolve;});
 if(c.nome==="lote")api.conferir.mockImplementationOnce(aguardando);else api.getUser.mockImplementationOnce(aguardando);
 fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await waitFor(()=>expect(iniciou).toBe(true));
 tela.unmount();await act(async()=>{liberar(c.nome==="lote"?undefined:auth);});
 expect(api.rpc.mock.calls.filter(([nome])=>nome===c.rpc)).toHaveLength(0);
 expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
it.each(casos)("$nome preserva pedido quando desmonta durante resposta",async(c)=>{
 let liberar:(v:unknown)=>void=()=>{throw new Error("resposta ausente");};
 rpcLeituraOu(c,()=>new Promise((resolve)=>{liberar=resolve;}));const tela=montar(c);
 fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await waitFor(()=>expect(api.rpc.mock.calls.filter(([nome])=>nome===c.rpc)).toHaveLength(1));
 tela.unmount();await act(async()=>{liberar(c.recibo);});
 expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
it.each(casos)("$nome repete payload idêntico após resultado incerto",async(c)=>{
 rpcLeituraOu(c,()=>Promise.resolve({data:null,error:new Error("rede")}));montar(c);
 fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await screen.findByText(/Resultado não confirmado/);
 await waitFor(()=>expect(screen.getByRole("button",{name:c.botao})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await waitFor(()=>expect(api.rpc.mock.calls.filter(([nome])=>nome===c.rpc)).toHaveLength(2));
 const chamadas=api.rpc.mock.calls.filter(([nome])=>nome===c.rpc);
 expect(chamadas[1]).toEqual(chamadas[0]);expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
