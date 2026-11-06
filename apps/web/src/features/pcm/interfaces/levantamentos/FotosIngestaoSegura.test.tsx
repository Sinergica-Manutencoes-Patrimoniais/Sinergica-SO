// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FotosIngestaoSegura } from "./FotosIngestaoSegura";
const m=vi.hoisted(()=>({getUser:vi.fn(),invoke:vi.fn(),rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:m.getUser},functions:{invoke:m.invoke},schema:()=>({rpc:m.rpc})}}));
const user="17970000-0000-4000-8000-000000000001",cliente="17970000-0000-4000-8000-000000000002",lote="17970000-0000-4000-8000-000000000003";
beforeEach(()=>{vi.stubEnv("VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED","true");m.getUser.mockReset().mockResolvedValue({data:{user:{id:user}},error:null});m.invoke.mockReset();vi.stubGlobal("crypto",{randomUUID:()=>"17970000-0000-4000-8000-000000000004",subtle:{digest:async()=>new Uint8Array(32).buffer}});});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();vi.unstubAllGlobals();});
function arquivo(){const f=new File(["foto"],"foto.png",{type:"image/png"});Object.defineProperty(f,"arrayBuffer",{value:async()=>new Uint8Array([1,2,3]).buffer});return f;}
function montar(){return render(<FotosIngestaoSegura userId={user} clienteId={cliente} loteId={lote} chave="linha"/>);}
it("conserva request e arquivo para repetição após resultado incerto",async()=>{m.invoke.mockResolvedValue({data:null,error:new Error("timeout")});montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();const primeira=m.invoke.mock.calls[0]?.[1].headers["x-request-id"];fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa verificada"}));await waitFor(()=>expect(m.invoke).toHaveBeenCalledTimes(2));expect(m.invoke.mock.calls[1]?.[1].headers["x-request-id"]).toBe(primeira);expect(sessionStorage.length).toBe(1);});
it("não envia quando sessão atual é de outro usuário",async()=>{m.getUser.mockResolvedValue({data:{user:{id:"outro"}},error:null});montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();expect(m.invoke).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(1);});
it("aceita apenas confirmação do mesmo request e limpa tentativa após replay concluído",async()=>{
 m.invoke.mockResolvedValueOnce({data:{fotoId:"17970000-0000-4000-8000-000000000005",requestId:"17970000-0000-4000-8000-000000000099"},error:null}).mockResolvedValueOnce({data:{fotoId:"17970000-0000-4000-8000-000000000005",requestId:"17970000-0000-4000-8000-000000000004"},error:null});
 montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));
 expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();expect(sessionStorage.length).toBe(1);fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa verificada"}));
 expect(await screen.findByText(/Foto recebida no levantamento/)).toBeTruthy();expect(sessionStorage.length).toBe(0);
});
it("gate desligado oculta nova trilha",()=>{vi.stubEnv("VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED","false");montar();expect(screen.queryByLabelText("Foto com verificação de integridade")).toBeNull();});
it("não interpreta sucesso quando usuário muda durante resposta",async()=>{
 m.getUser.mockReset().mockResolvedValueOnce({data:{user:{id:user}},error:null}).mockResolvedValueOnce({data:{user:{id:"outro"}},error:null});
 m.invoke.mockResolvedValue({data:{fotoId:"17970000-0000-4000-8000-000000000005",requestId:"17970000-0000-4000-8000-000000000004"},error:null});
 montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));
 expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();expect(sessionStorage.length).toBe(1);
});
it("consulta observação auditada sem afirmar ausência atual",async()=>{
 m.invoke.mockResolvedValue({data:null,error:new Error("resultado incerto")});
 m.rpc.mockResolvedValue({data:{requestId:"17970000-0000-4000-8000-000000000004",confirmada:false,observacao:{observadoEm:"2026-10-30T10:00:00+00:00",objetoCatalogado:false,confirmada:false}},error:null});
 montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));
 await screen.findByText(/Resultado não confirmado/);fireEvent.click(screen.getByRole("button",{name:"Consultar conferência"}));
 expect(await screen.findByText(/não confirma a situação atual/i)).toBeTruthy();expect(m.rpc).toHaveBeenCalledWith("sso_consultar_observacao_ingestao_foto",expect.objectContaining({p_cliente_id:cliente,p_lote_id:lote,p_chave:"linha"}));expect(sessionStorage.length).toBe(1);
});
it("PCM consulta request informado mesmo sem tentativa nesta sessão",async()=>{
 m.rpc.mockResolvedValue({data:{requestId:"17970000-0000-4000-8000-000000000004",confirmada:false,observacao:null},error:null});montar();
 fireEvent.change(screen.getByLabelText("Identificador da tentativa"),{target:{value:"17970000-0000-4000-8000-000000000004"}});
 fireEvent.click(screen.getByRole("button",{name:"Consultar conferência"}));expect(await screen.findByText(/Nenhuma conferência auditada/)).toBeTruthy();
 expect(m.rpc).toHaveBeenCalledWith("sso_consultar_observacao_ingestao_foto",expect.objectContaining({p_request_id:"17970000-0000-4000-8000-000000000004",p_cliente_id:cliente}));
});
it("cancelamento confirmado preserva objeto antigo e permite nova tentativa",async()=>{
 m.invoke.mockResolvedValue({data:null,error:new Error("incerto")});m.rpc.mockResolvedValue({data:{requestId:"17970000-0000-4000-8000-000000000004",estado:"cancelada"},error:null});
 montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));await screen.findByText(/Resultado não confirmado/);
 fireEvent.change(screen.getByLabelText("Motivo do cancelamento"),{target:{value:"Tentativa pendente"}});fireEvent.click(screen.getByLabelText(/entendo que o objeto anterior pode permanecer/i));
 fireEvent.click(screen.getByRole("button",{name:"Cancelar tentativa pendente"}));
 expect(await screen.findByText(/Tentativa cancelada/)).toBeTruthy();expect(sessionStorage.length).toBe(0);expect(screen.getByRole("button",{name:"Enviar foto verificada"})).toBeTruthy();
 expect(m.rpc).toHaveBeenCalledWith("sso_cancelar_ingestao_foto",expect.objectContaining({p_motivo:"Tentativa pendente",p_cliente_id:cliente}));
});
it("notifica atualização da lista somente após cancelamento confirmado",async()=>{
 const atualizado=vi.fn();m.invoke.mockResolvedValue({data:null,error:new Error("incerto")});m.rpc.mockResolvedValue({data:{requestId:"17970000-0000-4000-8000-000000000004",estado:"cancelada"},error:null});
 render(<FotosIngestaoSegura userId={user} clienteId={cliente} loteId={lote} chave="linha" aoCancelar={atualizado}/>);
 fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));await screen.findByText(/Resultado não confirmado/);
 expect(atualizado).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText("Motivo do cancelamento"),{target:{value:"Tentativa pendente"}});fireEvent.click(screen.getByLabelText(/entendo que o objeto anterior pode permanecer/i));fireEvent.click(screen.getByRole("button",{name:"Cancelar tentativa pendente"}));
 await waitFor(()=>expect(atualizado).toHaveBeenCalledTimes(1));
});
it("cancelamento incerto conserva motivo e repete mesma operação",async()=>{
 m.invoke.mockResolvedValue({data:null,error:new Error("incerto")});m.rpc.mockResolvedValueOnce({data:null,error:new Error("timeout")}).mockResolvedValueOnce({data:{requestId:"17970000-0000-4000-8000-000000000004",estado:"cancelada"},error:null});
 montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));await screen.findByText(/Resultado não confirmado/);
 fireEvent.change(screen.getByLabelText("Motivo do cancelamento"),{target:{value:"Esclarecer tentativa"}});fireEvent.click(screen.getByLabelText(/entendo que o objeto anterior pode permanecer/i));fireEvent.click(screen.getByRole("button",{name:"Cancelar tentativa pendente"}));
 expect(await screen.findByText(/Cancelamento não confirmado/)).toBeTruthy();expect(screen.getByLabelText("Motivo do cancelamento")).toBeDisabled();expect(screen.getByRole("button",{name:"Repetir tentativa verificada"})).toBeDisabled();
 fireEvent.click(screen.getByRole("button",{name:"Cancelar tentativa pendente"}));expect(await screen.findByText(/Tentativa cancelada/)).toBeTruthy();
 expect(m.rpc.mock.calls[1]?.[1]).toEqual(m.rpc.mock.calls[0]?.[1]);
});
it("mantém tentativa quando contexto sai durante envio",async()=>{
 let concluir!:(v:unknown)=>void;m.invoke.mockImplementation(()=>new Promise(resolve=>{concluir=resolve;}));
 const {unmount}=montar();fireEvent.change(screen.getByLabelText("Foto com verificação de integridade"),{target:{files:[arquivo()]}});fireEvent.click(screen.getByRole("button",{name:"Enviar foto verificada"}));
 await waitFor(()=>expect(m.invoke).toHaveBeenCalledTimes(1));unmount();concluir({data:{fotoId:"17970000-0000-4000-8000-000000000005",requestId:"17970000-0000-4000-8000-000000000004"},error:null});
 await waitFor(()=>expect(m.getUser).toHaveBeenCalledTimes(2));await new Promise(resolve=>setTimeout(resolve,0));expect(sessionStorage.length).toBe(1);
});
