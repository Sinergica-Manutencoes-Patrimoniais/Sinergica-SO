// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { rejeicaoInicialRegraComprovada, supabaseCalendarioContratualAdapter } from "./supabase-calendario-contratual-adapter";
import type { CriarRegraContratualCommand } from "../application/calendario-contratual-gateway";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const comando:CriarRegraContratualCommand={requestId:id(1),expectedRevision:0,clienteId:id(2),serieId:id(3),regraId:id(4),contratoId:id(5),ancoraSemana:"2026-10-05",diaSemana:5,intervaloSemanas:1,horaInicio:"08:00",duracaoMinutos:120,deslocamentoMinutos:0,fuso:"America/Sao_Paulo",vigenciaInicio:"2026-10-01",vigenciaFim:null};
afterEach(()=>vi.resetAllMocks());
it.each(["22023","23514","P0011"])("marca apenas erro %s retornado pela RPC com HTTP 400",async(code)=>{
 const erro={code,message:"recusado"};api.rpc.mockResolvedValue({data:null,error:erro,status:400});
 await expect(supabaseCalendarioContratualAdapter.criarRegra(comando)).rejects.toBe(erro);
 expect(rejeicaoInicialRegraComprovada(erro)).toBe(true);
 expect(rejeicaoInicialRegraComprovada({code,message:"recusado"})).toBe(false);
});
it("não marca erro de transporte com mesmo código",async()=>{
 const erro={code:"22023",message:"rede"};api.rpc.mockResolvedValue({data:null,error:erro,status:503});
 await expect(supabaseCalendarioContratualAdapter.criarRegra(comando)).rejects.toBe(erro);
 expect(rejeicaoInicialRegraComprovada(erro)).toBe(false);
});
