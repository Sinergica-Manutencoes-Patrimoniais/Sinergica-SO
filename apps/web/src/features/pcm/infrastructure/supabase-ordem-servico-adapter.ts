import { supabase } from "../../../lib/supabase-client";
import type {
  CriarOrdemServicoInput,
  DadosAberturaOs,
  EditarOrdemServicoInput,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "../application/ordem-servico-gateway";

function montarDescricao(input: CriarOrdemServicoInput): string | null {
  const blocos = [input.descricao?.trim()].filter(Boolean);
  return blocos.length > 0 ? blocos.join("\n\n") : null;
}

async function proximoNumero(): Promise<string> {
  const { count, error } = await supabase
    .schema("pcm")
    .from("ordens_servico")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return `CH-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export const supabaseOrdemServicoAdapter: OrdemServicoGateway = {
  async carregarDadosAbertura(): Promise<DadosAberturaOs> {
    const [
      { data: clientes, error: clientesError },
      { data: tecnicos, error: tecnicosError },
      { data: tiposTarefa, error: tiposTarefaError },
    ] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase
        .schema("pcm")
        .from("funcionarios")
        .select("id,nome,auvo_user_id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase
        .schema("pcm")
        .from("tipos_tarefa")
        .select("id,nome,auvo_id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
    ]);

    if (clientesError) throw clientesError;
    if (tecnicosError && tecnicosError.code !== "PGRST205" && tecnicosError.code !== "42P01") {
      throw tecnicosError;
    }
    if (tiposTarefaError) throw tiposTarefaError;

    return {
      clientes: (clientes ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string })),
      tecnicos: (tecnicos ?? []).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        auvoUserId: t.auvo_user_id as number,
      })),
      tiposTarefa: (tiposTarefa ?? []).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        auvoId: t.auvo_id as number | null,
      })),
    };
  },

  async criarOrdemServico(input): Promise<OrdemServicoCriada> {
    const numero = await proximoNumero();
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .insert({
        client_id: input.clientId,
        numero,
        titulo: input.titulo,
        descricao: montarDescricao(input),
        categoria: input.categoria,
        status: "solicitacao",
        prioridade: input.prioridade,
        gravidade: input.gravidade,
        urgencia: input.urgencia,
        tendencia: input.tendencia,
        local_descricao: input.localDescricao,
        solicitante: input.solicitante,
        origem: input.origem,
        created_by: input.createdBy,
        tipo_tarefa_id: input.tipoTarefaId,
        tecnico_funcionario_id: input.tecnicoId,
        data_agendada: input.dataPrevista,
      })
      .select("id,numero")
      .single();

    if (error) throw error;
    return { id: data.id as string, numero: data.numero as string };
  },

  async editarOrdemServico(input: EditarOrdemServicoInput): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .update({
        titulo: input.titulo,
        descricao: input.descricao,
        categoria: input.categoria,
        prioridade: input.prioridade,
        gravidade: input.gravidade,
        urgencia: input.urgencia,
        tendencia: input.tendencia,
        tecnico_funcionario_id: input.tecnicoId,
        data_agendada: input.dataPrevista,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id);
    if (error) throw error;
  },
};
