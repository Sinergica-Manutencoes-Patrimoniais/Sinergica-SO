// infrastructure/supabase-agenda-projecao-adapter.ts — E01-S202.
// Leitura da projeção da Visita com horários Auvo já sincronizados. A RPC recusa com
// erro NOMEADO quando o gate está fechado (`agenda_capacidade_bloqueada`) ou falta a capacidade
// `visita.confirmar` (`sem_acesso`) — o erro sobe cru para a tela decidir a frase, nunca vira
// lista vazia aqui.
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { AlocacaoProjetada } from "../domain/agenda-projecao-visita";

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
    horarios_auvo: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).default([]),
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
  const pcm = supabase.schema("pcm");
  const parametros = { p_cliente_id: clienteId, p_semana_inicio: semanaInicio, p_limite: 500 };
  const consultar = (nome: string) => {
    const chamada = pcm.rpc(nome, parametros);
    return signal ? chamada.abortSignal(signal) : chamada;
  };
  let { data, error } = await consultar("sso_listar_agenda_tecnico_com_horarios_auvo");
  // Durante o deploy, a versão anterior do PostgREST ainda pode desconhecer a nova RPC.
  if (error?.code === "PGRST202") {
    ({ data, error } = await consultar("sso_listar_agenda_tecnico_projetada"));
  }
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
    periodo: linha.periodo,
    horariosAuvo: linha.horarios_auvo,
    estado: linha.estado,
    natureza: linha.natureza,
    osNumeros: linha.os_numeros ?? [],
    quantidadeOs: linha.quantidade_os,
  }));
}
