import { supabase } from "../../../lib/supabase-client";
import type {
  CriarOrdemServicoInput,
  DadosAberturaOs,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "../application/ordem-servico-gateway";

function montarDescricao(input: CriarOrdemServicoInput): string | null {
  const blocos = [
    input.descricao?.trim(),
    input.tipoAuvo ? `Tipo Auvo sugerido/selecionado: ${input.tipoAuvo}` : null,
    input.tecnicoId ? `Técnico selecionado: ${input.tecnicoId}` : null,
    input.dataPrevista ? `Data prevista: ${input.dataPrevista}` : null,
  ].filter(Boolean);
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
    const [{ data: clientes, error: clientesError }, { data: tecnicos, error: tecnicosError }] =
      await Promise.all([
        supabase
          .schema("pcm")
          .from("clientes")
          .select("id,nome")
          .eq("ativo", true)
          .is("deleted_at", null)
          .order("nome", { ascending: true }),
        supabase
          .schema("pcm")
          .from("tecnicos_cache")
          .select("id,nome,auvo_user_id")
          .eq("ativo", true)
          .order("nome", { ascending: true }),
      ]);

    if (clientesError) throw clientesError;
    if (tecnicosError && tecnicosError.code !== "PGRST205" && tecnicosError.code !== "42P01") {
      throw tecnicosError;
    }

    return {
      clientes: (clientes ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string })),
      tecnicos: (tecnicos ?? []).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        auvoUserId: t.auvo_user_id as number,
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
      })
      .select("id,numero")
      .single();

    if (error) throw error;
    return { id: data.id as string, numero: data.numero as string };
  },
};
