// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { FotoVerificada } from "./FotoVerificada";
const m=vi.hoisted(()=>({getUser:vi.fn(),invoke:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:m.getUser},functions:{invoke:m.invoke}}}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.restoreAllMocks();});
it("não mostra imagem após troca de usuário durante leitura",async()=>{
 vi.stubEnv("VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED","true");m.getUser.mockReset().mockResolvedValueOnce({data:{user:{id:"a"}},error:null}).mockResolvedValueOnce({data:{user:{id:"b"}},error:null});m.invoke.mockResolvedValue({data:new Blob(["foto"],{type:"image/png"}),error:null});
 render(<FotoVerificada userId="a" fotoId="17970000-0000-4000-8000-000000000004"/>);fireEvent.click(screen.getByRole("button",{name:"Ver foto com verificação"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Foto verificada indisponível");expect(screen.queryByRole("img")).toBeNull();
});
