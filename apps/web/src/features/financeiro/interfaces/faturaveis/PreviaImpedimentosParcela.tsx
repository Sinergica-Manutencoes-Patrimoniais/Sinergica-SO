import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const motivo = z.enum(["gate_fechado", "revisao_divergente", "item_nao_elegivel", "lancamento_incompativel", "competencia_fechada", "primeira_parcela_ausente", "reserva_ativa", "saldo_item_insuficiente", "saldo_documento_insuficiente"]);
const resposta = z.object({ itemId: z.string().uuid(), documentoId: z.string().uuid(), impedimentos: z.array(motivo), consultaPrevia: z.literal(true), reservaSaldo: z.literal(false), resultadoPedidoAnterior: z.literal("desconhecido"), cobrancaEnviada: z.literal(false) }).strict();
const descricoes: Record<z.infer<typeof motivo>, string> = { gate_fechado: "Fluxo bloqueado", revisao_divergente: "Revisão do item divergente", item_nao_elegivel: "Item não elegível", lancamento_incompativel: "Lançamento incompatível", competencia_fechada: "Competência fechada", primeira_parcela_ausente: "Não há parcela anterior neste documento para o item", reserva_ativa: "Há reserva interna ativa", saldo_item_insuficiente: "Saldo do item insuficiente", saldo_documento_insuficiente: "Saldo do documento insuficiente" };
export function PreviaImpedimentosParcela({ usuario, cliente, itemId, documentoId, revisao, valor }: { usuario: string; cliente: string; itemId: string; documentoId: string; revisao: number; valor: string }) {
  const numero = /^\d+$/.test(valor) ? Number(valor) : NaN; const valido = Number.isSafeInteger(numero) && numero > 0;
  const consulta = useQuery({ queryKey: ["faturavel-impedimentos-parcela", usuario, cliente, itemId, documentoId, revisao, valor], enabled: valido, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_previa_impedimentos_parcela", { p_cliente_id: cliente, p_item_id: itemId, p_documento_id: documentoId, p_revisao: revisao, p_valor_centavos: numero }).abortSignal(signal); if (error) throw error; const r = resposta.parse(data); if (r.itemId !== itemId || r.documentoId !== documentoId) throw new Error("Resposta divergente"); return r; } });
  return <section aria-label="Prévia de impedimentos"><h6>Diagnóstico atual</h6><p>Não determina resultado de pedidos anteriores, não reserva saldo e não garante execução futura.</p>
    {!valido && <p>Informe um valor válido para consultar.</p>}{valido && consulta.isFetching && <output>Consultando impedimentos...</output>}{valido && consulta.isError && <p role="alert">Diagnóstico indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {valido && consulta.data && !consulta.isFetching && !consulta.isError && (consulta.data.impedimentos.length ? <ul>{consulta.data.impedimentos.map((m) => <li key={m}>{descricoes[m]}</li>)}</ul> : <p>Nenhum impedimento identificado nesta prévia; o comando ainda precisa revalidar.</p>)}
  </section>;
}
