import { supabase } from "../../../lib/supabase-client";
import type { ClienteAlmaGateway, MemoriaResumoCliente } from "../application/cliente-alma-gateway";

export const supabaseClienteAlmaAdapter: ClienteAlmaGateway = {
  async obter(clienteId: string): Promise<string> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("cliente_alma")
      .select("conteudo")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) throw error;
    return (data?.conteudo as string | undefined) ?? "";
  },

  async salvar(clienteId: string, conteudo: string, userId: string): Promise<void> {
    const { error } = await supabase.schema("atendimento").from("cliente_alma").upsert(
      {
        cliente_id: clienteId,
        conteudo,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "cliente_id" },
    );
    if (error) throw error;
  },

  async obterResumo(clienteId: string): Promise<MemoriaResumoCliente | null> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("cliente_memoria_resumo")
      .select("resumo,periodo_inicio,periodo_fim,updated_at")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.resumo) return null;
    return {
      resumo: data.resumo as string,
      periodoInicio: (data.periodo_inicio as string | null) ?? null,
      periodoFim: (data.periodo_fim as string | null) ?? null,
      atualizadoEm: data.updated_at as string,
    };
  },
};
