import { beforeEach, expect, it, vi } from "vitest";
import type { CriarOrdemServicoCommand } from "../application/ordem-servico-gateway";
const m = vi.hoisted(() => ({ insert: vi.fn(), chamado: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ from: (t: string) => t === "chamados" ? { select: () => ({ eq: () => ({ is: () => ({ single: m.chamado }) }) }) } : { insert: m.insert } }) } }));
import { supabaseOrdemServicoAdapter } from "./supabase-ordem-servico-adapter";

const pedido: CriarOrdemServicoCommand = { clientId: "cliente", chamadoId: "chamado", createdBy: "ator", titulo: "Título", descricao: null, categoria: "corretiva", prioridade: "normal", gravidade: 3, urgencia: 3, tendencia: 3, dorCliente: null, observacao: null, localDescricao: null, solicitante: null, origem: "manual", tecnicoId: null, tipoTarefaId: null, dataPrevista: null, tipoOs: "C2", pmocScheduleId: null, origemInspecaoItemId: null };
beforeEach(() => {
  m.chamado.mockReset(); m.insert.mockReset();
  m.chamado.mockResolvedValue({ data: { numero: "CH-0042", cliente_id: "cliente" }, error: null });
  m.insert.mockImplementation((v: Record<string, unknown>) => ({ select: () => ({ single: async () => ({ data: { id: v.id, numero: v.numero }, error: null }) }) }));
});
it("envia número explícito do Chamado sem mudar código público", async () => {
  const resultado = await supabaseOrdemServicoAdapter.criarOrdemServico(pedido);
  expect(resultado.numero).toBe("CH-0042");
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ chamado_id: "chamado", numero: "CH-0042" }));
});
it("prepara PRE a partir do id da nova OS sem depender de trigger", async () => {
  await supabaseOrdemServicoAdapter.criarOrdemServico({ ...pedido, chamadoId: null, semChamado: true });
  const inserido = m.insert.mock.calls[0]?.[0] as { id: string; numero: string };
  expect(inserido.numero).toBe(`PRE-${inserido.id.slice(0, 8).toUpperCase()}`);
  expect(m.chamado).not.toHaveBeenCalled();
});
it("rejeita Chamado de outro Cliente antes do INSERT", async () => {
  m.chamado.mockResolvedValue({ data: { numero: "CH-0042", cliente_id: "outro" }, error: null });
  await expect(supabaseOrdemServicoAdapter.criarOrdemServico(pedido)).rejects.toThrow("Chamado incompatível com Cliente");
  expect(m.insert).not.toHaveBeenCalled();
});
