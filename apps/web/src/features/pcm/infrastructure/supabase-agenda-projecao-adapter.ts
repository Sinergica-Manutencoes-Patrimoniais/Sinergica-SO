// infrastructure/supabase-agenda-projecao-adapter.ts — E01-S202.
// Leitura da projeção `pcm.sso_listar_agenda_tecnico_projetada` (migration 1867). A RPC recusa com
// erro NOMEADO quando o gate está fechado (`agenda_capacidade_bloqueada`) ou falta a capacidade
// `visita.confirmar` (`sem_acesso`) — o erro sobe cru para a tela decidir a frase, nunca vira
// lista vazia aqui.
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { AlocacaoProjetada, PeriodoVisita } from "../domain/agenda-projecao-visita";

const linhaSchema = z
  .object({
    visita_id: z.string().guid(),
    cliente_id: z.string().guid(),
    cliente_nome: z.string(),
    funcionario_id: z.string().guid(),
    funcionario_nome: z.string(),
    papel: z.string(),
    data: z.string(),
    periodo: z.enum(["manha", "tarde", "integral"]),
    inicio_em: z.string(),
    fim_em: z.string(),
    estado: z.string(),
    natureza: z.string(),
    os_numeros: z.array(z.string()).nullable(),
    quantidade_os: z.number().int(),
  })
  .strict();

export async function listarAgendaProjetada(
  semanaInicio: string,
  clienteId: string | null,
  signal?: AbortSignal,
): Promise<AlocacaoProjetada[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaInicio)) throw new Error("Semana inválida.");
  if (clienteId !== null && !z.string().guid().safeParse(clienteId).success)
    throw new Error("Cliente inválido.");
  let chamada = supabase.schema("pcm").rpc("sso_listar_agenda_tecnico_projetada", {
    p_cliente_id: clienteId,
    p_semana_inicio: semanaInicio,
    p_limite: 500,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linhas = linhaSchema.array().safeParse(data ?? []);
  if (!linhas.success) throw new Error("Agenda projetada em formato inesperado.");
  return linhas.data.map((linha) => ({
    visitaId: linha.visita_id,
    clienteId: linha.cliente_id,
    clienteNome: linha.cliente_nome,
    funcionarioId: linha.funcionario_id,
    funcionarioNome: linha.funcionario_nome,
    papel: linha.papel,
    data: linha.data,
    periodo: linha.periodo as PeriodoVisita,
    estado: linha.estado,
    natureza: linha.natureza,
    osNumeros: linha.os_numeros ?? [],
    quantidadeOs: linha.quantidade_os,
  }));
}
