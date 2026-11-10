// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:mocks.getUser},schema:()=>({rpc:mocks.rpc})}}));
import { RelatorioDespesasFaturaveis } from "./RelatorioDespesasFaturaveis";

const usuario="usuario";
const sessao={data:{user:{id:usuario}},error:null};
const linha={inicio:"2026-01-01",fim:"2026-12-31",despesas:{quantidade:1,previstoCentavos:"900719925474099300",realizadoCentavos:"0",semPrevisto:0,semRealizado:1},faturaveis:{quantidade:1,originalCentavos:"100",conferidoCentavos:"0",semConferencia:1},medidasSomaveisEntreSi:false,criterioFaturavel:"data_competencia"};
function montar(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><RelatorioDespesasFaturaveis usuario={usuario} cliente="cliente"/></QueryClientProvider>);fireEvent.change(screen.getByLabelText("Início"),{target:{value:"2026-01-01"}});fireEvent.change(screen.getByLabelText("Fim inclusivo"),{target:{value:"2026-12-31"}});fireEvent.click(screen.getByRole("button",{name:"Consultar"}));}
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.resetAllMocks();});

it("preserva valores grandes como texto e não soma medidas distintas",async()=>{
  mocks.getUser.mockResolvedValue(sessao);mocks.rpc.mockReturnValue({abortSignal:async()=>({data:linha,error:null})});montar();
  expect(await screen.findByText(/900719925474099300 centavos/)).toBeInTheDocument();
  expect(screen.getByText(/não devem ser somadas entre si/)).toBeInTheDocument();
});
it("não apresenta valores quando a sessão muda durante a consulta",async()=>{
  mocks.getUser.mockResolvedValueOnce(sessao).mockResolvedValueOnce({data:{user:{id:"outro"}},error:null});mocks.rpc.mockReturnValue({abortSignal:async()=>({data:linha,error:null})});montar();
  expect(await screen.findByRole("alert")).toBeInTheDocument();expect(screen.queryByText(/900719925474099300 centavos/)).toBeNull();
});
it("recusa relatório com contagem inconsistente",async()=>{
  mocks.getUser.mockResolvedValue(sessao);mocks.rpc.mockReturnValue({abortSignal:async()=>({data:{...linha,despesas:{...linha.despesas,semRealizado:2}},error:null})});montar();
  expect(await screen.findByRole("alert")).toBeInTheDocument();expect(screen.queryByText(/900719925474099300 centavos/)).toBeNull();
});
it("encaminha usuário e Cliente ao mediador quando habilitado",async()=>{
  vi.stubEnv("VITE_SSO_RELATORIO_DESPESAS_FATURAVEIS_MEDIADO_ENABLED","true");
  mocks.getUser.mockResolvedValue(sessao);mocks.rpc.mockReturnValue({abortSignal:async()=>({data:linha,error:null})});montar();
  await screen.findByText(/900719925474099300 centavos/);
  expect(mocks.rpc).toHaveBeenCalledWith("sso_relatorio_despesas_faturaveis_mediado",expect.objectContaining({p_ator_esperado:usuario,p_cliente_id:"cliente"}));
});
