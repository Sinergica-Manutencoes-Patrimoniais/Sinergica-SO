import { beforeEach, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ linhas: [] as { id: string; nome: string; cliente: string }[], chamadas: [] as { cliente: string; cursor: string | null }[], falharNaSegunda: false }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ from: () => {
  let cliente = "", cursor: string | null = null, limite = 100;
  const consulta = {
    select: () => consulta,
    eq: (_campo: string, valor: string) => { cliente = valor; return consulta; },
    is: () => consulta,
    gt: (_campo: string, valor: string) => { cursor = valor; return consulta; },
    limit: (n: number) => { limite = Math.min(n, 100); return consulta; },
    order: () => consulta,
    then: (resolve: (v: unknown) => unknown) => {
      banco.chamadas.push({ cliente, cursor });
      if (cursor && banco.falharNaSegunda) return Promise.resolve(resolve({data:null,error:new Error("offline")}));
      return Promise.resolve(resolve({ data: banco.linhas.filter((l) => l.cliente === cliente && (!cursor || l.id > cursor)).sort((a,b) => a.id.localeCompare(b.id)).slice(0, limite).map(({id,nome})=>({id,nome})), error: null }));
    },
  };
  return consulta;
} }) } }));
import { supabaseOrdemServicoAdapter } from "./supabase-ordem-servico-adapter";

beforeEach(() => {
  banco.chamadas = [];
  banco.falharNaSegunda = false;
  banco.linhas = Array.from({length: 205}, (_,i) => ({id: String(i).padStart(4,"0"), nome: `Componente ${i}`, cliente:"cliente-a"}));
  banco.linhas.push({id:"9999", nome:"Outro Cliente", cliente:"cliente-b"});
});
it("não devolve lista parcial se uma página falhar", async () => {
  banco.falharNaSegunda = true;
  await expect(supabaseOrdemServicoAdapter.listarEquipamentosDoCliente("cliente-a")).rejects.toThrow("offline");
});
it("retorna Componentes além da primeira página sem misturar Clientes", async () => {
  const resultado = await supabaseOrdemServicoAdapter.listarEquipamentosDoCliente("cliente-a");
  expect(resultado).toHaveLength(205);
  expect(resultado).toContainEqual({id:"0204",nome:"Componente 204"});
  expect(resultado).not.toContainEqual({id:"9999",nome:"Outro Cliente"});
  expect(banco.chamadas.length).toBeGreaterThan(1);
  expect(banco.chamadas.every((c) => c.cliente === "cliente-a")).toBe(true);
});
