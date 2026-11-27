/** E01-S204 — contagens oficiais de OS aberta / backlog / pré-chamado / chamado aberto. Uma só
 * classificação no banco (`pcm.fn_classificar_item_operacao`, migration 1913); RLS do read model
 * decide o que cada usuário vê (funções `security invoker`). */
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type {
  ContagemOperacionalGateway,
  FiltrosDemandaEmAberto,
} from "../application/contagem-operacional-queries";
import type { ContagemOperacional } from "../domain/contagem-operacional";
import { CONTAGEM_OPERACIONAL_VAZIA } from "../domain/contagem-operacional";

const contagem = z.coerce.number().int().nonnegative();
const linhaSchema = z.object({
  os_abertas: contagem,
  backlog: contagem,
  pre_chamados: contagem,
  chamados_abertos: contagem,
  demanda_em_aberto: contagem,
});
const linhaClienteSchema = linhaSchema.extend({ cliente_id: z.string().min(1) });

function mapear(linha: z.infer<typeof linhaSchema>): ContagemOperacional {
  return {
    osAbertas: linha.os_abertas,
    backlog: linha.backlog,
    preChamados: linha.pre_chamados,
    chamadosAbertos: linha.chamados_abertos,
    demandaEmAberto: linha.demanda_em_aberto,
  };
}

export async function contarDemandaEmAberto(
  filtros: FiltrosDemandaEmAberto = {},
  signal?: AbortSignal,
): Promise<ContagemOperacional> {
  let chamada = supabase.schema("pcm").rpc("fn_demanda_em_aberto", {
    p_busca: filtros.busca?.trim() || null,
    p_cliente_id: filtros.clienteId ?? null,
    p_tecnico_funcionario_id: filtros.tecnicoFuncionarioId ?? null,
    p_categoria: filtros.categoria ?? null,
    p_data_inicio: filtros.dataInicio ?? null,
    p_data_fim: filtros.dataFim ?? null,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linha = (data as unknown[] | null)?.[0];
  return linha ? mapear(linhaSchema.parse(linha)) : CONTAGEM_OPERACIONAL_VAZIA;
}

/** Uma entrada por Cliente com algum item; Cliente ausente do mapa = tudo zero. */
export async function contarPorCliente(
  clienteId?: string,
  signal?: AbortSignal,
): Promise<Map<string, ContagemOperacional>> {
  let chamada = supabase
    .schema("pcm")
    .rpc("fn_contagem_operacional_por_cliente", { p_cliente_id: clienteId ?? null });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linhas = z.array(linhaClienteSchema).parse(data ?? []);
  return new Map(linhas.map((linha) => [linha.cliente_id, mapear(linha)]));
}

export const supabaseContagemOperacionalAdapter: ContagemOperacionalGateway = {
  contarDemandaEmAberto,
  contarPorCliente,
};
