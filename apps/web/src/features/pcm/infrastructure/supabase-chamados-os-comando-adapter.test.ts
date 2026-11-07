import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: mocks.rpc }) },
}));
import { supabaseChamadosOsComandoAdapter } from "./supabase-chamados-os-comando-adapter";

const pedido = {
  requestId: "16794000-0000-4000-8000-000000000001",
  osId: "16794000-0000-4000-8000-000000000002",
  clienteId: "16794000-0000-4000-8000-000000000003",
  chamadoId: "16794000-0000-4000-8000-000000000004",
  expectedRevision: 1,
  titulo: "OS teste",
  descricao: null,
  categoria: "corretiva" as const,
};
beforeEach(() => mocks.rpc.mockReset());
it("envia criação ao wrapper mediado preservando identidade do pedido", async () => {
  mocks.rpc.mockResolvedValue({ data: { requestId: pedido.requestId, osId: pedido.osId,
    chamadoId: pedido.chamadoId, numero: "OS-1", revision: 2 }, error: null });
  await expect(supabaseChamadosOsComandoAdapter.criar(pedido)).resolves.toMatchObject({ osId: pedido.osId });
  expect(mocks.rpc).toHaveBeenCalledWith("sso_criar_os_chamado_autorizado", {
    p_request_id: pedido.requestId, p_expected_revision: pedido.expectedRevision,
    p_chamado_id: pedido.chamadoId, p_cliente_id: pedido.clienteId, p_os_id: pedido.osId,
    p_titulo: pedido.titulo, p_descricao: pedido.descricao, p_categoria: pedido.categoria,
  });
});
it("envia todos os campos do pedido original para 0929 e reconhece apenas confirmação idêntica", async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      estado: "confirmado",
      requestId: pedido.requestId,
      autorizaNovaCriacao: false,
      resultado: {
        requestId: pedido.requestId,
        osId: pedido.osId,
        chamadoId: pedido.chamadoId,
        numero: "OS-1",
        revision: 2,
      },
    },
    error: null,
  });
  const resultado = await supabaseChamadosOsComandoAdapter.reconciliar?.(pedido);
  expect(resultado?.estado).toBe("confirmado");
  expect(mocks.rpc).toHaveBeenCalledWith("sso_reconciliar_request_os_chamado", {
    p_cliente_id: pedido.clienteId,
    p_chamado_id: pedido.chamadoId,
    p_request_id: pedido.requestId,
    p_os_id: pedido.osId,
    p_expected_revision: 1,
    p_titulo: pedido.titulo,
    p_descricao: null,
    p_categoria: pedido.categoria,
  });
});
it("recusa resposta com outra OS mesmo quando o requestId corresponde", async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      estado: "confirmado",
      requestId: pedido.requestId,
      autorizaNovaCriacao: false,
      resultado: {
        requestId: pedido.requestId,
        osId: "16794000-0000-4000-8000-000000000099",
        chamadoId: pedido.chamadoId,
        numero: "OS-1",
        revision: 2,
      },
    },
    error: null,
  });
  await expect(supabaseChamadosOsComandoAdapter.reconciliar?.(pedido)).rejects.toThrow(
    "Resultado divergente",
  );
});
