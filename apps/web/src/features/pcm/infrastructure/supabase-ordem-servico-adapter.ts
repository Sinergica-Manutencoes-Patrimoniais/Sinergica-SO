import { supabase } from "../../../lib/supabase-client";
import type {
  CriarOrdemServicoInput,
  DadosAberturaOs,
  EditarOrdemServicoInput,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "../application/ordem-servico-gateway";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import type { PesosGutd } from "../domain/priorizacao-backlog";

function montarDescricao(input: CriarOrdemServicoInput): string | null {
  const blocos = [input.descricao?.trim()].filter(Boolean);
  return blocos.length > 0 ? blocos.join("\n\n") : null;
}

/** E01-S88: numeração atômica via sequence (RPC) — substitui o `count()` com race condition
 * conhecida (E01-S02). Prefixo "OS-" — "CH-" agora é do Chamado. */
async function proximoNumero(): Promise<string> {
  const { data, error } = await supabase.schema("pcm").rpc("fn_proximo_numero_os");
  if (error) throw error;
  return data as string;
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
        dor_cliente: input.dorCliente,
        observacao: input.observacao,
        local_descricao: input.localDescricao,
        solicitante: input.solicitante,
        origem: input.origem,
        created_by: input.createdBy,
        tipo_tarefa_id: input.tipoTarefaId,
        tecnico_funcionario_id: input.tecnicoId,
        data_agendada: input.dataPrevista,
        tipo_os: input.tipoOs,
        pmoc_schedule_id: input.pmocScheduleId,
        chamado_id: input.chamadoId,
        origem_inspecao_item_id: input.origemInspecaoItemId,
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
        dor_cliente: input.dorCliente,
        observacao: input.observacao,
        tecnico_funcionario_id: input.tecnicoId,
        data_agendada: input.dataPrevista,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id);
    if (error) throw error;
  },

  async iaTituloAtiva(): Promise<boolean> {
    const { data, error } = await supabase
      .schema("config")
      .rpc("fn_integracao_ativa_publica", { p_chave: "openrouter" });
    if (error) throw error;
    return Boolean(data);
  },

  async gerarTituloOs(descricao: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke("pcm-os-gerar-titulo", {
      body: { descricao },
    });
    if (error) throw error;
    const titulo = (data as { titulo?: string } | null)?.titulo;
    if (!titulo) throw new Error("A IA não devolveu um título.");
    return titulo;
  },

  async obterPesosGutd(): Promise<PesosGutd> {
    const { data, error } = await supabase
      .schema("config")
      .from("priorizacao_gutd")
      .select("peso_gravidade,peso_urgencia,peso_tendencia,peso_dor_cliente")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return PESOS_GUTD_PADRAO;
    return {
      gravidade: data.peso_gravidade,
      urgencia: data.peso_urgencia,
      tendencia: data.peso_tendencia,
      dorCliente: data.peso_dor_cliente,
    };
  },
};
