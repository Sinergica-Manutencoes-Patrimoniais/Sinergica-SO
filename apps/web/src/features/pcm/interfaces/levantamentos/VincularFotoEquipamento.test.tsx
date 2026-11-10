// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VincularFotoEquipamento } from "./VincularFotoEquipamento";
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:m.rpc})}}));
const foto="17850000-0000-4000-8000-000000000041", destino="17850000-0000-4000-8000-000000000011";
function montar(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><VincularFotoEquipamento userId="u" clienteId="c" fotoId={foto}/></QueryClientProvider>);}
afterEach(()=>{vi.unstubAllEnvs();m.rpc.mockReset();sessionStorage.clear();});
describe("vínculo de foto a Equipamento",()=>{
  it("não consulta com flag desligada",()=>{vi.stubEnv("VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED","false");montar();expect(m.rpc).not.toHaveBeenCalled();});
  it("não oferece vínculo após falha de autorização",async()=>{
    vi.stubEnv("VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED","true");m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:null,error:new Error("negado")})});montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Destino indisponível");
    expect(screen.getByRole("button",{name:"Registrar vínculo temporário"})).toBeDisabled();
  });
  it("confirma destino e usa comando versionado",async()=>{
    vi.stubEnv("VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED","true");
    m.rpc.mockImplementation((nome:string,args:Record<string,unknown>)=>nome==="sso_consultar_destino_foto_equipamento_v2" ? {abortSignal:()=>Promise.resolve({data:{fotoId:foto,tipo:"equipamento",entidadeId:destino,decisao:"aceita",revision:1,vinculado:false,fotoInadequada:false,destinoAtivo:true},error:null})} : Promise.resolve({data:{vinculoId:"17850000-0000-4000-8000-000000000091",fotoId:foto,tipo:"equipamento",entidadeId:destino,revision:1,requestId:args.p_request_id},error:null}));
    montar();await screen.findByText(/Equipamento:/);fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Registrar vínculo temporário"}));
    await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith("sso_vincular_foto_staging_ativo_mediado_v2",expect.objectContaining({p_foto_id:foto,p_tipo:"equipamento",p_entidade_id:destino,p_decisao_revision:1})));
  });
  it("não envia vínculo para foto inadequada mesmo com confirmação",async()=>{
    vi.stubEnv("VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED","true");
    m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{fotoId:foto,tipo:"equipamento",entidadeId:destino,decisao:"aceita",revision:1,vinculado:false,fotoInadequada:true,destinoAtivo:true},error:null})});
    montar();expect(await screen.findByText(/foto inadequada/)).toBeTruthy();fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button",{name:"Registrar vínculo temporário"})).toBeDisabled();
    expect(m.rpc).not.toHaveBeenCalledWith("sso_vincular_foto_staging_ativo_mediado_v2",expect.anything());
  });
});
