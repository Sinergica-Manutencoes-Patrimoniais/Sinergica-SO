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

/** E01-S99/ADR-0014: toda OS precisa de um Chamado por trás (o número exibido é sempre o
 * `CH-XXXX` do Chamado — ver trigger `fn_ordens_servico_sync_numero_chamado`, migration 0151).
 * Quando a criação de OS não vem de um Chamado já existente (`input.chamadoId` ausente — criação
 * manual direta via "Nova Ordem de Serviço"), cria um Chamado por trás pra manter o CH-XXXX como
 * único identificador, sem mudar a UX de "Nova OS". */
async function criarChamadoAutomatico(input: {
  clienteId: string;
  titulo: string;
  createdBy: string;
}): Promise<{ id: string; numero: string }> {
  const { data: numero, error: numeroError } = await supabase
    .schema("pcm")
    .rpc("fn_proximo_numero_chamado");
  if (numeroError) throw numeroError;
  const { data, error } = await supabase
    .schema("pcm")
    .from("chamados")
    .insert({
      numero,
      cliente_id: input.clienteId,
      titulo: input.titulo,
      origem: "manual",
      created_by: input.createdBy,
      updated_by: input.createdBy,
    })
    .select("id,numero")
    .single();
  if (error) throw error;
  await supabase
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: data.id, tipo: "criado", metadata: { numero, auto: true } });
  return { id: data.id as string, numero: data.numero as string };
}

/** Fecha o ciclo do Chamado criado por `criarChamadoAutomatico` — mesma transição que
 * `marcarStatusComOs` faz no fluxo "Gerar OS a partir do Chamado" (`chamados.ts`), só que aqui é o
 * próprio adapter quem criou o Chamado, então quem fecha o ciclo é ele também. */
async function marcarChamadoAutomaticoComOs(
  chamadoId: string,
  ordemServicoId: string,
  updatedBy: string,
): Promise<void> {
  await supabase
    .schema("pcm")
    .from("chamados")
    .update({
      status: "convertido_os",
      ordem_servico_id: ordemServicoId,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq("id", chamadoId);
  await supabase
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: chamadoId, tipo: "os_gerada", metadata: { ordemServicoId } });
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
    let chamadoId = input.chamadoId ?? null;
    if (!chamadoId) {
      const chamadoAutomatico = await criarChamadoAutomatico({
        clienteId: input.clientId,
        titulo: input.titulo,
        createdBy: input.createdBy,
      });
      chamadoId = chamadoAutomatico.id;
    }

    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .insert({
        client_id: input.clientId,
        // `numero` não é enviado: a trigger `fn_ordens_servico_sync_numero_chamado` (0151) sempre
        // sobrescreve com o CH-XXXX do `chamado_id` acima.
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
        chamado_id: chamadoId,
        origem_inspecao_item_id: input.origemInspecaoItemId,
      })
      .select("id,numero")
      .single();

    if (error) throw error;

    // Chamado veio pronto do caller (fluxo "Gerar OS a partir do Chamado") — quem fecha o ciclo é
    // `gerarOsDoChamado`/`marcarStatusComOs` (chamados.ts), não aqui, pra respeitar o `destino`
    // escolhido (pode ser "backlog", não só "convertido_os").
    if (!input.chamadoId) {
      await marcarChamadoAutomaticoComOs(chamadoId, data.id as string, input.createdBy);
    }

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
