import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { criarOsChamadoSchema, type CriacaoOsChamadoGateway } from "../application/chamados-os-comando";

const resultadoSchema = z.object({
  chamadoId: z.string().guid(), osId: z.string().guid(), numero: z.string().min(1),
  revision: z.number().int().safe().positive(), requestId: z.string().guid(),
}).strict();

// O núcleo 0324 continua privado; o wrapper permanece gateado até rollout coordenado.
export const supabaseChamadosOsComandoAdapter: CriacaoOsChamadoGateway = {
  async consultarRevisao(cliente, chamado, signal) {
    let consulta = supabase.schema("pcm").rpc("sso_consultar_revisao_criacao_os", {
      p_cliente_id: cliente, p_chamado_id: chamado,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const linha = z.array(z.object({ revisao: z.number().int().safe().positive() }).strict()).length(1).parse(data)[0];
    if (!linha) throw new Error("Revisão indisponível.");
    return linha.revisao;
  },
  async criar(entrada) {
    const c = criarOsChamadoSchema.parse(entrada);
    const { data, error } = await supabase.schema("pcm").rpc("sso_criar_os_chamado_autorizado", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_chamado_id: c.chamadoId,
      p_cliente_id: c.clienteId, p_os_id: c.osId, p_titulo: c.titulo,
      p_descricao: c.descricao, p_categoria: c.categoria,
    });
    if (error) throw error;
    const resultado = resultadoSchema.parse(data);
    if (resultado.requestId !== c.requestId || resultado.osId !== c.osId || resultado.chamadoId !== c.chamadoId)
      throw new Error("Resposta da criação não corresponde ao comando.");
    return resultado;
  },
  async reconciliar(entrada) {
    const c = criarOsChamadoSchema.parse(entrada);
    const { data, error } = await supabase.schema("pcm").rpc("sso_reconciliar_request_os_chamado", {
      p_cliente_id: c.clienteId, p_chamado_id: c.chamadoId, p_request_id: c.requestId, p_os_id: c.osId,
      p_expected_revision: c.expectedRevision, p_titulo: c.titulo, p_descricao: c.descricao, p_categoria: c.categoria,
    });
    if (error) throw error;
    const resposta = z.discriminatedUnion("estado", [
      z.object({ requestId: z.string().guid(), estado: z.literal("indeterminado"), autorizaNovaCriacao: z.literal(false) }).strict(),
      z.object({ requestId: z.string().guid(), estado: z.literal("confirmado"), resultado: resultadoSchema, autorizaNovaCriacao: z.literal(false) }).strict(),
    ]).parse(data);
    if (resposta.requestId !== c.requestId) throw new Error("Pedido divergente.");
    if (resposta.estado === "indeterminado") return { estado: "indeterminado" };
    if (resposta.resultado.requestId !== c.requestId || resposta.resultado.osId !== c.osId || resposta.resultado.chamadoId !== c.chamadoId) throw new Error("Resultado divergente.");
    return { estado: "confirmado", resultado: resposta.resultado };
  },
};
