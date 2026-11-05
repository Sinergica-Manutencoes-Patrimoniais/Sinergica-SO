// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc}),auth:{getUser:async()=>({data:{user:{id:"usuario"}},error:null})}}}));
import { EscolherNovaDataCalendario } from "./EscolherNovaDataCalendario";
import { EscolherNovaVisita } from "./EscolherNovaVisita";
import type { ComparacaoImpacto } from "./ComparacaoImpactoSelecionado";
const preparadaId="16630000-1111-4000-8000-000000000061";const rascunhoId="16630000-1111-4000-8000-000000000022";const rotinaId="16630000-1111-4000-8000-000000000031";const logica="16630000-1111-4000-8000-000000000032";const alvo="16630000-1111-4000-8000-000000000033";const visita="16630000-1111-4000-8000-000000000081";const serie="16630000-1111-4000-8000-000000000082";
const rotina={id:rotinaId,nome:"Rotina",alvo_tipo:"sistema",sistema_id:alvo,equipamento_id:null,grupo_id:null,modo:"calendario",intervalo_n:1,intervalo_unidade:"meses",data_base:"2026-11-04",tempo_minutos:null,tipo_tempo:null,tolerancia_antes:0,tolerancia_depois:0,instrucao:null,questionario_id:null};
const base={userId:"usuario",clienteId:"cliente",planoId:"plano",rascunhoId,preparadaId,planoRevision:2,decisaoRevision:1};
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();api.rpc.mockReset();});
it.each(["calendario","visita"] as const)("apresenta candidatos e envia escolha explícita de %s",async tipo=>{
 vi.stubEnv(tipo==="calendario"?"VITE_SSO_NOVA_DATA_CICLO_ENABLED":"VITE_SSO_NOVA_DATA_VISITA_ENABLED","true");
 const comparacao={preparadaId,rascunhoId,revisaoPlano:2,tipo,rotinaLogicaId:logica,alvoOcorrenciaTipo:"sistema",alvoOcorrenciaId:alvo,vencimentoOriginal:"2026-11-04",ciclo:tipo==="calendario"?1:null,visitaId:tipo==="visita"?visita:null,semanaOrigem:tipo==="visita"?"2026-11-02":null,anterior:rotina,rascunho:rotina,questionarioComparacao:{estado:"sem_questionario",historicoHash:null,atualHash:null},origemOcorrencia:{versaoId:"16630000-1111-4000-8000-000000000021",numero:1,estado:"disponivel",rotina,questionarioEstado:"sem_questionario",questionarioHash:null},osImpacto:[],osOutroCliente:false,fontesCompletas:false,aprovacaoAutorizada:false} as ComparacaoImpacto;
 api.rpc.mockImplementation((nome:string,args:Record<string,unknown>)=>nome.startsWith("sso_prever_")||nome.startsWith("sso_listar_candidatas")?Promise.resolve({data:tipo==="calendario"?[{indice:2,vencimento:"2026-12-05"}]:[{visita_id:visita,vencimento:"2026-12-05",serie_id:serie,semana_origem:"2026-11-30"}],error:null}):Promise.resolve({data:{requestId:args.p_request,preparadaId,novaDataEscolhida:"2026-12-05",indiceNovo:2,visitaEscolhida:visita,fontesFeriadosCompletas:false,substituicaoAplicada:false,aprovacaoAutorizada:false,ocorrenciaAlterada:false,osAlteradas:false},error:null}));
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{tipo==="calendario"?<EscolherNovaDataCalendario {...base} comparacao={comparacao}/>:<EscolherNovaVisita {...base} comparacao={comparacao}/>}</QueryClientProvider>);
 fireEvent.change(screen.getByLabelText("Início da janela"),{target:{value:"2026-12-01"}});fireEvent.change(screen.getByLabelText("Fim da janela"),{target:{value:"2026-12-31"}});fireEvent.click(screen.getByRole("button",{name:"Consultar datas"}));
 await screen.findByRole("option",{name:/2026-12-05/});fireEvent.change(screen.getByLabelText(tipo==="calendario"?"Data candidata":"Visita candidata"),{target:{value:tipo==="calendario"?"2":visita}});
 if(tipo==="visita")fireEvent.change(screen.getByLabelText("Fonte de feriados conferida"),{target:{value:"Calendário conferido"}});
 fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Escolha conferida"}});fireEvent.click(screen.getByRole("checkbox",{name:/Conferi a ocorrência original/}));fireEvent.click(screen.getByRole("button",{name:"Registrar escolha"}));
 await screen.findByText(/escolhida; aplicação depende de aprovação/);expect(api.rpc.mock.calls.some(([nome])=>nome===(tipo==="calendario"?"sso_escolher_nova_data_calendario":"sso_escolher_nova_visita"))).toBe(true);
});
