// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FotosLevantamento } from "./FotosLevantamento";
const m=vi.hoisted(()=>({rpc:vi.fn(),upload:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:m.rpc}),storage:{from:()=>({upload:m.upload})},auth:{getUser:async()=>({data:{user:{id:"u"}},error:null})}}}));
vi.mock("./PreviaFotosDestino",()=>({PreviaFotosDestino:()=>null}));
const cliente="17860000-0000-4000-8000-000000000001",lote="17860000-0000-4000-8000-000000000002";
function montar(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><FotosLevantamento userId="u" clienteId={cliente} loteId={lote} chave="linha"/></QueryClientProvider>);}
function preparar(erro:boolean){
  vi.stubEnv("VITE_SSO_FOTOS_LEVANTAMENTO_ENABLED","true");
  let seq=0;vi.stubGlobal("crypto",{randomUUID:()=>`17860000-0000-4000-8000-${String(++seq+10).padStart(12,"0")}`,subtle:{digest:async()=>new Uint8Array(32).buffer}});
  m.upload.mockResolvedValue(erro ? {data:null,error:new Error("storage recusado")} : {data:{path:"ok"},error:null});
  m.rpc.mockImplementation((nome:string,args:Record<string,unknown>)=>nome==="sso_fotos_levantamento_autorizadas" ? {abortSignal:()=>Promise.resolve({data:[],error:null})} : nome==="sso_recibo_foto_levantamento_autorizado" ? Promise.resolve({data:null,error:null}) : Promise.resolve({data:{fotoId:"17860000-0000-4000-8000-000000000099",loteId:lote,chave:"linha",requestId:args.p_request_id},error:null}));
  const file=new File(["foto"],"foto.png",{type:"image/png"});Object.defineProperty(file,"arrayBuffer",{value:async()=>new Uint8Array([1,2,3]).buffer});return file;
}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();m.rpc.mockReset();m.upload.mockReset();sessionStorage.clear();});
describe("upload de foto de levantamento",()=>{
  it("falha de Storage não chama vínculo e mantém tentativa para recuperação",async()=>{
    const arquivo=preparar(true);montar();fireEvent.change(screen.getByLabelText("Imagem JPEG ou PNG"),{target:{files:[arquivo]}});fireEvent.click(screen.getByRole("button",{name:"Adicionar foto"}));
    expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
    expect(m.rpc).not.toHaveBeenCalledWith("sso_vincular_foto_levantamento_autorizado",expect.anything());
    expect(screen.getByRole("button",{name:"Repetir envio"})).toBeTruthy();expect(sessionStorage.length).toBe(1);
    fireEvent.click(screen.getByRole("button",{name:"Consultar vínculo confirmado"}));
    expect(await screen.findByText(/Não há vínculo confirmado/)).toBeTruthy();expect(sessionStorage.length).toBe(1);
  });
  it("upload bem-sucedido vincula e limpa a tentativa",async()=>{
    const arquivo=preparar(false);montar();fireEvent.change(screen.getByLabelText("Imagem JPEG ou PNG"),{target:{files:[arquivo]}});fireEvent.click(screen.getByRole("button",{name:"Adicionar foto"}));
    await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith("sso_vincular_foto_levantamento_autorizado",expect.objectContaining({p_lote_id:lote,p_chave:"linha"})));
    expect(await screen.findByText(/Foto vinculada ao levantamento/)).toBeTruthy();expect(sessionStorage.length).toBe(0);
  });
  it("recupera somente recibo correspondente sem novo upload",async()=>{
    const arquivo=preparar(true);
    m.rpc.mockImplementation((nome:string,args:Record<string,unknown>)=>nome==="sso_fotos_levantamento_autorizadas" ? {abortSignal:()=>Promise.resolve({data:[],error:null})} : Promise.resolve({data:{fotoId:"17860000-0000-4000-8000-000000000099",loteId:lote,chave:"linha",requestId:args.p_request_id},error:null}));
    montar();fireEvent.change(screen.getByLabelText("Imagem JPEG ou PNG"),{target:{files:[arquivo]}});fireEvent.click(screen.getByRole("button",{name:"Adicionar foto"}));
    await screen.findByText(/Resultado não confirmado/);fireEvent.click(screen.getByRole("button",{name:"Consultar vínculo confirmado"}));
    expect(await screen.findByText(/Vínculo anteriormente registrado confirmado/)).toBeTruthy();expect(sessionStorage.length).toBe(0);expect(m.upload).toHaveBeenCalledTimes(1);
  });
});
