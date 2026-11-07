// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsultaCodigoPublico } from "./Consulta";
const m=vi.hoisted(()=>({autorizar:vi.fn(),localizar:vi.fn()}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter",()=>({supabaseCapacidadesSsoAdapter:{autorizarAcao:m.autorizar}}));
vi.mock("../../infrastructure/supabase-codigos-publicos-adapter",()=>({localizarCodigoPublico:m.localizar}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:"u"}},error:null})}}}));
vi.mock("./Substituicao",()=>({SubstituicaoCodigoPublico:()=>null}));
vi.mock("./EdicaoRascunho",()=>({EdicaoRascunhoCodigo:()=>null}));
vi.mock("./AliasesAtivo",()=>({AliasesAtivo:()=>null}));
function montar(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConsultaCodigoPublico userId="u" clienteId="cliente-a"/></QueryClientProvider>);}
function pesquisar(codigo:string){fireEvent.change(screen.getByLabelText("Código"),{target:{value:codigo}});fireEvent.click(screen.getByRole("button",{name:"Consultar"}));}
afterEach(()=>{m.autorizar.mockReset();m.localizar.mockReset();vi.unstubAllEnvs();});
describe("busca de código público",()=>{
  it("busca alias e código atual no Cliente sem transformar valores",async()=>{
    m.autorizar.mockResolvedValue(true);m.localizar.mockResolvedValue({situacao:"encontrado",tipo:"componente",ativoId:"ativo-1"});montar();
    await screen.findByRole("button",{name:"Consultar"});pesquisar("antigo-01");expect(await screen.findByText(/Equipamento ou Componente \(cadastro compartilhado\) · ID/)).toHaveTextContent("ativo-1");
    pesquisar("NOVO-01");await waitFor(()=>expect(m.localizar).toHaveBeenCalledWith("cliente-a","NOVO-01","u",expect.any(AbortSignal)));expect(m.localizar).toHaveBeenCalledWith("cliente-a","antigo-01","u",expect.any(AbortSignal));
  });
  it("ambiguidade não apresenta ativo anterior",async()=>{
    m.autorizar.mockResolvedValue(true);m.localizar.mockImplementation(async(_cliente:string,codigo:string)=>codigo==="ANTIGO"?{situacao:"encontrado",tipo:"sistema",ativoId:"sistema-1"}:{situacao:"ambiguo"});montar();
    await screen.findByRole("button",{name:"Consultar"});pesquisar("ANTIGO");await screen.findByText(/Sistema · ID/);pesquisar("COLISAO");expect(await screen.findByRole("alert")).toHaveTextContent("Código ambíguo");expect(screen.queryByText(/Sistema · ID/)).toBeNull();
  });
});
