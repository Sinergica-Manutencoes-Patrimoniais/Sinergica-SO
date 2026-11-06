// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
import { ImpactoPmocRevisao } from "./ImpactoPmocRevisao";
import { ConferenciaPmocCiclo } from "./ConferenciaPmocCiclo";
const id=(n:number)=>`16630000-1111-4000-8000-${String(n).padStart(12,"0")}`;const dia="2026-11-05";
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();vi.unstubAllEnvs();});
it.each([["impacto","primeira"],["impacto","replay"],["ciclo","primeira"],["ciclo","replay"]] as const)("%s preserva semântica P0013 na %s tentativa",async(tela,cenario)=>{
 vi.stubEnv("VITE_SSO_IMPACTO_PMOC_REVISAO_ENABLED","true");let tentativas=0;
 const fotoImpacto={vinculoId:id(6),agendamentoId:id(7),vencimento:dia,agendamento:null,imovelConferidoId:null,contratoConferidoId:null,imovelClienteId:null,imovelExcluidoEm:null,contratoExcluidoEm:null,decisaoAtualId:null,origem:null};
 const fotoCiclo={id:id(7),clienteId:id(2),data:dia,imovelNome:"Imóvel",imovelId:id(8),contratoId:id(9),contratoInicio:null,contratoFim:null,estado:"planejado",tipo:"mensal"};
 api.rpc.mockImplementation((nome:string)=>{if(nome==="sso_listar_impactos_pmoc_revisao")return {abortSignal:async()=>({data:[{vinculo_id:id(6),rascunho_id:id(10),rotina_id:id(5),alvo_tipo:"sistema",alvo_id:id(11),vencimento:dia,agendamento_id:id(7),revisao_decisao:0,ultima_decisao:null,ultima_revisao_plano:null,fotografia:fotoImpacto}],error:null})};if(nome==="sso_avaliar_impacto_pmoc")return {abortSignal:async()=>({data:{revisaoPlano:1,vinculosObservados:1,decisoesAusentes:1,decisoesObsoletas:0,exigemReconciliacao:0,vinculosInvalidos:0,fontesCompletas:false,aprovacaoAutorizada:false},error:null})};if(nome==="sso_listar_pmoc_ciclo_conferencia")return {abortSignal:async()=>({data:[{agendamento_id:id(7),revisao_decisao:0,classificacao:null,fotografia_atual:true,fotografia:fotoCiclo}],error:null})};return Promise.resolve({data:null,error:cenario==="replay"&&tentativas++===0?new Error("rede"):{code:"P0013",message:"fotografia_pmoc_alterada"}});});
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});const props={userId:"usuario",clienteId:id(2),planoId:id(3)};
 render(<QueryClientProvider client={client}>{tela==="impacto"?<ImpactoPmocRevisao {...props} revisao={1}/>:<ConferenciaPmocCiclo {...props} versaoId={id(4)} rotinaId={id(5)} revision={1} vencimento={dia}/>}</QueryClientProvider>);
 if(tela==="impacto"){await screen.findByRole("option",{name:/2026-11-05/});fireEvent.change(screen.getByLabelText("Ciclo PMOC"),{target:{value:id(6)}});}else{await screen.findByRole("option",{name:/Imóvel/});fireEvent.change(screen.getByLabelText("Agendamento"),{target:{value:id(7)}});fireEvent.change(screen.getByLabelText("Classificação"),{target:{value:"nao_relacionado"}});fireEvent.change(screen.getByLabelText("Referência da evidência"),{target:{value:"PCM"}});}
 fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido"}});fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:tela==="impacto"?"Registrar decisão":"Registrar conferência"}));
 if(cenario==="primeira"){await screen.findByText(tela==="impacto" ? /Dados alterados/ : /Conferência recusada/);expect(sessionStorage.length).toBe(0);}else{fireEvent.click(await screen.findByRole("button",{name:"Repetir tentativa pendente"}));await waitFor(()=>expect(tentativas).toBeGreaterThanOrEqual(2));expect(sessionStorage.length).toBe(1);}
});
